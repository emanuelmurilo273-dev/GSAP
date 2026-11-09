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
            eng, gw, store, clock, sig = make(dict(mode="real", real_unlocked=unlocked, symbols=["WIN"]), cfg=Config(allow_real=allow))
            run(eng, clock); sig.fire(); run(eng, clock)
            self.assertEqual(len(gw.positions()), expect, f"allow={allow} unlocked={unlocked}")

    def test_real_mode_refuses_demo_account(self):
        eng, gw, store, clock, sig = make(dict(mode="real", real_unlocked=True), gw=FakeGateway(mode="demo"), cfg=Config(allow_real=True))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])

    def test_switching_to_simulator_flattens_disables_and_reconnects_demo(self):
        eng, gw, store, clock, sig = make(dict(mode="real", real_unlocked=True, symbols=["WIN"]), cfg=Config(allow_real=True))
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


class RealLimited(unittest.TestCase):
    """Modo REAL LIMITADO (estratégia não validada): tetos valem ACIMA das configurações, mesmo que o painel mande mais."""
    def real(self, **over):
        return make(dict(mode="real", real_unlocked=True, real_limited=True, max_contracts=30, daily_loss_brl=5000, max_trades_per_day=40,
                         risk_per_trade_brl=900, profile="agressivo", **over), cfg=Config(allow_real=True))

    def test_contracts_capped_at_one(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"])
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        self.assertEqual(gw.positions()[0].volume, 1)          # painel pedia até 30

    def test_only_one_position_at_a_time_in_total(self):
        eng, gw, store, clock, sig = self.real()
        eng.signal_fn = lambda c: ("buy", float(len(c) + clock.m))   # sinal em todos os ativos
        run(eng, clock, 3)
        self.assertEqual(len(gw.positions()), 1)               # WIN e WDO liberados, mas só 1 aberta

    def test_max_three_trades_a_day(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"])
        run(eng, clock)
        for _ in range(6):
            sig.fire(); run(eng, clock)
            for p in gw.positions(): gw.close_position(p)
            run(eng, clock)
        self.assertEqual(len(store.trades), 3)

    def test_stop_too_wide_for_the_risk_cap_is_refused(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"], stop_points_win=1000)   # 1 contrato = R$ 200 de risco > teto de R$ 50
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertTrue(store.has_log("não comporta nem 1 contrato"))

    def test_daily_loss_cap_is_100_even_if_panel_says_5000(self):
        from hexadesk_connector.engine import effective_settings
        e = effective_settings(dict(BASE, mode="real", real_limited=True, daily_loss_brl=5000, max_contracts=9, max_trades_per_day=40, risk_per_trade_brl=900, profile="agressivo"))
        self.assertEqual((e["daily_loss_brl"], e["max_contracts"], e["max_trades_per_day"], e["risk_per_trade_brl"], e["profile"]), (100.0, 1, 3, 50.0, "conservador"))
        self.assertEqual(effective_settings(dict(BASE, mode="real", real_limited=True, daily_loss_brl=40))["daily_loss_brl"], 40.0)   # menor é mantido
        self.assertEqual(effective_settings(dict(BASE, mode="sim", real_limited=True, daily_loss_brl=5000))["daily_loss_brl"], 5000)   # só vale no REAL

    def test_three_losses_trigger_the_100_real_limit_not_the_5000(self):
        eng, gw, store, clock, sig = self.real(symbols=["WIN"], stop_points_win=240)    # perda por operação = R$ 48 (cabe no teto de R$ 50)
        run(eng, clock)
        for _ in range(3):
            sig.fire(); run(eng, clock)
            p = gw.positions()[0]
            gw.move("WINZ26", p.sl - 5)
            run(eng, clock)
        self.assertTrue(store.has_log("LIMITE DE PERDA DIÁRIO"))   # -R$ 144 passou do teto de R$ 100 (o painel dizia R$ 5000)
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])

    def test_unlimited_real_mode_is_not_capped(self):
        eng, gw, store, clock, sig = make(dict(mode="real", real_unlocked=True, real_limited=False, max_contracts=3, risk_per_trade_brl=600, profile="agressivo", symbols=["WIN"]), cfg=Config(allow_real=True))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions()[0].volume, 3)


if __name__ == "__main__":
    unittest.main()
