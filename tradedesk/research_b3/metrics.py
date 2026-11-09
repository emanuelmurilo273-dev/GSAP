from __future__ import annotations

import math


def pf(pnls):
    gw, gl = sum(x for x in pnls if x > 0), -sum(x for x in pnls if x < 0)
    return gw / gl if gl > 0 else (float("inf") if gw > 0 else 0.0)


def summarize(trades: list[dict]) -> dict:
    by_day: dict[int, float] = {}
    eq = peak = dd = 0.0
    for t in sorted(trades, key=lambda x: x["t_close"]):
        by_day[t["day"]] = by_day.get(t["day"], 0.0) + t["pnl"]
        eq += t["pnl"]; peak = max(peak, eq); dd = max(dd, peak - eq)
    d = list(by_day.values())
    mean = sum(d) / len(d) if d else 0.0
    sd = math.sqrt(sum((x - mean) ** 2 for x in d) / (len(d) - 1)) if len(d) > 1 else 0.0
    p = [t["pnl"] for t in trades]
    return {"trades": len(trades), "pnl": sum(p), "pf": pf(p), "dd": dd, "sharpe": (mean / sd * math.sqrt(252)) if sd else 0.0, "win": (sum(1 for x in p if x > 0) / len(p)) if p else 0.0}


def accept(base: dict, layer: dict, min_trades: int = 100) -> tuple[bool, list[str]]:
    """Uma camada só entra se, FORA DA AMOSTRA e já com custos, superar a versão atual em fator de lucro, drawdown e Sharpe
    E for lucrativa por si só (PF > 1) com operações suficientes. 'Perder menos' operando menos NÃO basta."""
    why = []
    if layer["trades"] < min_trades: why.append(f"só {layer['trades']} operações (< {min_trades})")
    if not layer["pf"] > base["pf"]: why.append("fator de lucro não superou o da versão atual")
    if not layer["dd"] <= base["dd"]: why.append("drawdown pior que o da versão atual")
    if not layer["sharpe"] > base["sharpe"]: why.append("Sharpe não superou o da versão atual")
    if not layer["pf"] > 1.0: why.append("ainda perde dinheiro depois dos custos (PF ≤ 1): melhorar um resultado negativo não é lucro")
    return (not why), why


def consistent(base_sel: dict, layer_sel: dict) -> tuple[bool, list[str]]:
    """REGRA DE CONSISTÊNCIA (criada depois que o proxy mostrou uma camada passar só no teste, depois de ir pior no treino e na validação —
    isso é sorte, não vantagem): a camada não pode ter fator de lucro PIOR que a versão atual em NENHUM dos trechos já vistos (treino e validação)."""
    why = [f"fator de lucro pior que a base no trecho '{seg}' ({layer_sel[seg]['pf']:.2f} < {base_sel[seg]['pf']:.2f})" for seg in ("train", "val") if layer_sel[seg]["pf"] < base_sel[seg]["pf"]]
    return (not why), why
