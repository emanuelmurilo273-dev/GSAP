"""Ponta a ponta no simulador: ligar → operar → stop/alvo → limite diário → zeragem às 17:30 → alertas (que alimentam o resumo)."""
import os
import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector.config import Config  # noqa: E402
from hexadesk_connector.sim import SimRunner  # noqa: E402
from hexadesk_connector.store import MemoryStore  # noqa: E402

S = {"enabled": False, "mode": "sim", "real_unlocked": False, "real_locked": True, "symbols": ["WIN", "WDO"], "profile": "moderado", "risk_per_trade_brl": 100, "max_contracts": 2,
     "daily_loss_brl": 200, "daily_target_brl": None, "max_trades_per_day": 6, "stop_points_win": 150, "stop_points_wdo": 5, "rr": 1.5,
     "open_from": "09:15", "open_until": "17:00", "flat_at": "17:30"}


def run_days(r, days):
    last, n, eod = r.gw.t.date(), 0, []
    while n < days:
        r.tick()
        if r.gw.t.date() != last:
            eod.append(len(r.gw.positions())); n += 1; last = r.gw.t.date()
    return eod


class EndToEnd(unittest.TestCase):
    def test_full_cycle_turn_on_trade_stop_target_flat_alerts(self):
        st = MemoryStore(dict(S))
        r = SimRunner(st, Config(), seed=8)
        self.assertTrue(r.autostart())                                      # LIGAR (o simulador liga uma vez, o dono pausa quando quiser)
        self.assertTrue(st.settings["enabled"])
        eod = run_days(r, 25)
        closed = [t for t in st.trades if t["status"] == "closed"]
        self.assertGreater(len(closed), 15)                                 # OPEROU
        self.assertTrue(any(t["pnl"] > 0 for t in closed) and any(t["pnl"] < 0 for t in closed))     # alvo E stop aconteceram
        self.assertTrue(all(t["sl"] and t["tp"] and t.get("why") and t.get("regime") for t in closed))   # stop/alvo no servidor e explicação gravada
        self.assertTrue(all(abs(t["gross_pnl"] - t["fees"] - t["pnl"]) < 0.01 for t in closed))          # custo separado do bruto
        self.assertEqual(eod, [0] * len(eod), "ZEROU tudo no fim de cada dia")
        kinds = Counter(k for k, _, _ in st.alerts)
        self.assertGreater(kinds["trade_open"], 0); self.assertGreater(kinds["trade_close"], 0)       # alertas de cada operação (viram e-mail/push)
        self.assertEqual(kinds["trade_open"], len(st.trades))
        self.assertFalse([m for l, a, m in st.logs if l == "error"])
        self.assertAlmostEqual(r.gw.balance, 10_000 + sum(t["pnl"] for t in closed), places=2)

    def test_daily_loss_limit_halts_the_day_and_alerts(self):
        st = MemoryStore(dict(S, daily_loss_brl=60, enabled=True, max_trades_per_day=20))
        r = SimRunner(st, Config(), seed=3)
        eod = run_days(r, 30)
        halted = [v for v in st.sessions.values() if v.get("halted")]
        self.assertTrue(halted, "em 30 pregões com limite de R$ 60 pelo menos um dia deveria parar")
        self.assertTrue(any(k == "limit" for k, _, _ in st.alerts))
        self.assertEqual(eod, [0] * len(eod))
        for key, sess in st.sessions.items():          # NUNCA estourou o limite (a operação só entra se o risco cabe no que resta)
            self.assertGreater(sess["pnl"], -60 * 1.35, f"{key}: perdeu {sess['pnl']}")

    def test_stop_after_two_losses_in_a_row(self):
        st = MemoryStore(dict(S, enabled=True, daily_loss_brl=5000, max_trades_per_day=30))
        r = SimRunner(st, Config(), seed=5)
        run_days(r, 30)
        by_day = {}
        for t in sorted((t for t in st.trades if t["status"] == "closed"), key=lambda t: t["opened_at"]):
            by_day.setdefault(t["opened_at"][:10], []).append(t["pnl"])
        for day, pnls in by_day.items():               # nunca há uma 3ª operação depois de 2 perdas seguidas no mesmo dia
            streak = 0
            for p in pnls:
                self.assertLess(streak, 2, f"{day}: operou depois de 2 perdas seguidas")
                streak = streak + 1 if p < 0 else 0


if __name__ == "__main__":
    unittest.main()
