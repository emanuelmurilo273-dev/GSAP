"""Simulador de candles que reproduz o robô: mesmos sinais, stop/alvo (stop vence empate), zeragem de fim de sessão, camadas de inteligência e
tamanho adaptativo. Custos por lado: slippage + taxa. Mode 'points' (B3: R$/ponto, tick, emolumentos por contrato) ou 'pct' (proxy de cripto)."""
from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "connector"))
from hexadesk_connector.intel import ml  # noqa: E402
from hexadesk_connector.intel.indicators import ema  # noqa: E402
from hexadesk_connector.intel.pipeline import IntelPipeline  # noqa: E402
from hexadesk_connector.risk import adaptive_size  # noqa: E402
from hexadesk_connector.safety import technical_stop  # noqa: E402


@dataclass
class Inst:
    mode: str = "pct"            # 'pct' | 'points'
    stop: float = 0.004          # pct: fração do preço | points: pontos
    rr: float = 1.5
    cost_side: float = 0.0015    # pct: fração por lado (taxa+slippage) | points: slippage em PONTOS por lado
    fee_rt: float = 0.0          # points: emolumentos+corretagem por contrato (ida e volta), em R$
    brl_per_point: float = 1.0
    open_min: int = 12 * 60 + 5   # minutos do dia em que pode abrir
    close_min: int = 20 * 60      # última abertura
    flat_min: int = 20 * 60 + 30  # zeragem
    base_units: int = 4           # tamanho base (para o risco adaptativo reduzir)
    atr_stop: bool = False        # v2: stop técnico (estrutura + ATR) com risco por operação CONSTANTE (a mão encolhe quando o stop alarga)
    stop_cap: float = 0.012       # v2 (modo pct): stop técnico máximo, fração do preço; acima disso não entra
    halt_losses: int = 0          # v2: depois de N perdas seguidas no dia, para por hoje (0 = desligado)


def cross_signals(c: list[tuple]) -> list[str | None]:
    """Mesma regra de strategy.baseline_signal (EMA9 × EMA21), calculada UMA vez (O(n)) — equivalência testada."""
    closes = [b[4] for b in c]
    f, s = ema(closes, 9), ema(closes, 21)
    out: list[str | None] = [None] * len(c)
    for i in range(40, len(c)):
        out[i] = "buy" if f[i - 1] <= s[i - 1] and f[i] > s[i] else "sell" if f[i - 1] >= s[i - 1] and f[i] < s[i] else None
    return out


def _min(t: float) -> int:
    return int(t % 86400) // 60


def simulate(c: list[tuple], inst: Inst, cfg: dict | None = None, lo: int = 60, hi: int | None = None, prob_gate=None) -> list[dict]:
    """Percorre c[lo:hi]. `prob_gate(i, side)->bool` aplica o filtro de ML (probabilidade fora da amostra) quando fornecido.
    Retorna trades: {t_open, t_close, day, pnl, size, ret}. `pnl`/`ret` já incluem custos e o tamanho (size/base)."""
    hi = hi or len(c)
    sig = cross_signals(c)
    pipe = IntelPipeline(cfg)
    ar = pipe.cfg["adaptive_risk"]
    trades, pos, streak, last = [], None, 0, None
    dstreak, dday = 0, None
    for i in range(lo, hi):
        b = c[i]
        m = _min(b[0])
        if pos:
            s = 1 if pos["side"] == "buy" else -1
            stop_hit = b[3] <= pos["sl"] if s > 0 else b[2] >= pos["sl"]
            tp_hit = b[2] >= pos["tp"] if s > 0 else b[3] <= pos["tp"]
            exit_p = pos["sl"] if stop_hit else pos["tp"] if tp_hit else b[4] if m >= inst.flat_min or int(b[0] // 86400) != pos["day"] else None
            if exit_p is not None:
                trades.append(_close(pos, exit_p, b[0], inst))
                streak = streak + 1 if trades[-1]["pnl"] < 0 else 0
                dstreak = dstreak + 1 if trades[-1]["pnl"] < 0 else 0
                pos = None
        day_i = int(b[0] // 86400)
        if day_i != dday:
            dday, dstreak = day_i, 0
        if pos or sig[i] is None or not (inst.open_min <= m <= inst.close_min):
            continue
        if inst.halt_losses and dstreak >= inst.halt_losses:
            continue
        side = sig[i]
        ctx = {"side": side, "candles": c[max(0, i - 360): i + 1], "now": datetime.fromtimestamp(b[0], tz=timezone.utc), "flow": None, "user_events": [], "symbol": "X"}
        dec = pipe.evaluate(ctx) if pipe.any_enabled else None
        if dec is not None and not dec.allow:
            continue
        if prob_gate is not None and not prob_gate(i, side):
            continue
        n = adaptive_size(inst.base_units, streak, last, bool(dec and dec.high_vol), ar["after_losses"], ar["mult"], ar["high_vol_mult"], ar["enabled"])
        last = n
        if i + 1 >= hi:
            break
        entry = c[i + 1][1]
        stop = inst.stop * entry if inst.mode == "pct" else inst.stop
        riskadj = 1.0
        if inst.atr_stop:
            tick = 0.0001 * entry if inst.mode == "pct" else 5.0
            cap = inst.stop_cap * entry if inst.mode == "pct" else inst.stop * 3
            dist, _ = technical_stop(c[max(0, i - 120): i + 1], side, entry, tick, cap)
            if dist is None:
                continue
            riskadj, stop = min(1.0, stop / dist), dist
        sgn = 1 if side == "buy" else -1
        pos = {"side": side, "entry": entry, "sl": entry - sgn * stop, "tp": entry + sgn * stop * inst.rr, "size": n, "riskadj": riskadj, "t_open": c[i + 1][0], "day": int(c[i + 1][0] // 86400)}
        # (a entrada ocorre na abertura do próximo candle; o gerenciamento começa nele)
        s2 = sgn
        nb = c[i + 1]
        if (nb[3] <= pos["sl"] if s2 > 0 else nb[2] >= pos["sl"]):
            trades.append(_close(pos, pos["sl"], nb[0], inst)); streak = streak + 1; pos = None
    if pos:
        trades.append(_close(pos, c[hi - 1][4], c[hi - 1][0], inst))
    return trades


def _close(pos: dict, exit_p: float, t: float, inst: Inst) -> dict:
    sgn = 1 if pos["side"] == "buy" else -1
    frac = pos["size"] / inst.base_units * pos.get("riskadj", 1.0)
    if inst.mode == "pct":
        r = ((exit_p - pos["entry"]) * sgn / pos["entry"] - 2 * inst.cost_side) * frac
        return {"t_open": pos["t_open"], "t_close": t, "day": pos["day"], "pnl": r, "size": pos["size"], "side": pos["side"]}
    pnl = ((exit_p - pos["entry"]) * sgn - 2 * inst.cost_side) * inst.brl_per_point * pos["size"] - inst.fee_rt * pos["size"]
    return {"t_open": pos["t_open"], "t_close": t, "day": pos["day"], "pnl": pnl, "size": pos["size"], "side": pos["side"]}
