import os
import random
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ["HEXADESK_DEV"] = "1"
from hexadesk_connector.intel import ml  # noqa: E402
from hexadesk_connector.live import FLAG_BUY, FLAG_SELL, TickRec  # noqa: E402
from hexadesk_connector.retrain import bars_from_ticks, retrain_from_bars  # noqa: E402
from hexadesk_connector.store import MemoryStore  # noqa: E402

S = {"stop_points_win": 150, "stop_points_wdo": 5, "rr": 1.5}


def walk(days=60, seed=1):
    r = random.Random(seed); p = 130000.0; out = []
    for d in range(days):
        base = 1_700_000_000 + d * 86400
        base -= base % 86400
        for k in range(0, 24 * 12):
            t = base + k * 300
            o = p; p = max(1000, p + r.gauss(0, 60)); out.append((t, o, max(o, p) + 20, min(o, p) - 20, p, 100.0))
    return out


class Retrain(unittest.TestCase):
    def test_ticks_to_bars_and_bar_flow(self):
        ticks = [TickRec(1_000_000 + i * 1000, 99, 101, 100 + (i % 3), 5.0, (FLAG_BUY if i % 2 == 0 else FLAG_SELL) | 4 | 8) for i in range(700)]
        bars, imb = bars_from_ticks(ticks)
        self.assertEqual(len(bars), len(imb))
        self.assertTrue(all(b[0] % 300 == 0 for b in bars))
        self.assertTrue(all(-1 <= x <= 1 for x in imb if x == x))
        self.assertAlmostEqual(sum(b[5] for b in bars), 700 * 5.0)

    def test_insufficient_data_registers_nothing(self):
        st = MemoryStore()
        r = retrain_from_bars({"WINZ26": (walk(2)[:250], [0.0] * 250)}, S, {}, Path(tempfile.mkdtemp()), st)
        self.assertIn("insuficientes", r["status"]); self.assertEqual(st.versions, [])

    @unittest.skipUnless(ml.ml_available(), "lightgbm não instalado")
    def test_useless_model_is_never_registered(self):
        """Mercado aleatório: o modelo NÃO deve virar desafiante (não há o que aprender)."""
        st = MemoryStore()
        c = walk(70, 3)
        with tempfile.TemporaryDirectory() as d:
            r = retrain_from_bars({"WINZ26": (c, [random.Random(1).uniform(-1, 1) for _ in c])}, S, {}, Path(d), st)
            self.assertEqual(st.versions, [], r)                      # nada registrado
            self.assertTrue(r["status"].startswith(("modelo NÃO melhorou", "dados insuficientes", "validação", "poucas amostras")), r["status"])
            self.assertEqual(list(Path(d).glob("*.txt")), [])          # nem arquivo de modelo

    def test_random_market_never_passes_the_significance_gate_across_seeds(self):
        if not ml.ml_available():
            self.skipTest("lightgbm não instalado")
        for seed in range(1, 6):
            st = MemoryStore()
            c = walk(90, seed)
            with tempfile.TemporaryDirectory() as d:
                r = retrain_from_bars({"WINZ26": (c, [random.Random(seed).uniform(-1, 1) for _ in c])}, S, {}, Path(d), st)
            self.assertEqual(st.versions, [], f"seed {seed}: {r}")

    def test_auc_lower_bound_is_honest_about_small_samples(self):
        self.assertLess(ml.auc_lower_bound(0.534, 40, 64), 0.5)          # ruído: 0,534 com ~100 amostras
        self.assertGreater(ml.auc_lower_bound(0.62, 400, 600), 0.5)      # sinal real e amostra grande
        self.assertEqual(ml.auc_lower_bound(0.9, 1, 50), 0.0)

    @unittest.skipUnless(ml.ml_available(), "lightgbm não instalado")
    def test_registers_only_a_challenger_never_a_champion(self):
        import hexadesk_connector.retrain as rt
        orig = ml.oos_evaluation
        ml_eval = lambda ds, **k: {"samples": 500, "pos": 200, "neg": 300, "auc": 0.62, "base": {"n": 500, "pf": 0.9, "avg": -0.1}, "filtered": {"n": 200, "pf": 1.2, "avg": 0.2}}
        rt.ml.oos_evaluation = ml_eval                                 # força um "bom resultado" só para testar o registro
        try:
            st = MemoryStore()
            with tempfile.TemporaryDirectory() as d:
                r = retrain_from_bars({"WINZ26": (walk(130, 4), [0.0] * (130 * 288))}, S, {"regime": {"enabled": True}}, Path(d), st)
                self.assertTrue(r["status"].startswith("desafiante registrado"), r)
                self.assertEqual([v["role"] for v in st.versions], ["challenger"])
                cfg = st.versions[0]["config"]
                self.assertTrue(cfg["ml"]["enabled"] and cfg["ml"]["threshold"] and Path(cfg["ml"]["model_path"]).exists())
                self.assertTrue(cfg["regime"]["enabled"])               # herda as camadas do campeão
        finally:
            rt.ml.oos_evaluation = orig


if __name__ == "__main__":
    unittest.main()
