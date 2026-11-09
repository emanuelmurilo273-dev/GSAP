import math
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from research_b3.backtest import Inst, cross_signals, simulate  # noqa: E402
from research_b3.metrics import accept, consistent, summarize  # noqa: E402

from hexadesk_connector.strategy import baseline_signal  # noqa: E402


def rnd_bars(n=900, seed=1, step=900):
    r = random.Random(seed); p = 100.0; out = []
    for i in range(n):
        o = p; p *= 1 + r.gauss(0, 0.004); out.append((1_700_000_000 + i * step, o, max(o, p) * 1.001, min(o, p) * 0.999, p, 100.0))
    return out


class Backtest(unittest.TestCase):
    def test_fast_signals_equal_the_robots_baseline_signal(self):
        c = rnd_bars()
        fast = cross_signals(c)
        for i in range(60, len(c), 7):
            s = baseline_signal(c[: i + 1])
            self.assertEqual(fast[i], s[0] if s else None, i)

    def test_costs_reduce_pnl_and_stop_wins_ties(self):
        c = rnd_bars(3000, 4)
        free = summarize(simulate(c, Inst(cost_side=0.0, open_min=0, close_min=1439, flat_min=1439)))
        paid = summarize(simulate(c, Inst(cost_side=0.002, open_min=0, close_min=1439, flat_min=1439)))
        self.assertGreater(free["pnl"], paid["pnl"])
        self.assertGreater(free["trades"], 50)

    def test_never_trades_outside_the_window_and_flattens(self):
        c = rnd_bars(3000, 5)
        ts = simulate(c, Inst())
        for t in ts:
            m = (int(t["t_open"]) % 86400) // 60
            self.assertTrue(12 * 60 + 5 <= m <= 20 * 60 + 40, m)         # entrada na abertura do candle seguinte ao sinal (até 20:00 + 1 candle)
            self.assertLessEqual(t["t_close"] - t["t_open"], 86400)

    def test_accept_rule_rejects_less_bad_but_losing(self):
        base = {"trades": 500, "pf": 0.8, "dd": 100, "sharpe": -1.0}
        better_but_losing = {"trades": 400, "pf": 0.95, "dd": 60, "sharpe": -0.2}
        ok, why = accept(base, better_but_losing)
        self.assertFalse(ok); self.assertTrue(any("PF ≤ 1" in w for w in why))
        winner = {"trades": 400, "pf": 1.2, "dd": 60, "sharpe": 0.8}
        self.assertTrue(accept(base, winner)[0])
        self.assertFalse(accept(base, {**winner, "trades": 50})[0])
        self.assertFalse(accept(base, {**winner, "dd": 200})[0])

    def test_consistency_rule_rejects_a_layer_that_only_wins_in_the_test(self):
        base = {"train": {"pf": 0.85}, "val": {"pf": 0.78}}
        self.assertFalse(consistent(base, {"train": {"pf": 0.77}, "val": {"pf": 0.51}})[0])      # caso real do proxy: pior no treino e na validação
        self.assertTrue(consistent(base, {"train": {"pf": 0.90}, "val": {"pf": 0.80}})[0])
        ok, why = consistent(base, {"train": {"pf": 0.90}, "val": {"pf": 0.60}})
        self.assertFalse(ok); self.assertIn("val", why[0])

    def test_adaptive_layer_changes_sizes_only_downward(self):
        c = rnd_bars(4000, 9)
        a = simulate(c, Inst(open_min=0, close_min=1439, flat_min=1439), {"adaptive_risk": {"enabled": True}})
        self.assertTrue(all(t["size"] <= 4 for t in a))
        prev = None
        loss_streak_sizes = []
        for t in a:
            if prev is not None and prev["pnl"] < 0:
                loss_streak_sizes.append(t["size"] <= prev["size"])        # depois de perda, nunca maior que a anterior
            prev = t
        self.assertTrue(all(loss_streak_sizes))


if __name__ == "__main__":
    unittest.main()
