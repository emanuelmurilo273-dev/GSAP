"""Protocolo de pesquisa das FAMÍLIAS de estratégia (regras fixadas ANTES de rodar; nada é ajustado depois de ver o teste):

  1. Cada família tem UM conjunto de parâmetros, registrado em connector/hexadesk_connector/strategies.py (sem grade, sem otimização).
  2. Regras v2 em todas: stop técnico ATR, alvo 1,5×, parar o dia após 2 perdas, custos reais (proxy: custo escalado; B3: 1 tick por lado + emolumentos).
  3. SELEÇÃO (`select`): em treino E validação, fator de lucro > 1 com ≥ 100 operações em cada → "candidata". Só candidatas vão ao teste.
  4. TESTE FINAL (`test`): roda UMA vez (trava em disco) em dados que a seleção nunca viu:
        proxy → ativos inéditos (BNB, XRP, ADA); selecionar em BTC/ETH/SOL.   B3 → o trecho final (20%) de WIN e WDO.
  5. APROVAÇÃO: fator de lucro ≥ 1,3 · drawdown ≤ 10% · ≥ 300 trades · positiva nos dois ativos (ou o ativo ruim é desligado).
  6. SÓ os dados da B3 (`csv`) podem gravar a aprovação que destrava o real (--gravar-aprovacao). O proxy NUNCA aprova nada para a B3.

Uso:  python -m research_b3.familias proxy select | proxy test
      python -m research_b3.familias csv PASTA select | csv PASTA test [--gravar-aprovacao]     (PASTA com WIN.csv e WDO.csv: time,open,high,low,close,volume)"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "connector"))
from hexadesk_connector.strategies import FAMILIES, signals  # noqa: E402

from research_b3.backtest import Inst, simulate  # noqa: E402
from research_b3.evaluate import load_csv, split  # noqa: E402
from research_b3.metrics import summarize  # noqa: E402

SEL_PROXY, TEST_PROXY = ("BTCUSDT", "ETHUSDT", "SOLUSDT"), ("BNBUSDT", "XRPUSDT", "ADAUSDT")
MIN_SEL_TRADES = 100
EQUITY_B3 = 10_000.0
APPROVE = {"pf": 1.3, "dd": 0.10, "trades": 300}


def load_proxy_series(names):
    out = {}
    for n in names:
        rows = json.load(open(ROOT / "research" / "data" / f"{n}_15m.json"))
        out[n] = [(r[0] / 1000, r[1], r[2], r[3], r[4], r[5]) for r in rows]
    return out


def inst_proxy():
    # custo escalado p/ ter a MESMA proporção custo/stop da B3 (ver evaluate.py); v2: stop técnico, alvo 1,5×, parar após 2 perdas
    return Inst(mode="pct", stop=0.004, rr=1.5, cost_side=0.00016, atr_stop=True, halt_losses=2), {"session_start_min": 13 * 60 + 30}


def inst_b3():
    i = load_csv_inst()
    return replace(i, atr_stop=True, halt_losses=2, base_units=1), {"session_start_min": 9 * 60}


def load_csv_inst():
    return load_csv.__globals__["Inst"](mode="points", stop=150, rr=1.5, cost_side=5, fee_rt=0.50, brl_per_point=0.20, open_min=9 * 60 + 15, close_min=17 * 60, flat_min=17 * 60 + 30)


def run(series, inst, params, fam, seg):
    trades, per = [], {}
    for name, c in series.items():
        a, b, n = split(c)
        lo, hi = {"train": (60, a), "val": (a, b), "test": (b, n), "all": (60, n)}[seg]
        t = simulate(c, inst, None, lo, hi, signals=signals(fam, c, params))
        per[name] = summarize(t)
        trades += t
    return summarize(trades), per


def dd_pct(m, mode):
    return m["dd"] / EQUITY_B3 if mode == "points" else m["dd"]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    gravar = "--gravar-aprovacao" in sys.argv
    mode = args[0]
    if mode == "proxy":
        inst, params = inst_proxy(); phase = args[1]; name = "familias_proxy"
        sel_series, test_series, seg_test = load_proxy_series(SEL_PROXY), load_proxy_series(TEST_PROXY), "all"
    else:
        inst, params = inst_b3(); phase = args[2]; name = "familias_b3_" + Path(args[1]).name
        series, _ = load_csv(Path(args[1])); sel_series, test_series, seg_test = series, series, "test"
    res_dir = ROOT / "research_b3" / "results" / name
    res_dir.mkdir(parents=True, exist_ok=True)
    lock = res_dir / "test.lock.json"

    if phase == "select":
        out = {}
        print(f"{'família':16} {'trecho':6} {'ops':>5} {'PF':>5} {'DD':>7} {'pnl':>9}")
        for fam in FAMILIES:
            out[fam] = {}
            for seg in ("train", "val"):
                m, per = run(sel_series, inst, params, fam, seg)
                out[fam][seg] = {**m, "per_asset": per}
                print(f"{fam:16} {seg:6} {m['trades']:5d} {m['pf']:5.2f} {dd_pct(m, inst.mode):7.3f} {m['pnl']:9.3f}")
            f = out[fam]
            f["candidate"] = fam != "ema_cross" and all(f[s]["pf"] > 1.0 and f[s]["trades"] >= MIN_SEL_TRADES for s in ("train", "val"))
        json.dump(out, open(res_dir / "select.json", "w"), indent=1, default=str)
        print("\ncandidatas ao teste final:", [k for k, v in out.items() if v["candidate"]] or "NENHUMA")
        return

    if lock.exists():
        sys.exit("TESTE FINAL JÁ EXECUTADO (trava). Repetir invalidaria o protocolo; use dados novos.")
    sel = json.load(open(res_dir / "select.json"))
    cands = [k for k, v in sel.items() if v["candidate"]]
    res = {"candidatas": cands, "familias": {}, "aprovada": None}
    print(f"{'família':16} {'ops':>5} {'PF':>5} {'DD%':>6} | por ativo (PF/pnl)")
    for fam in ["ema_cross"] + cands:       # a base entra só como referência
        m, per = run(test_series, inst, params, fam, seg_test)
        dd = dd_pct(m, inst.mode)
        reasons = []
        if fam == "ema_cross": reasons.append("estratégia de base (referência, não candidata)")
        good = [a for a, v in per.items() if v["pnl"] > 0 and v["pf"] > 1]
        if not good: reasons.append("nenhum ativo positivo")
        if not m["pf"] >= APPROVE["pf"]: reasons.append(f"PF {m['pf']:.2f} < {APPROVE['pf']}")
        if not dd <= APPROVE["dd"]: reasons.append(f"drawdown {dd * 100:.1f}% > {APPROVE['dd'] * 100:.0f}%")
        if not m["trades"] >= APPROVE["trades"]: reasons.append(f"{m['trades']} trades < {APPROVE['trades']}")
        res["familias"][fam] = {**m, "dd_pct": dd, "per_asset": per, "aprovada": not reasons, "motivos": reasons, "ativos_desligados": [a for a in per if a not in good]}
        print(f"{fam:16} {m['trades']:5d} {m['pf']:5.2f} {dd * 100:6.1f} | " + "  ".join(f"{a}:{v['pf']:.2f}/{v['pnl']:.2f}" for a, v in per.items()) + ("  => APROVADA" if not reasons else "  => reprovada: " + "; ".join(reasons)))
    ok = [k for k, v in res["familias"].items() if v["aprovada"]]
    res["aprovada"] = ok[0] if ok else None
    json.dump(res, open(res_dir / "test.json", "w"), indent=1, default=str)
    lock.write_text(json.dumps({"note": "teste final executado uma única vez"}))
    if not ok:
        print("\nRESULTADO: nenhuma família passou. O robô AINDA NÃO TEM VANTAGEM; o modo real continua travado.")
    elif mode == "proxy":
        print("\n(proxy de cripto: serve para testar o método; NÃO aprova nada para a B3.)")
    elif gravar:
        import requests
        v = res["familias"][ok[0]]
        body = {"approved": True, "family": ok[0], "pf": v["pf"], "dd": v["dd_pct"], "trades": v["trades"], "expectancy": v["pnl"] / max(v["trades"], 1), "disabled": v["ativos_desligados"]}
        r = requests.post(os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/app_settings", json={"key": "b3_approval", "value": body},
                          headers={"apikey": os.environ["SUPABASE_KEY"], "Authorization": "Bearer " + os.environ["SUPABASE_KEY"], "Prefer": "resolution=merge-duplicates"}, timeout=30)
        print("aprovação gravada" if r.ok else f"falha ao gravar: {r.status_code}")
    else:
        print("\nPassou nos critérios. Para registrar a aprovação, o teste final (único) precisa ser rodado com --gravar-aprovacao.")


if __name__ == "__main__":
    main()
