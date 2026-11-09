"""Transmissão ao vivo: ticks → candles (1m/5m/15m), book de ofertas, times & trades, fluxo de agressão. Grava tudo em disco.

Fluxo: gateway.ticks_since()/book()  →  LiveCollector.poll()  →  sink (painel) + TickRecorder (histórico próprio).
Só ENVIA A DIFERENÇA (ticks novos, candles alterados, book se mudou); a cada 1 s também publica um "snapshot" completo
(para quem abre a tela e para o modo de contingência por polling). Falha de rede NUNCA derruba o robô.
Horários: as barras usam o relógio do servidor da corretora (como no MT5), exibido como UTC no gráfico.
"""
from __future__ import annotations

import csv
import gzip
import json
import queue
import statistics
import threading
import time as _time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Protocol

TF_SECONDS = {"M1": 60, "M5": 300, "M15": 900}
FLAG_BUY, FLAG_SELL = 32, 64   # TICK_FLAG_BUY / TICK_FLAG_SELL do MetaTrader 5 (agressor comprador / vendedor)
BOOK_SELL, BOOK_BUY = "sell", "buy"


@dataclass
class TickRec:
    t_msc: int
    bid: float
    ask: float
    last: float
    vol: float
    flags: int

    @property
    def side(self) -> str | None:
        return "buy" if self.flags & FLAG_BUY else "sell" if self.flags & FLAG_SELL else None

    @property
    def is_trade(self) -> bool:
        return self.side is not None and self.last > 0 and self.vol > 0


class BarSeries:
    """Candles de um timeframe, atualizados tick a tick. Barra = [t, o, h, l, c, v] (t em segundos)."""

    def __init__(self, tf: str, seed: list[tuple] | None = None, keep: int = 600):
        self.sec, self.keep = TF_SECONDS[tf], keep
        self.bars: list[list[float]] = [list(b[:6]) for b in (seed or [])][-keep:]

    def update(self, t_sec: int, price: float, vol: float) -> list[float] | None:
        bucket = (t_sec // self.sec) * self.sec
        if self.bars and bucket < self.bars[-1][0]:
            return None                     # tick atrasado (ignora)
        if self.bars and self.bars[-1][0] == bucket:
            b = self.bars[-1]
            b[2], b[3], b[4], b[5] = max(b[2], price), min(b[3], price), price, b[5] + vol
            return list(b)
        self.bars.append([bucket, price, price, price, price, vol])
        del self.bars[: max(0, len(self.bars) - self.keep)]
        return list(self.bars[-1])


class SymbolState:
    def __init__(self, symbol: str, seed: dict[str, list[tuple]]):
        self.symbol = symbol
        self.bars = {tf: BarSeries(tf, seed.get(tf)) for tf in TF_SECONDS}
        self.trades: deque[dict] = deque(maxlen=300)
        self.flow: deque[tuple] = deque(maxlen=20000)   # (t_msc, side, vol)
        self.cursor = 0
        self.last: dict = {}
        self.last_tick_real_ms = 0
        self.book: list[dict] = []
        self.book_sig = ""

    def flow_stats(self, now_msc: int, window_s: float = 60, big_lot: float = 0) -> dict:
        lo = now_msc - int(window_s * 1000)
        buy = sell = 0.0
        vols = []
        for t, side, v in self.flow:
            if t >= lo:
                vols.append(v)
                buy, sell = (buy + v, sell) if side == "buy" else (buy, sell + v)
        tot = buy + sell
        thr = big_lot or (max(5 * statistics.median(vols), 10) if vols else 10)
        big = sum(1 for v in vols if v >= thr)
        bids = sum(l["vol"] for l in self.book if l["side"] == "buy")
        asks = sum(l["vol"] for l in self.book if l["side"] == "sell")
        return {"buy": buy, "sell": sell, "delta": buy - sell, "imbalance": (buy - sell) / tot if tot else 0.0, "big_lots": big, "trades": len(vols),
                "book_imbalance": (bids - asks) / (bids + asks) if bids + asks else 0.0}


class LiveSink(Protocol):
    def publish(self, payload: dict) -> None: ...
    def snapshot(self, payload: dict) -> None: ...


class NullSink:
    def publish(self, payload): pass
    def snapshot(self, payload): pass


class SupabaseLiveSink:
    """Diferenças via Supabase Realtime (broadcast, canal b3-live) e snapshot na tabela b3_live (inicial + contingência)."""

    def __init__(self, url: str, key: str, timeout: float = 4.0):
        import requests
        self.s = requests.Session()
        self.url = url.rstrip("/")
        self.s.headers.update({"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        self.timeout = timeout
        self.errors = 0

    def publish(self, payload):
        try:
            self.s.post(f"{self.url}/realtime/v1/api/broadcast", json={"messages": [{"topic": "b3-live", "event": "diff", "payload": payload}]}, timeout=self.timeout)
        except Exception:
            self.errors += 1

    def snapshot(self, payload):
        try:
            self.s.post(f"{self.url}/rest/v1/b3_live", json={"id": 1, "ts": datetime.now(timezone.utc).isoformat(), "data": payload},
                        headers={"Prefer": "resolution=merge-duplicates"}, timeout=self.timeout)
        except Exception:
            self.errors += 1


class AsyncSink:
    """Envia em segundo plano: o loop do robô nunca espera a rede. Fila limitada (descarta diferenças antigas); snapshot só o último."""

    def __init__(self, inner: LiveSink, maxsize: int = 200):
        self.inner, self.q = inner, queue.Queue(maxsize=maxsize)
        self.snap: dict | None = None
        self.lock = threading.Lock()
        self.dropped = 0
        self._stop = False
        self.t = threading.Thread(target=self._run, daemon=True)
        self.t.start()

    def publish(self, payload):
        try:
            self.q.put_nowait(payload)
        except queue.Full:
            try:
                self.q.get_nowait(); self.q.put_nowait(payload); self.dropped += 1
            except Exception:
                pass

    def snapshot(self, payload):
        with self.lock:
            self.snap = payload

    def _run(self):
        while not self._stop:
            did = False
            try:
                self.inner.publish(self.q.get(timeout=0.1)); did = True
            except queue.Empty:
                pass
            except Exception:
                pass
            with self.lock:
                s, self.snap = self.snap, None
            if s is not None:
                try:
                    self.inner.snapshot(s)
                except Exception:
                    pass
            if not did:
                _time.sleep(0.01)

    def flush(self, timeout: float = 2.0):
        end = _time.time() + timeout
        while _time.time() < end and (not self.q.empty() or self.snap is not None):
            _time.sleep(0.02)

    def close(self):
        self._stop = True


class TickRecorder:
    """Histórico PRÓPRIO para pesquisa: <pasta>/AAAA-MM-DD/<SIMBOLO>_ticks.csv.gz e _book.csv.gz (gzip em blocos, só acrescenta).
    Converta para Parquet depois com tools/para_parquet.py, se quiser."""

    def __init__(self, root: Path, flush_every: int = 500):
        self.root, self.flush_every = Path(root), flush_every
        self.tbuf: dict[str, list] = {}
        self.bbuf: dict[str, list] = {}

    def _path(self, symbol: str, kind: str, t_msc: int) -> Path:
        day = datetime.fromtimestamp(t_msc / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        p = self.root / day
        p.mkdir(parents=True, exist_ok=True)
        return p / f"{symbol}_{kind}.csv.gz"

    def ticks(self, symbol: str, ticks: list[TickRec]) -> None:
        buf = self.tbuf.setdefault(symbol, [])
        buf.extend([t.t_msc, t.bid, t.ask, t.last, t.vol, t.flags] for t in ticks)
        if len(buf) >= self.flush_every:
            self.flush(symbol)

    def book(self, symbol: str, t_msc: int, levels: list[dict]) -> None:
        self.bbuf.setdefault(symbol, []).extend([t_msc, l["side"], l["price"], l["vol"]] for l in levels)

    def flush(self, symbol: str | None = None) -> None:
        for kind, store in (("ticks", self.tbuf), ("book", self.bbuf)):
            for sym in ([symbol] if symbol else list(store)):
                rows = store.get(sym) or []
                if not rows:
                    continue
                with gzip.open(self._path(sym, kind, int(rows[0][0])), "at", newline="", encoding="utf-8") as f:
                    csv.writer(f).writerows(rows)
                store[sym] = []


def read_ticks(path: Path) -> list[TickRec]:
    out = []
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for r in csv.reader(f):
            out.append(TickRec(int(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[4]), int(r[5])))
    return out


class LiveCollector:
    def __init__(self, gw, symbols_fn: Callable[[], list[str]], sink: LiveSink | None = None, recorder: TickRecorder | None = None,
                 real_ms: Callable[[], int] | None = None, book_every_ms: int = 250, snapshot_every_ms: int = 1000, big_lot: float = 0):
        self.gw, self.symbols_fn = gw, symbols_fn
        self.sink, self.rec = sink or NullSink(), recorder
        self.real_ms = real_ms or (lambda: int(_time.time() * 1000))
        self.book_every, self.snap_every, self.big_lot = book_every_ms, snapshot_every_ms, big_lot
        self.state: dict[str, SymbolState] = {}
        self.last_book = 0
        self.last_snap = 0

    # ---- inicialização de um símbolo com o histórico de candles
    def _state(self, sym: str) -> SymbolState:
        st = self.state.get(sym)
        if st is None:
            seed = {}
            for tf in TF_SECONDS:
                try:
                    seed[tf] = self.gw.candles(sym, tf, 300)
                except Exception:
                    seed[tf] = []
            st = self.state[sym] = SymbolState(sym, seed)
            try:
                self.gw.book_subscribe(sym)
            except Exception:
                pass
        return st

    def poll(self) -> dict:
        """Um ciclo (~200 ms). Devolve as diferenças publicadas (útil nos testes)."""
        now = self.real_ms()
        out: dict[str, dict] = {}
        for sym in self.symbols_fn():
            st = self._state(sym)
            try:
                ticks = self.gw.ticks_since(sym, st.cursor)
            except Exception:
                ticks = []
            diff: dict = {"s": sym}
            bars_changed: dict[str, list] = {}
            new_trades = []
            for tk in ticks:
                st.cursor = max(st.cursor, tk.t_msc)
                price = tk.last if tk.last > 0 else (tk.bid + tk.ask) / 2 if tk.bid and tk.ask else 0
                if price <= 0:
                    continue
                v = tk.vol if tk.is_trade else 0.0
                for tf, series in st.bars.items():
                    b = series.update(tk.t_msc // 1000, price, v)
                    if b:
                        bars_changed[tf] = b
                if tk.is_trade:
                    tr = {"t": tk.t_msc, "p": tk.last, "v": tk.vol, "side": tk.side}
                    st.trades.append(tr); st.flow.append((tk.t_msc, tk.side, tk.vol)); new_trades.append(tr)
                st.last = {"t": tk.t_msc, "bid": tk.bid, "ask": tk.ask, "last": tk.last or price}
            if ticks:
                st.last_tick_real_ms = now
                if self.rec:
                    self.rec.ticks(sym, ticks)
                diff["tick"] = st.last
                diff["bars"] = [{"tf": tf, "bar": b} for tf, b in bars_changed.items()]
                diff["trades"] = new_trades
            if now - self.last_book >= self.book_every:
                try:
                    lv = self.gw.book(sym)
                except Exception:
                    lv = []
                levels = [{"side": s, "price": p, "vol": v} for p, v, s in lv]
                sig = json.dumps(levels, separators=(",", ":"))
                if sig != st.book_sig:
                    st.book_sig, st.book = sig, levels
                    diff["book"] = levels
                    if self.rec and levels:
                        self.rec.book(sym, st.last.get("t", now), levels)
            if len(diff) > 1:
                diff["real_ms"] = now
                out[sym] = diff
                try:
                    self.sink.publish(diff)
                except Exception:
                    pass   # rede/painel fora: o robô e a gravação em disco continuam
        if now - self.last_book >= self.book_every:
            self.last_book = now
        if now - self.last_snap >= self.snap_every:
            self.last_snap = now
            try:
                self.sink.snapshot(self.snapshot(now))
            except Exception:
                pass
            if self.rec:
                self.rec.flush()
        return out

    def snapshot(self, now: int | None = None) -> dict:
        now = now or self.real_ms()
        return {"real_ms": now, "symbols": {sym: {
            "last": st.last, "last_tick_real_ms": st.last_tick_real_ms, "book": st.book, "trades": list(st.trades)[-60:],
            "bars": {tf: s.bars[-200:] for tf, s in st.bars.items()},
            "flow": st.flow_stats(st.last.get("t", 0), 60, self.big_lot)} for sym, st in self.state.items()}}

    def flow(self, symbol: str, window_s: float = 60) -> dict | None:
        st = self.state.get(symbol)
        return st.flow_stats(st.last.get("t", 0), window_s, self.big_lot) if st and st.last else None

    def last_tick_age_s(self, symbol: str) -> float | None:
        st = self.state.get(symbol)
        return (self.real_ms() - st.last_tick_real_ms) / 1000 if st and st.last_tick_real_ms else None
