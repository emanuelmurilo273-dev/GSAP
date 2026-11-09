import gzip
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector.fake_mt5 import FakeGateway  # noqa: E402
from hexadesk_connector.live import FLAG_BUY, FLAG_SELL, AsyncSink, BarSeries, LiveCollector, NullSink, TickRec, TickRecorder, read_ticks  # noqa: E402

S = "WINZ26"


def tk(t_s, price, vol=1.0, side="buy", ms=0):
    return TickRec(int(t_s * 1000) + ms, price - 5, price, price, vol, (FLAG_BUY if side == "buy" else FLAG_SELL) | 4 | 8)


class Sink:
    def __init__(self): self.diffs, self.snaps = [], []
    def publish(self, p): self.diffs.append(p)
    def snapshot(self, p): self.snaps.append(p)


class Clock:
    def __init__(self): self.ms = 1_000_000
    def __call__(self): return self.ms
    def adv(self, ms): self.ms += ms


def make(**kw):
    gw = FakeGateway(); sink = Sink(); clk = Clock()
    col = LiveCollector(gw, lambda: [S], sink, real_ms=clk, **kw)
    return gw, sink, clk, col


class Bars(unittest.TestCase):
    def test_boundaries_and_ohlcv(self):
        b = BarSeries("M1")
        b.update(59, 100, 2); b.update(60, 101, 3); b.update(75, 105, 1); b.update(90, 99, 4); b.update(119, 100, 1)
        self.assertEqual([x[0] for x in b.bars], [0, 60])
        self.assertEqual(b.bars[0], [0, 100, 100, 100, 100, 2])
        self.assertEqual(b.bars[1], [60, 101, 105, 99, 100, 9])      # o, h, l, c, v
        self.assertIsNone(b.update(10, 1, 1))                          # tick atrasado é ignorado

    def test_all_timeframes_from_ticks(self):
        gw, sink, clk, col = make()
        gw.tick_buffer = [tk(t, 100 + (t % 7), 2) for t in range(0, 1000, 5)]
        col.poll()
        st = col.state[S]
        self.assertEqual(st.bars["M1"].bars[0][0], 0); self.assertEqual(st.bars["M5"].bars[-1][0], 900)
        self.assertEqual(st.bars["M15"].bars[0][0], 0)
        self.assertAlmostEqual(sum(b[5] for b in st.bars["M1"].bars), sum(b[5] for b in st.bars["M5"].bars))   # volume bate entre timeframes
        self.assertEqual(len(st.bars["M1"].bars), 17)


class Diffs(unittest.TestCase):
    def test_only_changes_are_sent(self):
        gw, sink, clk, col = make()
        gw.book_levels = [(100.0, 10.0, "buy"), (105.0, 8.0, "sell")]
        gw.tick_buffer = [tk(1, 100, 3)]
        d1 = col.poll()
        self.assertIn(S, d1); self.assertIn("tick", d1[S]); self.assertIn("book", d1[S]); self.assertEqual(len(d1[S]["trades"]), 1)
        clk.adv(300)
        d2 = col.poll()                                                  # nada novo: não envia nada
        self.assertEqual(d2, {})
        gw.tick_buffer.append(tk(2, 105, 4)); clk.adv(300)
        d3 = col.poll()
        self.assertEqual(len(d3[S]["trades"]), 1)
        self.assertNotIn("book", d3[S])                                  # book não mudou: não reenvia
        gw.book_levels = [(100.0, 12.0, "buy"), (105.0, 8.0, "sell")]; clk.adv(300)
        self.assertIn("book", col.poll()[S])

    def test_snapshot_every_second_has_full_state(self):
        gw, sink, clk, col = make()
        gw.tick_buffer = [tk(1, 100, 3)]
        col.poll(); self.assertEqual(len(sink.snaps), 1)
        clk.adv(500); col.poll(); self.assertEqual(len(sink.snaps), 1)
        clk.adv(600); col.poll(); self.assertEqual(len(sink.snaps), 2)
        snap = sink.snaps[-1]["symbols"][S]
        self.assertEqual(set(snap["bars"]), {"M1", "M5", "M15"}); self.assertEqual(snap["last"]["last"], 100)

    def test_sink_failure_never_breaks_the_collector(self):
        class Bad:
            def publish(self, p): raise RuntimeError("rede caiu")
            def snapshot(self, p): raise RuntimeError("rede caiu")
        gw = FakeGateway(); col = LiveCollector(gw, lambda: [S], Bad())
        gw.tick_buffer = [tk(1, 100)]
        try:
            col.poll()
        except Exception as e:                                           # publish dentro do poll não é protegido? deve ser
            self.fail(f"coletor propagou erro do sink: {e}")


class Flow(unittest.TestCase):
    def test_aggression_balance_big_lots_and_book_imbalance(self):
        gw, sink, clk, col = make(big_lot=50)
        gw.book_levels = [(100.0, 30.0, "buy"), (99.0, 30.0, "buy"), (105.0, 10.0, "sell")]
        gw.tick_buffer = [tk(1, 100, 10, "buy", 1), tk(2, 100, 5, "buy", 2), tk(3, 99, 20, "sell", 3), tk(4, 101, 60, "buy", 4)]
        col.poll()
        f = col.flow(S, 60)
        self.assertEqual((f["buy"], f["sell"], f["delta"]), (75, 20, 55))
        self.assertAlmostEqual(f["imbalance"], 55 / 95)
        self.assertEqual(f["big_lots"], 1)                                # só o lote de 60 passa de 50
        self.assertAlmostEqual(f["book_imbalance"], (60 - 10) / 70)

    def test_window_excludes_old_trades(self):
        gw, sink, clk, col = make()
        gw.tick_buffer = [tk(1, 100, 10, "sell"), tk(100, 100, 10, "buy")]
        col.poll()
        self.assertEqual(col.flow(S, 30)["delta"], 10)                    # só o último está na janela de 30 s


class Stale(unittest.TestCase):
    def test_last_tick_age_for_the_stale_data_alert(self):
        gw, sink, clk, col = make()
        gw.tick_buffer = [tk(1, 100)]
        col.poll()
        self.assertEqual(col.last_tick_age_s(S), 0)
        clk.adv(6000); col.poll()
        self.assertEqual(col.last_tick_age_s(S), 6)                       # > 5 s → o painel mostra "dados atrasados"
        snap = col.snapshot()
        self.assertEqual(snap["real_ms"] - snap["symbols"][S]["last_tick_real_ms"], 6000)


class Recorder(unittest.TestCase):
    def test_ticks_and_book_are_saved_and_readable(self):
        with tempfile.TemporaryDirectory() as d:
            gw = FakeGateway(); clk = Clock()
            rec = TickRecorder(Path(d), flush_every=10_000)
            col = LiveCollector(gw, lambda: [S], NullSink(), rec, real_ms=clk)
            gw.book_levels = [(100.0, 10.0, "buy"), (105.0, 8.0, "sell")]
            gw.tick_buffer = [tk(1_700_000_000, 100, 3, "buy", 1), tk(1_700_000_001, 101, 2, "sell", 2)]
            col.poll(); rec.flush()
            files = sorted(Path(d).rglob("*.csv.gz"))
            self.assertEqual({f.name for f in files}, {f"{S}_ticks.csv.gz", f"{S}_book.csv.gz"})
            back = read_ticks(next(f for f in files if "ticks" in f.name))
            self.assertEqual([(t.last, t.vol, t.side) for t in back], [(100, 3, "buy"), (101, 2, "sell")])
            with gzip.open(next(f for f in files if "book" in f.name), "rt") as f:
                self.assertEqual(len(f.read().strip().splitlines()), 2)
            col.poll(); rec.flush()                                      # sem novos ticks nem mudança no book: nada novo
            self.assertEqual(len(read_ticks(next(f for f in sorted(Path(d).rglob("*_ticks.csv.gz"))))), 2)

    def test_append_across_flushes(self):
        with tempfile.TemporaryDirectory() as d:
            rec = TickRecorder(Path(d))
            rec.ticks(S, [tk(1_700_000_000, 100)]); rec.flush()
            rec.ticks(S, [tk(1_700_000_005, 101)]); rec.flush()
            self.assertEqual(len(read_ticks(next(Path(d).rglob("*_ticks.csv.gz")))), 2)


class Async(unittest.TestCase):
    def test_never_blocks_and_coalesces_snapshots(self):
        got = {"d": [], "s": []}
        class Slow:
            def publish(self, p): time.sleep(0.05); got["d"].append(p)
            def snapshot(self, p): got["s"].append(p)
        a = AsyncSink(Slow(), maxsize=5)
        t0 = time.time()
        for i in range(100):
            a.publish({"i": i})
        self.assertLess(time.time() - t0, 0.5)                            # a chamada não espera a rede
        for i in range(10):
            a.snapshot({"n": i})
        a.flush(3); a.close()
        self.assertLess(len(got["d"]), 100); self.assertGreater(a.dropped, 0)
        self.assertEqual(got["s"][-1], {"n": 9})                          # só o snapshot mais recente importa


class SimFeed(unittest.TestCase):
    def test_sim_feeds_live_and_has_no_hidden_edge(self):
        from hexadesk_connector.config import Config
        from hexadesk_connector.sim import SimRunner
        from hexadesk_connector.store import MemoryStore
        st = MemoryStore({"enabled": False, "mode": "sim", "real_unlocked": False, "symbols": ["WIN", "WDO"], "profile": "conservador", "risk_per_trade_brl": 50, "max_contracts": 2,
                          "daily_loss_brl": 150, "daily_target_brl": None, "max_trades_per_day": 6, "stop_points_win": 150, "stop_points_wdo": 5, "rr": 1.5,
                          "open_from": "09:05", "open_until": "17:00", "flat_at": "17:30"})
        sink = Sink()
        r = SimRunner(st, Config(), seed=5, sink=sink)
        for i in range(1, 400):
            r.tick(0.2, step=(i % 5 == 0))
        self.assertTrue(sink.diffs and sink.snaps)
        d = next(x for x in sink.diffs if "WINZ26" in str(x.get("s")) and x.get("bars"))
        self.assertIn("tick", d)
        snap = r.live.snapshot()["symbols"]["WINZ26"]
        self.assertEqual(len(snap["book"]), 20)
        self.assertGreater(len(snap["trades"]), 10)
        m5 = snap["bars"]["M5"]
        self.assertTrue(all(m5[i][0] < m5[i + 1][0] for i in range(len(m5) - 1)))      # candles em ordem
        self.assertTrue(all(b[3] <= min(b[1], b[4]) and b[2] >= max(b[1], b[4]) for b in m5))   # high/low coerentes
        # o book/fluxo sintético NÃO prevê o preço (senão enganaria os testes das camadas de inteligência)
        import statistics
        from hexadesk_connector.sim import SimGateway
        g = SimGateway(seed=9); xs, ys = [], []
        for _ in range(3000):
            lv = g.book("WINZ26"); b = sum(v for p, v, s in lv if s == "buy"); a = sum(v for p, v, s in lv if s == "sell")
            p0 = g.px["WIN"]; g.pump(5); xs.append((b - a) / (b + a)); ys.append(g.px["WIN"] - p0)
        mx, my = statistics.mean(xs), statistics.mean(ys)
        cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / len(xs)
        corr = cov / (statistics.pstdev(xs) * statistics.pstdev(ys))
        self.assertLess(abs(corr), 0.06)


if __name__ == "__main__":
    unittest.main()
