import os
import sys
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector import safety  # noqa: E402
from hexadesk_connector.config import Config  # noqa: E402
from hexadesk_connector.engine import Engine  # noqa: E402
from hexadesk_connector.fake_mt5 import FakeGateway  # noqa: E402
from tests.test_engine import SECRETS, SP, Clock, Signals, run  # noqa: E402
from hexadesk_connector.store import MemoryStore  # noqa: E402

SET = dict(enabled=True, mode="sim", real_unlocked=False, real_locked=True, symbols=["WIN"], profile="moderado", risk_per_trade_brl=60, max_contracts=3,
           daily_loss_brl=5000, daily_target_brl=None, max_trades_per_day=10, stop_points_win=150, stop_points_wdo=5, rr=1.5,
           open_from="09:05", open_until="17:00", flat_at="17:30")


def bars(n=80, rng=60.0, base=130_000.0):
    return [(1_000_000 + i * 300, base, base + rng, base - rng, base, 100) for i in range(n)]      # ATR = 2 × rng = 120


def make(settings=None, hour=10, minute=0):
    clock, sig = Clock(h=hour, mi=minute), Signals()
    gw = FakeGateway()
    gw.bars["WINZ26"] = bars()
    store = MemoryStore({**SET, **(settings or {})})
    eng = Engine(gw, store, Config(), SECRETS, now_fn=clock.now, mono_fn=clock.mono, signal_fn=sig, rules="v2")
    return eng, gw, store, clock, sig


class Rules(unittest.TestCase):
    def test_first_15_minutes_are_forbidden_even_if_panel_allows_0905(self):
        eng, gw, store, clock, sig = make(hour=9, minute=10)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        clock.set(9, 15); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)

    def test_stop_is_technical_atr_based_and_target_is_at_least_1_to_1_5(self):
        eng, gw, store, clock, sig = make(dict(rr=1.0))          # painel pede 1:1 → o motor força 1:1,5
        run(eng, clock); sig.fire(); run(eng, clock)
        p = gw.positions()[0]
        self.assertEqual(p.price_open - p.sl, 120)               # 1×ATR (estrutura = 95 < 1×ATR)
        self.assertEqual(p.tp - p.price_open, 180)               # 1,5 × stop
        self.assertEqual(p.volume, 2)                            # risco 60 / (120 × 0,20)
        t = store.trades[0]
        self.assertEqual(t["atr_pts"], 120.0)
        self.assertTrue(t["why"].startswith("Comprei"))

    def test_stop_uses_structure_when_it_is_beyond_one_atr(self):
        eng, gw, store, clock, sig = make(dict(risk_per_trade_brl=120))
        b = bars(); b[-3] = (b[-3][0], 130_000, 130_060, 129_700, 130_000, 100)     # fundo recente bem abaixo
        gw.bars["WINZ26"] = b
        run(eng, clock); sig.fire(); run(eng, clock)
        p = gw.positions()[0]
        self.assertGreater(p.price_open - p.sl, 300)             # além do fundo (129.700 − 0,25×ATR) — nunca stop "aleatório"
        self.assertLessEqual(p.price_open - p.sl, 3 * 120)

    def test_setup_whose_technical_stop_does_not_fit_the_risk_is_refused(self):
        eng, gw, store, clock, sig = make(dict(risk_per_trade_brl=20, profile="conservador"))
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertTrue(store.has_log("maior que o risco permitido"))

    def test_two_losses_in_a_row_stop_the_day(self):
        eng, gw, store, clock, sig = make()
        run(eng, clock)
        for i in range(2):
            sig.fire(); run(eng, clock)
            p = gw.positions()[0]
            gw.move("WINZ26", p.sl - 5); run(eng, clock)            # stop no servidor
            self.assertEqual(gw.positions(), [])
        self.assertTrue(store.has_log("2 PERDAS SEGUIDAS"))
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [], "depois de 2 perdas seguidas não entra mais hoje")
        self.assertEqual(eng.state, "halted")

    def test_a_win_resets_the_losing_streak(self):
        eng, gw, store, clock, sig = make()
        run(eng, clock)
        sig.fire(); run(eng, clock); gw.move("WINZ26", gw.positions()[0].sl - 5); run(eng, clock)      # perda
        sig.fire(); run(eng, clock); gw.move("WINZ26", gw.positions()[0].tp + 5); run(eng, clock)      # ganho
        sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)                  # continua operando
        self.assertEqual(eng.day_losses, 0)

    def test_no_entry_near_strong_news_even_with_layers_off(self):
        eng, gw, store, clock, sig = make(hour=11, minute=35)       # abertura de NY = 09:30 ET = 11:30 em Brasília (horário padrão dos EUA)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertTrue(store.has_log("abertura de Nova York"))
        clock.set(12, 0); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)

    def test_user_calendar_event_blocks_entry(self):
        eng, gw, store, clock, sig = make()
        store.events = [{"starts_at": datetime(2026, 11, 9, 10, 10, tzinfo=SP), "title": "Copom"}]
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])

    def test_blocks_proved_by_diagnosis_are_respected(self):
        eng, gw, store, clock, sig = make()
        eng.blocks = {"hours": ["10:00"]}
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        eng.blocks = {"sides": ["buy"]}
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        eng.blocks = {}
        sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)

    def test_size_never_grows_after_a_loss(self):
        eng, gw, store, clock, sig = make()
        run(eng, clock)
        sig.fire(); run(eng, clock); first = gw.positions()[0].volume
        gw.move("WINZ26", gw.positions()[0].sl - 5); run(eng, clock)
        sig.fire(); run(eng, clock)
        self.assertLessEqual(gw.positions()[0].volume, first)     # proibido aumentar a mão para recuperar

    def test_costs_are_recorded_separately_gross_vs_net(self):
        eng, gw, store, clock, sig = make()
        gw.fee_rt = {"WIN": 0.5}; gw.stop_slip_ticks = 1
        run(eng, clock); sig.fire(); run(eng, clock)
        p = gw.positions()[0]; vol = p.volume
        gw.move("WINZ26", p.sl - 5); run(eng, clock)
        t = store.trades[0]
        self.assertAlmostEqual(t["fees"], 0.5 * vol)
        self.assertLess(t["pnl"], t["gross_pnl"])                 # líquido pior que bruto
        self.assertAlmostEqual(t["gross_pnl"] - t["fees"], t["pnl"], places=2)

    def test_new_trade_must_fit_in_what_is_left_of_the_daily_loss_limit(self):
        eng, gw, store, clock, sig = make(dict(daily_loss_brl=40))      # cada operação arrisca ~R$ 24 por contrato
        run(eng, clock)
        sig.fire(); run(eng, clock); self.assertEqual(gw.positions()[0].volume, 1)      # cabem só 1 contrato (R$ 24) nos R$ 40
        gw.move("WINZ26", gw.positions()[0].sl - 5); run(eng, clock)      # perde ~R$ 24; sobram R$ 16
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [], "sobram R$ 16 e a operação arrisca R$ 24: não entra (o limite nunca é estourado)")
        self.assertTrue(store.has_log("sobra só"))
        eng2, gw2, store2, clock2, sig2 = make(dict(daily_loss_brl=30, risk_per_trade_brl=60))
        run(eng2, clock2); sig2.fire(); run(eng2, clock2)
        self.assertEqual(gw2.positions()[0].volume, 1, "com R$ 30 de limite só cabe 1 contrato (R$ 24), nunca 2 (R$ 48)")
        sig2.fire(); run(eng2, clock2)
        self.assertEqual(len(gw2.positions()), 1, "já há uma aberta arriscando R$ 24: não cabe outra no mesmo ativo/limite")

    def test_helpers(self):
        self.assertEqual(safety.effective_rr(0.5), 1.5)
        self.assertEqual(safety.effective_rr(2.0), 2.0)
        self.assertIsNone(safety.technical_stop(bars(10), "buy", 130_000, 5, 500)[0])


if __name__ == "__main__":
    unittest.main()


class Emergency(unittest.TestCase):
    def test_kill_switch_flattens_disables_and_blocks_everything(self):
        eng, gw, store, clock, sig = make()
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        store.kv["kill_switch"] = {"on": True, "reason": "perdas reais"}
        clock.advance(15); run(eng, clock)
        self.assertEqual(gw.positions(), [])                                  # zerou
        self.assertFalse(store.settings["enabled"]); self.assertEqual(store.settings["mode"], "sim"); self.assertTrue(store.settings["real_locked"])
        self.assertEqual(eng.state, "halted")
        store.settings["enabled"] = True                                      # mesmo religado na mão, não opera
        sig.fire(); run(eng, clock, 3, dt=20)
        self.assertEqual(gw.positions(), [])
        self.assertEqual(len(store.trades), 1)

    def test_switch_off_releases_only_the_lock_not_the_robot(self):
        eng, gw, store, clock, sig = make()
        store.kv["kill_switch"] = {"on": True}
        run(eng, clock, 2, dt=15)
        store.kv["kill_switch"] = {"on": False}
        store.settings["enabled"] = False
        clock.advance(15); run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])                                  # desligado continua desligado
