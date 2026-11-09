import os
import sys
import unittest
from datetime import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector.config import Config  # noqa: E402
from hexadesk_connector.sim import AUTOSTART_KEY, SimRunner  # noqa: E402
from hexadesk_connector.store import MemoryStore  # noqa: E402

S = {"enabled": False, "mode": "sim", "real_unlocked": False, "symbols": ["WIN", "WDO"], "profile": "conservador", "risk_per_trade_brl": 50, "max_contracts": 2,
     "daily_loss_brl": 150, "daily_target_brl": None, "max_trades_per_day": 6, "stop_points_win": 150, "stop_points_wdo": 5, "rr": 1.5,
     "open_from": "09:05", "open_until": "17:00", "flat_at": "17:30"}


def run_days(r, days):
    last, n = r.gw.t.date(), 0
    while n < days:
        r.tick()
        if r.gw.t.date() != last:
            n += 1; last = r.gw.t.date()


class Sim(unittest.TestCase):
    def test_runs_days_flat_every_evening_and_accounting_is_consistent(self):
        st = MemoryStore(dict(S, enabled=True))
        r = SimRunner(st, Config(), seed=11)
        opened_at = []
        orig = st.insert_trade
        st.insert_trade = lambda row: (opened_at.append(row["opened_at"]), orig(row))[1]
        run_days(r, 6)
        self.assertEqual(r.gw.positions(), [])                                   # zerou tudo no fim de cada dia
        closed = [t for t in st.trades if t["status"] == "closed"]
        self.assertGreater(len(closed), 5)
        self.assertAlmostEqual(r.gw.balance, 10_000 + sum(t["pnl"] for t in closed), places=2)   # contabilidade fecha
        self.assertEqual({t["source"] for t in st.trades}, {"internal"})          # nunca confundido com a conta demo do MT5
        for iso in opened_at:                                                      # nunca abriu fora de 09:05–17:00
            hh, mm = int(iso[11:13]), int(iso[14:16])
            self.assertTrue(time(9, 5) <= time(hh, mm) <= time(17, 0), iso)
        self.assertFalse([m for l, a, m in st.logs if l == "error"])

    def test_internal_days_do_not_count_as_mt5_sessions(self):
        st = MemoryStore(dict(S, enabled=True))
        r = SimRunner(st, Config(), seed=3)
        run_days(r, 2)
        self.assertTrue(st.sessions)
        self.assertTrue(all(k[2] == "internal" for k in st.sessions))
        self.assertIsNone(st.get_session(next(iter(st.sessions))[0], "sim", "mt5"))

    def test_autostart_turns_robot_on_once_then_respects_pause(self):
        st = MemoryStore(dict(S))
        r = SimRunner(st, Config(), seed=1)
        self.assertTrue(r.autostart())
        self.assertTrue(st.settings["enabled"])
        self.assertIn(AUTOSTART_KEY, st.kv)
        st.settings["enabled"] = False              # você pausou
        self.assertTrue(SimRunner(st, Config(), seed=1).autostart())
        self.assertFalse(st.settings["enabled"])    # NÃO religa de novo

    def test_autostart_waits_when_panel_not_ready(self):
        st = MemoryStore(None)                      # sem linha de configurações ainda
        self.assertFalse(SimRunner(st, Config(), seed=1).autostart())
        st2 = MemoryStore(dict(S)); st2.down = True            # painel fora do ar
        self.assertFalse(SimRunner(st2, Config(), seed=1).autostart())

    def test_yields_when_real_mt5_connector_is_active(self):
        from datetime import datetime, timezone
        st = MemoryStore(dict(S, enabled=True))
        r = SimRunner(st, Config(), seed=1)
        st.status = {"source": "mt5", "connector_ts": datetime.now(timezone.utc).isoformat()}
        t0 = r.gw.t
        self.assertEqual(r.tick(), "idle")
        self.assertEqual(r.gw.t, t0)                # não avançou nem operou
        st.status = {"source": "mt5", "connector_ts": "2020-01-01T00:00:00+00:00"}   # conector antigo = morto
        self.assertEqual(r.tick(), "ran")

    def test_panic_works_in_simulator(self):
        st = MemoryStore(dict(S, enabled=True))
        r = SimRunner(st, Config(), seed=11)
        for _ in range(4000):
            r.tick()
            if r.gw.positions():
                break
        self.assertTrue(r.gw.positions(), "simulador não abriu posição")
        st.push_command("panic"); r.tick()
        self.assertEqual(r.gw.positions(), [])
        self.assertFalse(st.settings["enabled"])

    def test_neutral_market_has_no_built_in_edge(self):
        tot, n = 0.0, 0
        for seed in range(1, 5):
            st = MemoryStore(dict(S, enabled=True)); r = SimRunner(st, Config(), seed=seed); run_days(r, 6)
            closed = [t for t in st.trades if t["status"] == "closed"]
            tot += sum(t["pnl"] for t in closed); n += len(closed)
        self.assertGreater(n, 60)
        self.assertLess(abs(tot) / 4, 600)          # média por simulação perto de zero (sem "vantagem" artificial)


if __name__ == "__main__":
    unittest.main()
