import math
import os
import random
import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector.intel import flow as flowmod  # noqa: E402
from hexadesk_connector.intel import ml  # noqa: E402
from hexadesk_connector.intel.news import NewsFilter  # noqa: E402
from hexadesk_connector.intel.pipeline import DEFAULT_CONFIG, IntelPipeline  # noqa: E402
from hexadesk_connector.intel.regime import LATERAL, TENDENCIA, VOLATIL, classify  # noqa: E402
from hexadesk_connector.risk import adaptive_size  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")


def bars(n, price, noise=2.0, seed=1, base=100.0, tail_mult=1.0, tail=0):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        p = price(i)
        k = noise * (tail_mult if i >= n - tail else 1.0)
        o, c = p + rnd.uniform(-k, k) * 0.3, p + rnd.uniform(-k, k) * 0.3
        out.append((i * 300, o, max(o, c) + rnd.uniform(0, k), min(o, c) - rnd.uniform(0, k), c, 100 + rnd.randint(0, 20)))
    return out


class Regime(unittest.TestCase):
    def test_trend_range_volatile_and_insufficient_data(self):
        trend = bars(300, lambda i: 1000 + i * 3.0, noise=2.0)
        rng = bars(300, lambda i: 1000 + 12 * math.sin(i / 3.0), noise=2.0)
        vol = bars(300, lambda i: 1000 + 12 * math.sin(i / 3.0), noise=2.0, tail_mult=12, tail=15)
        self.assertEqual(classify(trend)["regime"], TENDENCIA)
        self.assertEqual(classify(rng)["regime"], LATERAL)
        self.assertEqual(classify(vol)["regime"], VOLATIL)
        self.assertEqual(classify(trend[:30])["regime"], "indefinido")

    def test_returns_the_numbers_behind_the_decision(self):
        r = classify(bars(300, lambda i: 1000 + i * 3.0))
        self.assertGreater(r["adx"], 25)
        self.assertTrue(0 <= r["vol_rank"] <= 1)


class Flow(unittest.TestCase):
    F = {"trades": 40, "imbalance": 0.4, "book_imbalance": 0.2}

    def test_confirms_only_with_aggressors_on_our_side(self):
        self.assertTrue(flowmod.confirms("buy", self.F)[0])
        self.assertFalse(flowmod.confirms("sell", self.F)[0])
        self.assertTrue(flowmod.confirms("sell", {"trades": 40, "imbalance": -0.4, "book_imbalance": -0.2})[0])

    def test_book_against_blocks_and_missing_data_never_confirms(self):
        self.assertFalse(flowmod.confirms("buy", {**self.F, "book_imbalance": -0.3})[0])
        self.assertTrue(flowmod.confirms("buy", {**self.F, "book_imbalance": -0.3}, use_book=False)[0])
        ok, why = flowmod.confirms("buy", None)
        self.assertFalse(ok); self.assertIn("sem fluxo", why)
        self.assertFalse(flowmod.confirms("buy", {**self.F, "trades": 2})[0])


class News(unittest.TestCase):
    def test_us_open_follows_us_daylight_saving(self):
        f = NewsFilter(15)
        # novembro (horário padrão dos EUA): 09:30 ET = 11:30 em Brasília
        self.assertEqual(f.blocked(datetime(2026, 11, 9, 11, 20, tzinfo=SP))[0], True)
        self.assertEqual(f.blocked(datetime(2026, 11, 9, 11, 50, tzinfo=SP))[0], False)
        self.assertEqual(f.blocked(datetime(2026, 11, 9, 10, 20, tzinfo=SP))[0], False)   # seria o horário de verão: NÃO é agora
        # julho (horário de verão dos EUA): 09:30 EDT = 10:30 em Brasília
        self.assertEqual(f.blocked(datetime(2026, 7, 15, 10, 20, tzinfo=SP))[0], True)
        self.assertEqual(f.blocked(datetime(2026, 7, 15, 11, 20, tzinfo=SP))[0], False)

    def test_window_is_15_minutes_before_and_after_and_message_says_when(self):
        f = NewsFilter(15)
        b, why = f.blocked(datetime(2026, 11, 9, 11, 15, tzinfo=SP))
        self.assertTrue(b); self.assertIn("em 15 min", why)
        b, why = f.blocked(datetime(2026, 11, 9, 11, 45, tzinfo=SP))
        self.assertTrue(b); self.assertIn("há 15 min", why)
        self.assertFalse(f.blocked(datetime(2026, 11, 9, 11, 46, tzinfo=SP))[0])

    def test_user_calendar_events_and_payroll_first_friday(self):
        f = NewsFilter(15, recurring=False)
        ev = [{"starts_at": datetime(2026, 11, 4, 18, 30, tzinfo=SP), "title": "Copom"}]
        b, why = f.blocked(datetime(2026, 11, 4, 18, 20, tzinfo=SP), ev)
        self.assertTrue(b); self.assertEqual(why, "Copom em 10 min")
        self.assertFalse(f.blocked(datetime(2026, 11, 4, 17, 0, tzinfo=SP), ev)[0])
        g = NewsFilter(15)                                   # 1ª sexta de novembro/2026 = dia 6: payroll 08:30 ET = 10:30 BRT
        self.assertIn("payroll", g.blocked(datetime(2026, 11, 6, 10, 25, tzinfo=SP))[1])
        self.assertNotIn("payroll", g.blocked(datetime(2026, 11, 13, 10, 25, tzinfo=SP))[1])   # 2ª sexta: sem payroll
        self.assertTrue(NewsFilter(15).blocked(datetime(2026, 11, 7, 11, 30, tzinfo=SP))[0] is False)   # sábado: sem evento


class AdaptiveRisk(unittest.TestCase):
    def test_reduces_after_two_losses_and_on_volatile_days(self):
        self.assertEqual(adaptive_size(3, 0, None, False), 3)
        self.assertEqual(adaptive_size(4, 1, 4, False), 4)
        self.assertEqual(adaptive_size(4, 2, 4, False), 2)
        self.assertEqual(adaptive_size(4, 0, None, True), 2)
        self.assertEqual(adaptive_size(4, 2, 4, True), 1)
        self.assertEqual(adaptive_size(1, 3, 1, True), 1)          # nunca abaixo de 1 quando há base
        self.assertEqual(adaptive_size(0, 3, 1, True), 0)

    def test_never_martingale_property(self):
        """Em qualquer sequência de resultados, depois de uma perda a mão NUNCA é maior que a anterior, nem maior que a base."""
        rnd = random.Random(42)
        for _ in range(300):
            base, streak, last = rnd.randint(1, 6), 0, None
            for _ in range(40):
                n = adaptive_size(base, streak, last, rnd.random() < 0.2, enabled=rnd.random() < 0.8)
                self.assertLessEqual(n, base)
                if streak > 0 and last is not None:
                    self.assertLessEqual(n, last)
                streak = 0 if rnd.random() < 0.45 else streak + 1
                last = n


class Pipeline(unittest.TestCase):
    def ctx(self, **kw):
        c = bars(300, lambda i: 1000 + i * 3.0)
        return {"side": "buy", "candles": c, "now": datetime(2026, 11, 9, 14, 0, tzinfo=SP), "flow": None, "user_events": [], "symbol": "WINZ26", **kw}

    def test_default_config_changes_nothing(self):
        d = IntelPipeline().evaluate(self.ctx())
        self.assertTrue(d.allow); self.assertEqual(d.layers, [])
        self.assertFalse(IntelPipeline().any_enabled)

    def test_each_layer_alone_blocks_with_a_plain_reason(self):
        lat = bars(300, lambda i: 1000 + 12 * math.sin(i / 3.0))
        vol = bars(300, lambda i: 1000 + 12 * math.sin(i / 3.0), tail_mult=12, tail=15)
        d = IntelPipeline({"regime": {"enabled": True}}).evaluate(self.ctx(candles=lat))
        self.assertFalse(d.allow); self.assertEqual(d.reason, "Não entrei: mercado lateral")
        d = IntelPipeline({"regime": {"enabled": True}}).evaluate(self.ctx(candles=vol))
        self.assertEqual(d.reason, "Não entrei: mercado volátil demais")
        self.assertTrue(IntelPipeline({"regime": {"enabled": True}}).evaluate(self.ctx()).allow)          # tendência passa
        d = IntelPipeline({"news": {"enabled": True}}).evaluate(self.ctx(now=datetime(2026, 11, 9, 11, 20, tzinfo=SP)))
        self.assertEqual(d.reason, "Não entrei: abertura de Nova York em 10 min")
        d = IntelPipeline({"flow": {"enabled": True}}).evaluate(self.ctx())
        self.assertIn("Não entrei: sem fluxo", d.reason)
        d = IntelPipeline({"flow": {"enabled": True}}).evaluate(self.ctx(flow={"trades": 50, "imbalance": 0.5, "book_imbalance": 0.3}))
        self.assertTrue(d.allow)

    def test_ml_layer_fails_safe(self):
        d = IntelPipeline({"ml": {"enabled": True}}).evaluate(self.ctx())
        self.assertFalse(d.allow); self.assertIn("modelo não configurado", d.reason)
        d = IntelPipeline({"ml": {"enabled": True, "model_path": "/nao/existe.txt", "threshold": 0.5}}).evaluate(self.ctx())
        self.assertFalse(d.allow)                                     # sem modelo carregável: NÃO entra

    def test_layers_are_independent(self):
        cfg = {"news": {"enabled": True}, "regime": {"enabled": True}}
        d = IntelPipeline(cfg).evaluate(self.ctx())
        self.assertTrue(d.allow); self.assertEqual(d.layers, ["noticias", "regime"])


class MLBasics(unittest.TestCase):
    def test_triple_barrier_rules(self):
        c = [(0, 100, 100, 100, 100, 1), (1, 100, 101, 99, 100, 1), (2, 100, 100, 100, 100, 1), (3, 100, 100, 100, 100, 1)]
        # sinal no candle 0 → entrada na abertura do 1 (preço 100); stop 1 e alvo 1,5: no candle 1 low 99 (stop) e high 101 (não chega a 101,5)
        self.assertEqual(ml.triple_barrier(c, 0, "buy", 1, 1.5, 5)[:2], (0, 1))
        both = [(0, 100, 100, 100, 100, 1), (1, 100, 103, 98, 100, 1)]
        self.assertEqual(ml.triple_barrier(both, 0, "buy", 1, 1.5, 5)[0], 0)        # os dois no mesmo candle: STOP vence
        tgt = [(0, 100, 100, 100, 100, 1), (1, 100, 102, 99.5, 101, 1)]
        self.assertEqual(ml.triple_barrier(tgt, 0, "buy", 1, 1.5, 5)[:3], (1, 1, 1.5))
        self.assertEqual(ml.triple_barrier(tgt, 0, "sell", 1, 1.5, 5)[0], 0)        # venda: o mesmo candle é adverso
        t = [(0, 100, 100, 100, 100, 1), (1, 100, 100.4, 99.8, 100.2, 1), (2, 100.2, 100.5, 100.0, 100.4, 1)]
        y, end, pnl = ml.triple_barrier(t, 0, "buy", 1, 1.5, 5, cost=0.1)            # fim dos candles: sinal do resultado
        self.assertEqual((y, end), (1, 2)); self.assertAlmostEqual(pnl, 0.3, places=6)
        self.assertEqual(ml.triple_barrier(t, 0, "buy", 1, 1.5, 5, end_idx=1)[1], 1)  # zeragem da sessão encerra o rótulo

    def test_auc(self):
        self.assertEqual(ml.auc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]), 1.0)
        self.assertEqual(ml.auc([0, 0, 1, 1], [0.9, 0.8, 0.2, 0.1]), 0.0)
        self.assertEqual(ml.auc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]), 0.5)

    def test_purged_walk_forward_has_no_overlap_with_the_test_period(self):
        rnd = random.Random(3)
        t0 = sorted(rnd.randint(0, 5000) for _ in range(900))
        t1 = [t + rnd.randint(1, 80) for t in t0]
        folds = list(ml.purged_walk_forward(t0, t1, n_splits=5, embargo=10))
        self.assertEqual(len(folds), 5)
        for tr, te in folds:
            start = min(t0[i] for i in te)
            self.assertTrue(tr and te)
            self.assertTrue(all(t1[i] < start - 10 for i in tr), "treino com rótulo que invade o período de teste")
            self.assertFalse(set(tr) & set(te))
            self.assertTrue(max(t0[i] for i in tr) < start)                           # treino sempre ANTES do teste
        self.assertTrue(len(folds[-1][0]) > len(folds[0][0]))                          # janela expansiva

    def test_features_are_causal_no_lookahead(self):
        c = bars(400, lambda i: 1000 + 20 * math.sin(i / 11.0) + i * 0.2, seed=5)
        full = ml.precompute(c)
        for i in (80, 150, 250, 399):
            part = ml.precompute(c[: i + 1])
            a = ml.features_at(c[: i + 1], part, i, "buy")
            b = ml.features_at(c, full, i, "buy")
            for x, y in zip(a, b):
                self.assertTrue((math.isnan(x) and math.isnan(y)) or abs(x - y) < 1e-9, (i, a, b))
        c2 = list(c)                                                                 # mexer no FUTURO não pode mudar a feature de i
        for j in range(201, 400):
            c2[j] = (c2[j][0], 5.0, 9.0, 1.0, 7.0, 1)
        self.assertEqual(ml.features_at(c, full, 200, "sell")[:9], ml.features_at(c2, ml.precompute(c2), 200, "sell")[:9])


@unittest.skipUnless(ml.ml_available(), "lightgbm/numpy não instalados (pip install -r requirements-ml.txt)")
class MLTraining(unittest.TestCase):
    def fake_ds(self, n, informative, seed=0):
        rnd = random.Random(seed)
        X, y, t0, t1, pnl = [], [], [], [], []
        for i in range(n):
            x = [rnd.gauss(0, 1) for _ in range(len(ml.FEATURES))]
            p = 0.5 + (0.30 * math.tanh(x[0]) if informative else 0.0)
            lab = 1 if rnd.random() < p else 0
            X.append(x); y.append(lab); t0.append(i * 3); t1.append(i * 3 + rnd.randint(1, 20)); pnl.append(1.5 if lab else -1.0)
        return {"X": X, "y": y, "t0": t0, "t1": t1, "pnl": pnl, "side": ["buy"] * n}

    def test_shuffled_labels_give_no_edge(self):
        r = ml.oos_evaluation(self.fake_ds(1500, informative=False, seed=1), n_splits=5)
        self.assertGreater(r["samples"], 800)
        self.assertTrue(0.44 < r["auc"] < 0.56, f"AUC {r['auc']} deveria ser ~0,5 com rótulos aleatórios")

    def test_learns_a_real_signal_out_of_sample(self):
        r = ml.oos_evaluation(self.fake_ds(1500, informative=True, seed=2), n_splits=5)
        self.assertGreater(r["auc"], 0.68)
        self.assertGreater(r["filtered"]["avg"], r["base"]["avg"])      # filtrar por probabilidade melhora a média fora da amostra

    def test_model_roundtrip_and_prediction_range(self):
        ds = self.fake_ds(600, informative=True, seed=3)
        m = ml.train(ds["X"], ds["y"])
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "m.txt"); ml.save_model(m, p)
            b = ml.load_model(p)
            a1, a2 = ml.predict(m, ds["X"][:20]), ml.predict_booster(b, ds["X"][:20])
            self.assertTrue(all(0 <= x <= 1 for x in a2))
            self.assertTrue(all(abs(x - y) < 1e-6 for x, y in zip(a1, a2)))

    def test_pipeline_uses_a_trained_model_with_threshold(self):
        import tempfile
        c = bars(300, lambda i: 1000 + i * 3.0)
        pre = ml.precompute(c); i = len(c) - 1
        X = [ml.features_at(c, pre, i, "buy")] * 200 + [ml.features_at(c, pre, i, "sell")] * 200
        m = ml.train(X, [1] * 200 + [0] * 200)                             # "compra nesta situação" sempre vence
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "m.txt"); ml.save_model(m, p)
            ctx = {"side": "buy", "candles": c, "now": datetime(2026, 11, 9, 14, 0, tzinfo=SP), "flow": None, "user_events": []}
            hi = IntelPipeline({"ml": {"enabled": True, "model_path": p, "threshold": 0.5}}).evaluate(ctx)
            self.assertTrue(hi.allow); self.assertGreater(hi.prob, 0.5)
            lo = IntelPipeline({"ml": {"enabled": True, "model_path": p, "threshold": 0.999}}).evaluate(ctx)
            self.assertFalse(lo.allow); self.assertIn("probabilidade", lo.reason)


if __name__ == "__main__":
    unittest.main()
