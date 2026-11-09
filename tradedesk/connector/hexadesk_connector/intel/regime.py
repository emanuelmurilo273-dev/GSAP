"""a) Detector de regime: TENDÊNCIA / LATERAL / VOLÁTIL DEMAIS, com ADX, ATR e largura das Bandas de Bollinger.
'Volátil demais' é relativo ao próprio histórico (percentil), então vale para WIN, WDO ou qualquer ativo."""
from __future__ import annotations

from .indicators import adx, atr, bollinger_width, percentile_rank

TENDENCIA, LATERAL, VOLATIL, INDEFINIDO = "tendencia", "lateral", "volatil", "indefinido"
NOMES = {TENDENCIA: "tendência", LATERAL: "lateral", VOLATIL: "volátil demais", INDEFINIDO: "indefinido (poucos dados)"}


def classify(candles: list[tuple], adx_trend: float = 25.0, adx_range: float = 20.0, vol_rank: float = 0.9, lookback: int = 300) -> dict:
    """Classifica o momento a partir dos candles FECHADOS. Precisa de ~60+ candles."""
    if len(candles) < 60:
        return {"regime": INDEFINIDO, "adx": None, "atr_pct": None, "bb_width": None, "vol_rank": None}
    c = candles[-(lookback + 60):]
    a, t, w = adx(c), atr(c), bollinger_width([x[4] for x in c])
    atr_pct = [t[i] / c[i][4] for i in range(len(c))]
    hist = atr_pct[-lookback:-1]
    rk_atr, rk_bbw = percentile_rank(hist, atr_pct[-1]), percentile_rank(w[-lookback:-1], w[-1])
    rank = max(rk_atr, rk_bbw)
    if rank >= vol_rank:
        reg = VOLATIL
    elif a[-1] >= adx_trend:
        reg = TENDENCIA
    elif a[-1] < adx_range:
        reg = LATERAL
    else:
        reg = LATERAL      # zona intermediária (20–25): trata como lateral, o lado conservador para uma estratégia de tendência
    return {"regime": reg, "adx": round(a[-1], 2), "atr_pct": round(atr_pct[-1], 6), "bb_width": round(w[-1], 6), "vol_rank": round(rank, 3)}
