import os
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector.strategies import FAMILIES, signal_fn_for, signals  # noqa: E402
from hexadesk_connector.strategy import baseline_signal  # noqa: E402


def day_bars(n_days=6, seed=3, drift=0.0, step=300, start_min=9 * 60, bars=108):
    rnd = random.Random(seed)
    out, px = [], 130_000.0
    for d in range(n_days):
        for k in range(bars):
            t = (20_000 + d) * 86400 + start_min * 60 + k * step
            o = px
            px = max(1.0, px + rnd.gauss(drift, 60))
            out.append((t, o, max(o, px) + rnd.random() * 20, min(o, px) - rnd.random() * 20, px, 100 + rnd.randint(0, 50)))
    return out


class Families(unittest.TestCase):
    def test_ema_cross_equals_the_robot_baseline(self):
        c = day_bars()
        for i in range(45, len(c), 7):
            sig = signals("ema_cross", c[: i + 1])[-1]
            base = baseline_signal(c[: i + 1])
            self.assertEqual(sig, base[0] if base else None)

    def test_no_lookahead_signal_at_i_ignores_the_future(self):
        c = day_bars()
        for name in FAMILIES:
            full = signals(name, c)
            for i in (80, 200, 333, 500):
                self.assertEqual(signals(name, c[: i + 1])[i], full[i], f"{name} usa o futuro em {i}")

    def test_orb_one_per_side_per_day_and_only_after_first_hour(self):
        c = day_bars(n_days=8, seed=5)
        sig = signals("orb", c)
        per = {}
        for b, s in zip(c, sig):
            if s:
                self.assertGreaterEqual((int(b[0]) % 86400) // 60, 10 * 60)
                per.setdefault((b[0] // 86400, s), 0); per[(b[0] // 86400, s)] += 1
        self.assertTrue(per and max(per.values()) == 1)

    def test_orb_breaks_up_on_a_trending_day(self):
        c = day_bars(n_days=1, drift=25.0)
        self.assertIn("buy", signals("orb", c))

    def test_trend_regime_is_subset_of_cross(self):
        c = day_bars(n_days=10, seed=9, drift=8.0)
        a, b = signals("trend_regime", c), signals("ema_cross", c)
        self.assertTrue(all(x is None or x == y for x, y in zip(a, b)))
        self.assertLess(sum(x is not None for x in a), sum(x is not None for x in b))

    def test_robot_adapter_returns_side_and_candle_time(self):
        c = day_bars(n_days=4)
        fn = signal_fn_for("orb")
        hits = [fn(c[: i + 1]) for i in range(60, len(c))]
        self.assertTrue(any(h for h in hits))
        self.assertTrue(all(h is None or h[1] in {b[0] for b in c} for h in hits))

    def test_all_families_run_on_random_walk_without_error(self):
        c = day_bars(n_days=12, seed=21)
        for name in FAMILIES:
            self.assertEqual(len(signals(name, c)), len(c))


if __name__ == "__main__":
    unittest.main()
