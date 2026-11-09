import unittest
from datetime import datetime, timedelta, timezone

from research_b3 import autopsia as A


def tr(i, pnl, root="WIN", side="buy", day=0, hh=10, ticket=None, fees=0.5, **kw):
    t0 = datetime(2026, 11, 9, hh, 0, tzinfo=timezone.utc) + timedelta(days=day, minutes=i)   # +3 h de diferença para Brasília (UTC→SP)
    return {"status": "closed", "pnl": pnl, "root": root, "contract": root + "Z26", "side": side, "volume": 1, "opened_at": t0.isoformat(), "closed_at": (t0 + timedelta(minutes=5)).isoformat(),
            "price_open": 130000, "price_close": 130000 + pnl * 5, "sl": 129850, "tp": 130225, "stop_points": 150, "ticket": ticket or 1000 + i, "fees": fees, "mode": "sim", "source": "mt5", **kw}


class Autopsia(unittest.TestCase):
    def test_expectancy_matches_the_formula(self):
        rs = A.enrich([tr(i, 40 if i % 5 < 2 else -30) for i in range(50)])
        m = A.metrics(rs)
        self.assertAlmostEqual(m["expect"], m["win"] * m["avg_win"] - (1 - m["win"]) * m["avg_loss"], places=9)
        self.assertAlmostEqual(m["expect"], 0.4 * 40 - 0.6 * 30)

    def test_utc_is_converted_to_sao_paulo_for_hour_buckets(self):
        r = A.enrich([tr(0, 10, hh=13)])[0]
        self.assertEqual(r["slot"], "10:00")                 # 13:00 UTC = 10:00 em Brasília

    def test_blocks_only_suggested_with_proof(self):
        few = A.enrich([tr(i, -30, hh=10) for i in range(8)])
        self.assertEqual(A.suggest_blocks(few), [])           # 8 operações: ruído, não bloqueia
        many = A.enrich([tr(i, -30 + (i % 3) * 2, root="WDO") for i in range(60)] + [tr(100 + i, 20 if i % 2 else -10, root="WIN") for i in range(60)])
        sug = A.suggest_blocks(many)
        self.assertTrue(any("WDO" in s for s in sug))
        self.assertFalse(any("WIN" in s for s in sug))

    def test_verdict_needs_100_oos_trades_and_positive_expectancy(self):
        self.assertEqual(A.verdict(A.enrich([tr(i, 10) for i in range(50)]))["status"], "SEM PROVA")
        self.assertEqual(A.verdict(A.enrich([tr(i, -5 if i % 3 else 3) for i in range(400)]))["status"], "SEM VANTAGEM")
        self.assertEqual(A.verdict(A.enrich([tr(i, 30 if i % 4 else -20) for i in range(400)]))["status"], "COM VANTAGEM")

    def test_integrity_finds_duplicates_missing_stop_and_forbidden_entries(self):
        raw = [tr(0, 10, ticket=7), tr(1, 10, ticket=7), tr(2, 5, hh=12), dict(tr(3, 5), sl=None)]
        txt = " | ".join(f"{a}:{b}" for a, b in A.integrity(raw))
        self.assertIn("ALERTA:tickets duplicados", txt)
        self.assertIn("SEM stop", txt)
        early = [tr(0, 1, hh=12)]                              # 12:00 UTC = 09:00 em Brasília → proibido
        self.assertTrue(any(a == "ALERTA" and "primeiros 15" in b for a, b in A.integrity(early)))

    def test_costs_are_separated(self):
        rs = A.enrich([tr(i, -20, fees=2.0) for i in range(5)])
        self.assertAlmostEqual(rs[0]["gross"], -18.0)


if __name__ == "__main__":
    unittest.main()
