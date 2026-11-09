"""Protocolo de aceite das melhorias (treino 60% · validação 20% · teste final 20%, UMA vez, com custos).
   python research_b3/evaluate.py proxy select|test     # proxy de CRIPTO (3 anos de BTC/ETH/SOL em 15m) — só valida a MÁQUINA, não diz nada da B3
   python research_b3/evaluate.py csv DIR select|test   # SEUS dados da B3: DIR/*.csv com colunas time(epoch s),open,high,low,close,volume (M5)
O teste final só roda UMA vez por conjunto de dados (trava em results/<nome>/test.lock.json)."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from research_b3.backtest import Inst, cross_signals, simulate  # noqa: E402
from research_b3.metrics import accept, consistent, summarize  # noqa: E402

from hexadesk_connector.intel import ml  # noqa: E402

LAYERS = {
    "regime": {"regime": {"enabled": True}},
    "noticias": {"news": {"enabled": True}},
    "risco_adaptativo": {"adaptive_risk": {"enabled": True}},
    # fluxo de ordens: precisa de ticks/book gravados — não há como avaliar em candles
}


def load_proxy():
    out = {}
    for n in ("BTCUSDT", "ETHUSDT", "SOLUSDT"):
        rows = json.load(open(ROOT / "research" / "data" / f"{n}_15m.json"))
        out[n] = [(r[0] / 1000, r[1], r[2], r[3], r[4], r[5]) for r in rows]
    # custo escalado para ter a MESMA proporção custo/stop da B3 (WIN: 1 tick por lado + emolumentos ≈ 8% do stop): 0,032% ida e volta sobre stop de 0,4%
    return out, Inst(mode="pct", stop=0.004, rr=1.5, cost_side=0.00016)


def load_csv(d: Path):
    out = {}
    for f in sorted(d.glob("*.csv")):
        out[f.stem] = [(float(r["time"]), float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"]), float(r.get("volume", 0) or 0)) for r in csv.DictReader(open(f))]
    # B3 (WIN): 1 ponto = R$ 0,20; tick 5; 1 tick de slippage por lado; emolumentos+corretagem = PLACEHOLDER (confirme na Clear)
    return out, Inst(mode="points", stop=150, rr=1.5, cost_side=5, fee_rt=0.50, brl_per_point=0.20, open_min=9 * 60 + 5, close_min=17 * 60, flat_min=17 * 60 + 30)


def split(c):
    n = len(c)
    return int(n * 0.6), int(n * 0.8), n


def run(series, inst, cfg, seg, prob=None):
    trades = []
    for name, c in series.items():
        a, b, n = split(c)
        lo, hi = {"train": (60, a), "val": (a, b), "test": (b, n)}[seg]
        trades += simulate(c, inst, cfg, lo, hi, (lambda i, side, nm=name: prob[nm].get(i, 0.0) >= prob["thr"]) if prob else None)
    return summarize(trades)


def ml_gate(series, inst, margin, train_only=True):
    """Treina no TREINO (purgado) e devolve a probabilidade de cada sinal em validação/teste. Limiar = acerto do treino + margem."""
    if not ml.ml_available():
        return None
    X, y, probs = [], [], {}
    models = {}
    base_tr = []
    per = {}
    for name, c in series.items():
        a, b, n = split(c)
        sig = cross_signals(c)
        day_end = {}
        for i, bar in enumerate(c):
            if (int(bar[0]) % 86400) // 60 >= inst.flat_min:
                day_end.setdefault(int(bar[0] // 86400), i)
        win = lambda i: inst.open_min <= (int(c[i][0]) % 86400) // 60 <= inst.close_min
        ds = ml.build_dataset(c, None, (lambda i: inst.stop * c[i + 1][1]) if inst.mode == "pct" else inst.stop, inst.rr, 40,
                              session_end=lambda i: day_end.get(int(c[i][0] // 86400)), allow=win, signals=sig)
        per[name] = (ds, a, b)
    # treino: amostras cujo rótulo TERMINA antes do fim do treino (purga) — todas as séries juntas
    for name, (ds, a, b) in per.items():
        for k in range(len(ds["y"])):
            if ds["t1"][k] < a - 40:
                X.append(ds["X"][k]); y.append(ds["y"][k])
    if len(X) < 300 or len(set(y)) < 2:
        return None
    m = ml.train(X, y)
    thr = sum(y) / len(y) + margin
    out = {"thr": thr}
    for name, (ds, a, b) in per.items():
        idx = [k for k in range(len(ds["y"])) if ds["t0"][k] >= a]
        pr = ml.predict(m, [ds["X"][k] for k in idx])
        out[name] = {ds["t0"][k]: p for k, p in zip(idx, pr)}
    out["train_n"] = len(X)
    return out


def main():
    mode = sys.argv[1]
    if mode == "proxy":
        series, inst = load_proxy(); name, phase = "proxy_cripto", sys.argv[2]
    else:
        series, inst = load_csv(Path(sys.argv[2])); name, phase = "b3_" + Path(sys.argv[2]).name, sys.argv[3]
    res_dir = ROOT / "research_b3" / "results" / name
    res_dir.mkdir(parents=True, exist_ok=True)
    lock = res_dir / "test.lock.json"

    if phase == "select":
        out = {"baseline": {s: run(series, inst, None, s) for s in ("train", "val")}, "layers": {}}
        for k, cfg in LAYERS.items():
            out["layers"][k] = {s: run(series, inst, cfg, s) for s in ("train", "val")}
        best = None
        if ml.ml_available():
            for margin in (0.0, 0.03, 0.06):
                g = ml_gate(series, inst, margin)
                if not g:
                    continue
                v = run(series, inst, None, "val", g)
                out["layers"].setdefault("ml", {})[f"val_margem_{margin}"] = v
                if best is None or v["pf"] > best[1]["pf"]:
                    best = (margin, v, g["train_n"])
            if best:
                out["ml_margem_escolhida"] = best[0]; out["ml_amostras_treino"] = best[2]
        json.dump(out, open(res_dir / "select.json", "w"), indent=1, default=str)
        print(json.dumps({k: {s: {kk: round(vv, 3) for kk, vv in v.items()} for s, v in d.items()} for k, d in {"baseline": out["baseline"], **{l: out["layers"][l] for l in LAYERS}}.items()}, indent=1))
        return

    if lock.exists():
        sys.exit("TESTE FINAL JÁ EXECUTADO para este conjunto de dados (trava). Repetir invalidaria o protocolo; use dados novos.")
    sel = json.load(open(res_dir / "select.json"))
    base = run(series, inst, None, "test")
    res = {"baseline": base, "layers": {}}
    for k, cfg in LAYERS.items():
        r = run(series, inst, cfg, "test")
        ok, why = accept(base, r)
        c_ok, c_why = consistent(sel["baseline"], sel["layers"][k])
        res["layers"][k] = {"metrics": r, "accepted": ok and c_ok, "why_not": why + c_why, "passed_test_only": ok}
    if "ml_margem_escolhida" in sel and ml.ml_available():
        g = ml_gate(series, inst, sel["ml_margem_escolhida"])
        r = run(series, inst, None, "test", g)
        ok, why = accept(base, r)
        res["layers"]["ml"] = {"metrics": r, "accepted": ok, "why_not": why, "passed_test_only": ok, "margem": sel["ml_margem_escolhida"]}
    res["flow"] = "não avaliável: exige ticks e book gravados"
    json.dump(res, open(res_dir / "test.json", "w"), indent=1, default=str)
    lock.write_text(json.dumps({"note": "teste final executado uma única vez"}))
    for k, v in res["layers"].items():
        m = v["metrics"]
        print(f"{k:18s} PF={m['pf']:.2f} DD={m['dd']:.3f} Sharpe={m['sharpe']:.2f} n={m['trades']}  => {'ACEITA' if v['accepted'] else 'reprovada'}")
    print(f"{'baseline':18s} PF={base['pf']:.2f} DD={base['dd']:.3f} Sharpe={base['sharpe']:.2f} n={base['trades']}")


if __name__ == "__main__":
    main()
