"""Antes × depois das regras v2 no mercado-proxy (candles de cripto, custo escalado como o da B3).
REGRAS FIXADAS ANTES de olhar os números (nenhum parâmetro foi ajustado aqui): stop técnico (1×–3×ATR, estrutura de 8 barras, risco constante),
alvo 1,5× o stop, parar o dia após 2 perdas seguidas. ATENÇÃO: o trecho 'teste' do proxy já foi consumido pela pesquisa das camadas
(RESEARCH_B3.md), então os números abaixo são DESCRITIVOS — não são uma prova fora da amostra. Prova só com dados reais da B3."""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

from research_b3.backtest import simulate
from research_b3.evaluate import load_proxy, split
from research_b3.metrics import summarize

OUT = Path(__file__).resolve().parent / "results" / "proxy_cripto" / "regras_v2.json"


def run(series, inst, seg):
    tr = []
    for c in series.values():
        a, b, n = split(c)
        lo, hi = {"train": (60, a), "val": (a, b), "test": (b, n), "all": (60, n)}[seg]
        tr += simulate(c, inst, None, lo, hi)
    return summarize(tr)


def main():
    series, base = load_proxy()
    variants = {
        "antes (stop fixo 0,4%, alvo 1,5×)": base,
        "só stop técnico (ATR + estrutura)": replace(base, atr_stop=True),
        "só parar após 2 perdas no dia": replace(base, halt_losses=2),
        "v2 completo (stop técnico + parar após 2 perdas)": replace(base, atr_stop=True, halt_losses=2),
    }
    res = {}
    print(f"{'variante':52} {'trecho':6} {'ops':>5} {'PF':>5} {'pnl':>8} {'acerto':>6} {'DD':>6}")
    for name, inst in variants.items():
        res[name] = {}
        for seg in ("train", "val", "test"):
            m = run(series, inst, seg)
            res[name][seg] = m
            print(f"{name:52} {seg:6} {m['trades']:5d} {m['pf']:5.2f} {m['pnl']:8.3f} {m['win']:6.2f} {m['dd']:6.2f}")
    OUT.write_text(json.dumps(res, indent=1, default=str))


if __name__ == "__main__":
    main()
