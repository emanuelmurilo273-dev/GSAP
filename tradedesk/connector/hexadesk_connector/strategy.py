"""Estratégia de BASE — NÃO VALIDADA.

Existe só para exercitar o encanamento (simulador/demo). Nenhuma estratégia foi aprovada na pesquisa; por isso o modo
REAL fica bloqueado no servidor. Troque por uma estratégia aprovada quando houver.
"""
from __future__ import annotations

UNVALIDATED = True


def ema(values: list[float], p: int) -> list[float]:
    out: list[float] = []
    k = 2 / (p + 1)
    for i, v in enumerate(values):
        out.append(v if i == 0 else v * k + out[-1] * (1 - k))
    return out


def baseline_signal(candles: list[tuple]) -> tuple[str, float] | None:
    """Cruzamento de EMA9/EMA21 no último candle FECHADO. candles: (t,o,h,l,c,v). Retorna (lado, t_do_candle)."""
    if len(candles) < 40:
        return None
    closes = [c[4] for c in candles]
    f, s = ema(closes, 9), ema(closes, 21)
    if f[-2] <= s[-2] and f[-1] > s[-1]:
        return "buy", candles[-1][0]
    if f[-2] >= s[-2] and f[-1] < s[-1]:
        return "sell", candles[-1][0]
    return None
