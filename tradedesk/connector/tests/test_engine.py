import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector.config import Config  # noqa: E402
from hexadesk_connector.engine import Engine  # noqa: E402
from hexadesk_connector.fake_mt5 import FakeGateway  # noqa: E402
from hexadesk_connector.store import MemoryStore  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")
SECRETS = {"demo": {"login": 1234567, "password": "x", "server": "ClearInvestimentos-DEMO"}, "real": {"login": 7654321, "password": "y", "server": "Clear-Real"}}
BASE = dict(enabled=True, mode="sim", real_unlocked=False, symbols=["WIN", "WDO"], profile="moderado", risk_per_trade_brl=60, max_contracts=3,
            daily_loss_brl=150, daily_target_brl=None, max_trades_per_day=3, stop_points_win=150, stop_points_wdo=5, rr=1.5,
            open_from="09:05", open_until="17:00", flat_at="17:30")


class Clock:
    def __init__(self, y=2026, mo=11, d=9, h=10, mi=0):  # segunda-feira, dia útil
        self.t = datetime(y, mo, d, h, mi, tzinfo=SP)
        self.m = 1000.0

    def now(self): return self.t
    def mono(self): return self.m

    def advance(self, seconds):
        from datetime import timedelta
        self.t += timedelta(seconds=seconds); self.m += seconds

    def set(self, h, mi=0):
        self.t = self.t.replace(hour=h, minute=mi)


class Signals:
    """Sinal controlado pelo teste: um candle novo a cada .fire()."""
    def __init__(self): self.pending, self.n = None, 0
    def fire(self, side="buy"): self.n += 1; self.pending = (side, float(self.n))
    def __call__(self, candles):
        s, self.pending = self.pending, None
        return s


def make(settings=None, gw=None, cfg=None, secrets=None):
    clock, sig = Clock(), Signals()
    store = MemoryStore({**BASE, **(settings or {})})
    gw = gw or FakeGateway()
    eng = Engine(gw, store, cfg or Config(), SECRETS if secrets is None else secrets, now_fn=clock.now, mono_fn=clock.mono, signal_fn=sig)
    return eng, gw, store, clock, sig


def run(eng, clock, n=1, dt=2.0):
    for _ in range(n):
        eng.step(); clock.advance(dt)


class Entries(unittest.TestCase):
    def test_opens_with_server_side_stop_correct_contract_and_size(self):
        eng, gw, store, clock, sig = make()
        run(eng, clock)           # conecta
        sig.fire("buy"); run(eng, clock)
        pos = gw.positions()
        self.assertEqual({p.symbol for p in pos}, {"WINZ26"})
        p = pos[0]
        self.assertEqual(p.volume, 2)                       # risco R$60 / (150 pts × R$0,20)
        self.assertGreater(p.sl, 0)                         # stop gravado no "servidor"
        self.assertEqual(p.sl, p.price_open - 150)
        self.assertEqual(p.tp, p.price_open + 225)          # alvo = 1,5 × stop
        self.assertEqual(len(store.trades), 1)
        self.assertEqual(store.trades[0]["contract"], "WINZ26")
        self.assertTrue(store.has_log("ENTRADA BUY 2x WINZ26"))

    def test_both_assets_open_in_same_signal_round(self):
        eng, gw, store, clock, sig = make()
        calls = []
        eng.signal_fn = lambda c: calls.append(1) or ("buy", float(len(calls)))
        run(eng, clock, 2)
        self.assertEqual({p.symbol for p in gw.positions()}, {"WINZ26", "WDOZ26"})
        self.assertEqual(next(p for p in gw.positions() if p.symbol == "WDOZ26").volume, 1)

    def test_one_position_per_asset(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]))
        run(eng, clock); sig.fire(); run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        self.assertEqual(len(store.trades), 1)

    def test_outside_hours_no_entry(self):
        eng, gw, store, clock, sig = make()
        for h, m in [(8, 30), (9, 0), (17, 1), (18, 0)]:
            clock.set(h, m); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        clock.set(9, 5); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)

    def test_holiday_and_weekend_no_entry(self):
        for (y, mo, d) in [(2026, 11, 20), (2026, 11, 8), (2026, 4, 3)]:  # feriado, domingo, Sexta Santa
            eng, gw, store, clock, sig = make()
            clock.t = clock.t.replace(year=y, month=mo, day=d)
            run(eng, clock); sig.fire(); run(eng, clock)
            self.assertEqual(gw.positions(), [], f"operou em {y}-{mo}-{d}")

    def test_paused_robot_does_not_trade(self):
        eng, gw, store, clock, sig = make(dict(enabled=False))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])

    def test_too_small_account_refuses(self):
        eng, gw, store, clock, sig = make(gw=FakeGateway(balance=500))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertTrue(store.has_log("não comporta nem 1 contrato") or store.has_log("RECUSA"))


class Protection(unittest.TestCase):
    def test_stop_not_confirmed_closes_immediately(self):
        gw = FakeGateway(); gw.drop_sl = True
        eng, gw, store, clock, sig = make(gw=gw)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertEqual(store.trades, [])
        self.assertTrue(store.has_log("stop não confirmado"))

    def test_order_rejection_is_logged_and_backs_off(self):
        gw = FakeGateway(); gw.fail_orders = True
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]), gw=gw)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertTrue(store.has_log("Ordem recusada"))
        gw.fail_orders = False; sig.fire(); run(eng, clock)   # ainda em espera (60 s)
        self.assertEqual(gw.positions(), [])

    def test_stale_prices_block_entries(self):
        eng, gw, store, clock, sig = make()
        run(eng, clock)                    # registra o primeiro preço
        gw.stale = True
        clock.advance(130)
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertTrue(store.has_log("preços parados"))

    def test_panel_down_blocks_entries_but_still_flattens_at_close(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        store.down = True
        run(eng, clock, 1); clock.advance(70); run(eng, clock)
        sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)           # nenhuma nova entrada
        clock.set(17, 30); run(eng, clock)
        self.assertEqual(gw.positions(), [])               # zera mesmo com o painel fora

    def test_flat_at_end_of_day(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]))
        run(eng, clock); sig.fire(); run(eng, clock)
        clock.set(17, 29); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        clock.set(17, 30); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        run(eng, clock)
        self.assertEqual(store.trades[0]["status"], "closed")
        self.assertEqual(store.trades[0]["close_reason"], "zeragem fim de dia")

    def test_stop_hit_on_server_is_recorded_as_loss(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]))
        run(eng, clock); sig.fire(); run(eng, clock)
        entry = gw.positions()[0]
        gw.move("WINZ26", entry.sl - 10)                   # o "servidor" dispara o stop sozinho
        run(eng, clock)
        t = store.trades[0]
        self.assertEqual(t["status"], "closed")
        self.assertAlmostEqual(t["pnl"], -150 * 0.2 * 2, places=2)   # -R$60
        self.assertEqual(t["close_reason"], "stop/alvo na corretora")


class DailyLimits(unittest.TestCase):
    def test_daily_loss_halts_until_tomorrow(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"], daily_loss_brl=50))
        run(eng, clock); sig.fire(); run(eng, clock)
        gw.move("WINZ26", gw.positions()[0].sl - 5)        # perde R$60 ≥ limite de R$50
        run(eng, clock)
        self.assertTrue(store.has_log("LIMITE DE PERDA DIÁRIO"))
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertEqual(eng.state, "halted")
        clock.t = clock.t.replace(day=10); eng.sess = None   # dia seguinte (terça)
        sig.fire(); run(eng, clock, 2)
        self.assertEqual(len(gw.positions()), 1)

    def test_daily_target_halts(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"], daily_target_brl=40))
        run(eng, clock); sig.fire(); run(eng, clock)
        p = gw.positions()[0]
        gw.move("WINZ26", p.tp + 5)                        # alvo: +R$90
        run(eng, clock)
        self.assertTrue(store.has_log("META DIÁRIA"))
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])

    def test_max_trades_per_day(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"], max_trades_per_day=2))
        run(eng, clock)
        for _ in range(4):
            sig.fire(); run(eng, clock)
            for p in gw.positions():
                gw.close_position(p)
            run(eng, clock)
        self.assertEqual(len(store.trades), 2)


class Panic(unittest.TestCase):
    def test_panic_closes_everything_and_disables(self):
        eng, gw, store, clock, sig = make()
        calls = []
        eng.signal_fn = lambda c: calls.append(1) or ("buy", float(len(calls)))
        run(eng, clock, 2)
        self.assertEqual(len(gw.positions()), 2)
        store.settings["enabled"] = True
        eng.signal_fn = lambda c: None
        store.push_command("panic"); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertFalse(store.settings["enabled"])
        self.assertEqual(store.commands[0]["status"], "done")
        run(eng, clock)
        self.assertTrue(all(t["status"] == "closed" for t in store.trades))
        self.assertTrue(all(t["close_reason"] == "PARAR TUDO" for t in store.trades))


class ModeSafety(unittest.TestCase):
    def test_simulator_refuses_real_account(self):
        eng, gw, store, clock, sig = make(gw=FakeGateway(mode="real"))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertIn("BLOQUEADA", eng.error)

    def test_real_mode_needs_both_locks(self):
        for allow, unlocked, expect in [(False, False, 0), (True, False, 0), (False, True, 0), (True, True, 1)]:
            eng, gw, store, clock, sig = make(dict(mode="real", real_locked=False, real_unlocked=unlocked, symbols=["WIN"]), cfg=Config(allow_real=allow))
            run(eng, clock); sig.fire(); run(eng, clock)
            self.assertEqual(len(gw.positions()), expect, f"allow={allow} unlocked={unlocked}")

    def test_real_mode_locked_by_diagnosis_even_with_both_locks(self):
        eng, gw, store, clock, sig = make(dict(mode="real", real_locked=True, real_unlocked=True, symbols=["WIN"]), cfg=Config(allow_real=True))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertIn("TRAVADO", eng.error)
        eng2, gw2, store2, clock2, sig2 = make(dict(mode="real", real_unlocked=True, symbols=["WIN"]), cfg=Config(allow_real=True))   # coluna ausente = travado
        run(eng2, clock2); sig2.fire(); run(eng2, clock2)
        self.assertEqual(gw2.positions(), [])

    def test_real_mode_refuses_demo_account(self):
        eng, gw, store, clock, sig = make(dict(mode="real", real_locked=False, real_unlocked=True), gw=FakeGateway(mode="demo"), cfg=Config(allow_real=True))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])

    def test_switching_to_simulator_flattens_disables_and_reconnects_demo(self):
        eng, gw, store, clock, sig = make(dict(mode="real", real_locked=False, real_unlocked=True, symbols=["WIN"]), cfg=Config(allow_real=True))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        store.settings.update(mode="sim", real_unlocked=False)       # botão "voltar ao simulador"
        clock.advance(20); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertFalse(store.settings["enabled"])
        self.assertEqual(gw.connect_calls, ["Clear-Real", "ClearInvestimentos-DEMO"])
        self.assertEqual(gw.mode, "demo")

    def test_missing_credentials_reports_error(self):
        eng, gw, store, clock, sig = make(secrets={})
        run(eng, clock)
        self.assertIn("Credenciais", eng.error)
        self.assertEqual(store.status.get("state"), "error")


class Heartbeat(unittest.TestCase):
    def test_status_published_with_masked_login(self):
        eng, gw, store, clock, sig = make()
        run(eng, clock, 3)
        st = store.status
        self.assertEqual(st["account_mode"], "demo")
        self.assertEqual(st["account_login"], "***567")
        self.assertEqual(st["contracts"], {"WIN": "WINZ26", "WDO": "WDOZ26"})
        self.assertNotIn("password", str(st))


class RealMode(unittest.TestCase):
    """Dinheiro REAL: 1 contrato até provar; trava de 5% do pico; posições órfãs; alertas."""
    def real(self, **over):
        return make(dict(mode="real", real_locked=False, real_unlocked=True, max_contracts=30, daily_loss_brl=5000, max_trades_per_day=40,
                         risk_per_trade_brl=900, profile="agressivo", **over), cfg=Config(allow_real=True))

    def test_contracts_capped_at_one_until_proven(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"])
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions()[0].volume, 1)          # painel pedia até 30

    def test_contracts_grow_slowly_after_30_positive_real_sessions(self):
        from hexadesk_connector.risk import real_contract_cap
        self.assertEqual([real_contract_cap(n, 100, 9) for n in (0, 29, 30, 44, 45, 60)], [1, 1, 2, 2, 3, 4])
        self.assertEqual(real_contract_cap(40, -5, 9), 1)
        eng, gw, store, clock, sig = self.real(symbols=["WIN"])
        for d in range(30):
            store.sessions[(f"2026-10-{d:02d}", "real", "mt5")] = {"pnl": 10.0, "active_minutes": 300}
        run(eng, clock, 2, dt=70); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions()[0].volume, 2)          # 30 pregões reais positivos → 2 contratos (nunca 30)

    def test_back_to_simulator_automatically_when_10_percent_below_peak(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"])
        run(eng, clock)
        gw.balance = 12_000; run(eng, clock)                    # novo pico
        self.assertEqual(eng.peak, 12_000)
        gw.balance = 12_000 * 0.95 - 1                          # caiu 5% abaixo do pico
        run(eng, clock)
        self.assertEqual(store.settings["mode"], "sim")
        self.assertFalse(store.settings["enabled"]); self.assertFalse(store.settings["real_unlocked"]); self.assertTrue(store.settings["real_locked"])
        self.assertTrue(any(k == "real_revert" for k, _, _ in store.alerts))
        sig.fire(); run(eng, clock, 3, dt=20)
        self.assertEqual(gw.connect_calls[-1], "ClearInvestimentos-DEMO")        # reconectou na DEMO

    def test_peak_survives_restart(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"])
        run(eng, clock); gw.balance = 11_000; run(eng, clock)
        self.assertEqual(store.kv["b3_real_peak"], 11_000)
        eng2 = Engine(gw, store, Config(allow_real=True), SECRETS, now_fn=clock.now, mono_fn=clock.mono, signal_fn=sig)
        run(eng2, clock); self.assertEqual(eng2.peak, 11_000)

    def test_9_percent_drop_does_not_trigger(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"])
        run(eng, clock); gw.balance = 10_000; run(eng, clock); gw.balance = 9_600; run(eng, clock)
        self.assertEqual(store.settings["mode"], "real")

    def test_daily_loss_limit_stops_the_day_in_real_too(self):
        eng, gw, store, clock, sig = make(dict(mode="real", real_locked=False, real_unlocked=True, symbols=["WIN"], daily_loss_brl=40, stop_points_win=240, risk_per_trade_brl=60, profile="moderado"), cfg=Config(allow_real=True))
        run(eng, clock)
        for _ in range(3):
            sig.fire(); run(eng, clock)
            if gw.positions():
                gw.move("WINZ26", gw.positions()[0].sl - 5); run(eng, clock)
        self.assertTrue(store.has_log("LIMITE DE PERDA DIÁRIO"))
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])


class Roll(unittest.TestCase):
    def test_rollover_uses_the_next_contract_and_never_the_expired_one(self):
        from datetime import date
        from hexadesk_connector.fake_mt5 import WDO_SPEC, WIN_SPEC
        gw = FakeGateway(symbols={"WINZ26": WIN_SPEC, "WING27": WIN_SPEC, "WDOZ26": WDO_SPEC, "WDOF27": WDO_SPEC})
        eng, gw, store, clock, sig = make(gw=gw)
        self.assertEqual(eng._contract("WIN", date(2026, 12, 1)), "WINZ26")
        self.assertEqual(eng._contract("WIN", date(2026, 12, 15)), "WING27")      # vencimento 16/12: já rolou
        self.assertEqual(eng._contract("WIN", date(2026, 12, 17)), "WING27")
        self.assertEqual(eng._contract("WDO", date(2026, 12, 30)), "WDOF27")      # WDO rola no último dia útil do mês


class Orphans(unittest.TestCase):
    """Reiniciar o conector não pode deixar posição 'esquecida', duplicar ordem nem deixar linha aberta no painel."""
    def test_open_position_is_adopted_after_restart_and_closed_in_the_panel(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]))
        run(eng, clock); sig.fire(); run(eng, clock)
        p = gw.positions()[0]
        eng2 = Engine(gw, store, Config(), SECRETS, now_fn=clock.now, mono_fn=clock.mono, signal_fn=sig)    # "reiniciou"
        run(eng2, clock)
        self.assertIn(p.ticket, eng2.tracked)
        self.assertEqual(len(store.trades), 1)                  # não duplicou a linha
        gw.move("WINZ26", p.sl - 5); run(eng2, clock)
        self.assertEqual(store.trades[0]["status"], "closed")   # o painel reflete a saída
        self.assertLess(store.trades[0]["pnl"], 0)

    def test_position_closed_while_connector_was_down_is_closed_in_the_panel(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]))
        run(eng, clock); sig.fire(); run(eng, clock)
        p = gw.positions()[0]
        gw.move("WINZ26", p.sl - 5)                             # stop bateu com o conector desligado
        eng2 = Engine(gw, store, Config(), SECRETS, now_fn=clock.now, mono_fn=clock.mono, signal_fn=sig)
        run(eng2, clock)
        self.assertEqual(store.trades[0]["status"], "closed")
        self.assertEqual(store.trades[0]["close_reason"], "fechada enquanto o conector estava parado")

    def test_unregistered_position_is_adopted_and_flattened_at_close(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"]))
        run(eng, clock)
        gw.send_order("WINZ26", "buy", 1, 129_850, 130_225, "hexadesk")      # posição sem linha no painel
        run(eng, clock, 2, dt=40)
        self.assertEqual(len(store.trades), 1); self.assertTrue(store.has_log("sem registro no painel"))
        clock.set(17, 31); run(eng, clock)
        self.assertEqual(gw.positions(), [])                    # zerada às 17:30 como as outras

    def test_no_duplicate_order_for_the_same_candle(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"], max_trades_per_day=10))
        run(eng, clock)
        sig.pending = ("buy", 1.0); run(eng, clock)
        sig.pending = ("buy", 1.0); run(eng, clock, 3)           # o MESMO candle sinalizado de novo
        self.assertEqual(len(store.trades), 1)

    def test_every_order_has_a_server_side_stop_and_second_asset_never_doubles(self):
        eng, gw, store, clock, sig = make()
        eng.signal_fn = lambda c: ("buy", float(len(c)))
        run(eng, clock, 4)
        self.assertEqual(len({p.symbol[:3] for p in gw.positions()}), len(gw.positions()))   # no máx. 1 por ativo
        self.assertTrue(all(p.sl > 0 for p in gw.positions()))


if __name__ == "__main__":
    unittest.main()


def setUpModule():      # estes testes cobrem o MOTOR (stops fixos, limites…); as regras v2 têm testes próprios em test_safety.py
    import hexadesk_connector.engine as _E
    _E.DEFAULT_RULES = "legacy"


def tearDownModule():
    import hexadesk_connector.engine as _E
    _E.DEFAULT_RULES = "v2"
