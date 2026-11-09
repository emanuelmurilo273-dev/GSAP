"""Indicadores em Python puro (sem numpy). Candle = (t, o, h, l, c, v)."""
from __future__ import annotations

import math


def ema(vals: list[float], p: int) -> list[float]:
    k, out = 2 / (p + 1), []
    for i, v in enumerate(vals):
        out.append(v if i == 0 else v * k + out[-1] * (1 - k))
    return out


def true_ranges(c: list[tuple]) -> list[float]:
    return [c[0][2] - c[0][3]] + [max(c[i][2] - c[i][3], abs(c[i][2] - c[i - 1][4]), abs(c[i][3] - c[i - 1][4])) for i in range(1, len(c))]


def atr(c: list[tuple], p: int = 14) -> list[float]:
    tr, out = true_ranges(c), []
    for i, x in enumerate(tr):
        out.append(x if i == 0 else (out[-1] * (p - 1) + x) / p)
    return out


def adx(c: list[tuple], p: int = 14) -> list[float]:
    """ADX de Wilder (suavização por Wilder). Os p primeiros valores são pouco confiáveis."""
    n = len(c)
    if n < 2:
        return [0.0] * n
    pdm, mdm = [0.0], [0.0]
    for i in range(1, n):
        up, dn = c[i][2] - c[i - 1][2], c[i - 1][3] - c[i][3]
        pdm.append(up if up > dn and up > 0 else 0.0)
        mdm.append(dn if dn > up and dn > 0 else 0.0)
    tr = true_ranges(c)
    sm = lambda v: _wilder(v, p)
    str_, sp, sm_ = sm(tr), sm(pdm), sm(mdm)
    dx = []
    for i in range(n):
        pdi = 100 * sp[i] / str_[i] if str_[i] else 0.0
        mdi = 100 * sm_[i] / str_[i] if str_[i] else 0.0
        dx.append(100 * abs(pdi - mdi) / (pdi + mdi) if pdi + mdi else 0.0)
    return _wilder(dx, p, mean_start=True)


def _wilder(v: list[float], p: int, mean_start: bool = False) -> list[float]:
    """Suavização de Wilder (recursiva). Os primeiros ~3p valores ainda estão "aquecendo"."""
    out: list[float] = []
    for i, x in enumerate(v):
        out.append(x if i == 0 else (out[-1] * (p - 1) + x) / p)
    return out


def bollinger_width(closes: list[float], p: int = 20, k: float = 2.0) -> list[float]:
    out = []
    for i in range(len(closes)):
        w = closes[max(0, i - p + 1): i + 1]
        m = sum(w) / len(w)
        sd = math.sqrt(sum((x - m) ** 2 for x in w) / len(w))
        out.append((2 * k * sd) / m if m else 0.0)
    return out


def rsi(closes: list[float], p: int = 14) -> list[float]:
    out, g, l = [50.0], 0.0, 0.0
    for i in range(1, len(closes)):
        d = closes[i] - closes[i - 1]
        g = (g * (p - 1) + max(d, 0)) / p
        l = (l * (p - 1) + max(-d, 0)) / p
        out.append(100 - 100 / (1 + g / l) if l else 100.0)
    return out


def session_vwap(c: list[tuple], day_of: callable) -> list[float]:
    """VWAP ancorado no início de cada sessão (dia)."""
    out, pv, vv, cur = [], 0.0, 0.0, None
    for b in c:
        d = day_of(b[0])
        if d != cur:
            cur, pv, vv = d, 0.0, 0.0
        tp = (b[2] + b[3] + b[4]) / 3
        pv, vv = pv + tp * max(b[5], 1e-9), vv + max(b[5], 1e-9)
        out.append(pv / vv)
    return out


def percentile_rank(history: list[float], x: float) -> float:
    return sum(1 for h in history if h <= x) / len(history) if history else 0.5
