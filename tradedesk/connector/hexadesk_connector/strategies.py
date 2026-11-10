"""Famílias de estratégia candidatas. TODAS NÃO VALIDADAS até passarem no protocolo de pesquisa (research_b3/familias.py).
Cada família é uma função `f(candles, p) -> lista de sinais` (um por candle: 'buy' | 'sell' | None), usando SÓ candles FECHADOS até aquele índice
(sem olhar o futuro). A mesma função serve ao backtest e ao robô (`signal_fn_for`): o robô só olha o último elemento.
Candle = (t, o, h, l, c, v); `t` em segundos (relógio da corretora). Parâmetros FIXOS e registrados antes dos testes (nada é otimizado depois de ver o teste).
Famílias:
  ema_cross      base: cruzamento EMA9×EMA21 (a que perdia dinheiro)
  orb            rompimento da 1ª hora do pregão (1 sinal por dia por lado)
  trend_regime   cruzamento a favor da EMA50 só com ADX ≥ 25 (tendência confirmada)
  vwap_reversion reversão ao VWAP da sessão depois de esticar ≥ 2 ATR
  pullback       recuo até a EMA21 dentro de tendência (EMA21 > EMA50) e retomada
O 'fluxo de ordens' (agressão e book) NÃO é uma família de candles: é a camada `flow` do pipeline (precisa de ticks/book gravados)."""
from __future__ import annotations

from .intel.indicators import adx, atr, ema, session_vwap

DEFAULT_PARAMS = {
    "session_start_min": 9 * 60,        # B3: pregão começa 09:00 (proxy cripto usa 13:30 UTC = abertura dos EUA)
    "range_min": 60,                    # 1ª hora
    "adx_min": 25.0,
    "vwap_stretch_atr": 2.0,
    "vwap_cooldown": 6,
    "pullback_trend_bars": 3,
}


def _day(t: float) -> int:
    return int(t // 86400)


def _minute(t: float) -> int:
    return int(t % 86400) // 60


def ema_cross(c: list[tuple], p: dict) -> list[str | None]:
    closes = [b[4] for b in c]
    f, s = ema(closes, 9), ema(closes, 21)
    out: list[str | None] = [None] * len(c)
    for i in range(40, len(c)):
        out[i] = "buy" if f[i - 1] <= s[i - 1] and f[i] > s[i] else "sell" if f[i - 1] >= s[i - 1] and f[i] < s[i] else None
    return out


def orb(c: list[tuple], p: dict) -> list[str | None]:
    """Rompimento da faixa da 1ª hora: depois que a faixa fecha, o 1º candle que FECHA acima da máxima (compra) ou abaixo da mínima (venda). Máx. 1 por dia."""
    out: list[str | None] = [None] * len(c)
    start, rng = p["session_start_min"], p["range_min"]
    day, hi, lo, taken = None, None, None, set()
    for i, b in enumerate(c):
        d, m = _day(b[0]), _minute(b[0])
        if d != day:
            day, hi, lo, taken = d, None, None, set()
        if start <= m < start + rng:
            hi = b[2] if hi is None else max(hi, b[2])
            lo = b[3] if lo is None else min(lo, b[3])
        elif m >= start + rng and hi is not None:
            if b[4] > hi and "buy" not in taken:
                out[i] = "buy"; taken.add("buy")
            elif b[4] < lo and "sell" not in taken:
                out[i] = "sell"; taken.add("sell")
    return out


def trend_regime(c: list[tuple], p: dict) -> list[str | None]:
    closes = [b[4] for b in c]
    f, s, slow = ema(closes, 9), ema(closes, 21), ema(closes, 50)
    a = adx(c)
    out: list[str | None] = [None] * len(c)
    for i in range(60, len(c)):
        if a[i] < p["adx_min"]:
            continue
        if f[i - 1] <= s[i - 1] and f[i] > s[i] and closes[i] > slow[i]:
            out[i] = "buy"
        elif f[i - 1] >= s[i - 1] and f[i] < s[i] and closes[i] < slow[i]:
            out[i] = "sell"
    return out


def vwap_reversion(c: list[tuple], p: dict) -> list[str | None]:
    """Preço esticado ≥ k ATR do VWAP da sessão e o candle fecha de volta na direção do VWAP (confirmação) → opera em direção ao VWAP."""
    vw, at = session_vwap(c, _day), atr(c)
    out: list[str | None] = [None] * len(c)
    last = -10_000
    for i in range(30, len(c)):
        if _day(c[i - 1][0]) != _day(c[i][0]) or i - last < p["vwap_cooldown"] or at[i - 1] <= 0:
            continue
        dev_prev = (c[i - 1][4] - vw[i - 1]) / at[i - 1]
        if dev_prev <= -p["vwap_stretch_atr"] and c[i][4] > c[i][1] and c[i][4] > c[i - 1][4]:
            out[i] = "buy"; last = i
        elif dev_prev >= p["vwap_stretch_atr"] and c[i][4] < c[i][1] and c[i][4] < c[i - 1][4]:
            out[i] = "sell"; last = i
    return out


def pullback(c: list[tuple], p: dict) -> list[str | None]:
    """Tendência de alta (EMA21 > EMA50, preço > EMA50): o candle toca a EMA21 e fecha de volta acima dela → compra. Baixa: espelho."""
    closes = [b[4] for b in c]
    e21, e50 = ema(closes, 21), ema(closes, 50)
    n = p["pullback_trend_bars"]
    out: list[str | None] = [None] * len(c)
    for i in range(60 + n, len(c)):
        up = all(e21[i - k] > e50[i - k] for k in range(n + 1)) and closes[i] > e50[i]
        dn = all(e21[i - k] < e50[i - k] for k in range(n + 1)) and closes[i] < e50[i]
        if up and c[i][3] <= e21[i] < closes[i] and closes[i - 1] > e21[i - 1]:
            out[i] = "buy"
        elif dn and c[i][2] >= e21[i] > closes[i] and closes[i - 1] < e21[i - 1]:
            out[i] = "sell"
    return out


FAMILIES = {"ema_cross": ema_cross, "orb": orb, "trend_regime": trend_regime, "vwap_reversion": vwap_reversion, "pullback": pullback}


def signals(family: str, candles: list[tuple], params: dict | None = None) -> list[str | None]:
    return FAMILIES[family](candles, {**DEFAULT_PARAMS, **(params or {})})


def signal_fn_for(family: str, params: dict | None = None):
    """Adaptador para o robô: devolve (lado, t_do_candle) olhando só o último candle fechado (mesma lógica do backtest)."""
    def fn(candles: list[tuple]):
        if len(candles) < 60:
            return None
        side = signals(family, candles, params)[-1]
        return (side, candles[-1][0]) if side else None
    return fn
