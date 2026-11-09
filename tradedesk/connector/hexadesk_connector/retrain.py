"""Retreino do modelo (LightGBM) com o histórico PRÓPRIO gravado pelo conector (ticks → candles de 5 min + saldo de agressores por candle).
NUNCA coloca o modelo em uso: só REGISTRA um DESAFIANTE. Quem decide é o campeão x desafiante (≥ 10 pregões em sombra) e o seu clique no painel.
Se o modelo não for melhor que "operar todos os sinais" fora da amostra (validação purgada), NADA é registrado."""
from __future__ import annotations

import copy
from datetime import datetime
from pathlib import Path

from .intel import ml
from .intel.indicators import ema
from .intel.pipeline import merged
from .live import BarSeries, TickRec, read_ticks

MIN_SAMPLES = 300
MIN_OOS = 300       # amostras FORA DA AMOSTRA mínimas para concluir algo
MIN_FILTERED = 100


def bars_from_ticks(ticks: list[TickRec], tf_sec: int = 300) -> tuple[list[tuple], list[float]]:
    """Candles (t,o,h,l,c,v) + desequilíbrio de agressão de cada candle ((compra-venda)/total), só com negócios."""
    series = BarSeries("M5", keep=10**9)
    flow: dict[int, list[float]] = {}
    for t in sorted(ticks, key=lambda x: x.t_msc):
        price = t.last if t.last > 0 else (t.bid + t.ask) / 2
        if price <= 0:
            continue
        b = series.update(t.t_msc // 1000, price, t.vol if t.is_trade else 0.0)
        if b and t.is_trade:
            f = flow.setdefault(int(b[0]), [0.0, 0.0])
            f[0 if t.side == "buy" else 1] += t.vol
    bars = [tuple(b) for b in series.bars]
    imb = [((flow[int(b[0])][0] - flow[int(b[0])][1]) / (sum(flow[int(b[0])]) or 1)) if int(b[0]) in flow else float("nan") for b in bars]
    return bars, imb


def retrain_from_bars(per_symbol: dict[str, tuple[list[tuple], list[float]]], settings: dict, champion_cfg: dict | None, out_dir: Path, store=None,
                      when: datetime | None = None) -> dict:
    X, y, t0, t1, pnl = [], [], [], [], []
    for sym, (c, imb) in per_symbol.items():
        if len(c) < 200:
            continue
        closes = [b[4] for b in c]
        f9, f21 = ema(closes, 9), ema(closes, 21)
        sig = [None] * len(c)
        for i in range(40, len(c)):
            sig[i] = "buy" if f9[i - 1] <= f21[i - 1] and f9[i] > f21[i] else "sell" if f9[i - 1] >= f21[i - 1] and f9[i] < f21[i] else None
        root = sym[:3]
        stop = float(settings["stop_points_win"] if root == "WIN" else settings["stop_points_wdo"])
        day_end: dict[int, int] = {}
        for i, b in enumerate(c):
            if (int(b[0]) % 86400) // 60 >= 17 * 60 + 30:
                day_end.setdefault(int(b[0] // 86400), i)
        ds = ml.build_dataset(c, None, stop, float(settings.get("rr", 1.5)), 40, session_end=lambda i: day_end.get(int(c[i][0] // 86400)), signals=sig,
                              flow_at=lambda i: {"imbalance": imb[i]},
                              allow=lambda i: 9 * 60 + 5 <= (int(c[i][0]) % 86400) // 60 <= 17 * 60)
        X += ds["X"]; y += ds["y"]; pnl += ds["pnl"]
        t0 += [int(c[k][0]) for k in ds["t0"]]; t1 += [int(c[k][0]) for k in ds["t1"]]       # tempos absolutos: séries diferentes ficam comparáveis
    if len(y) < MIN_SAMPLES or len(set(y)) < 2:
        return {"status": f"dados insuficientes ({len(y)} sinais; preciso de {MIN_SAMPLES}+). Deixe o conector gravando mais pregões.", "samples": len(y)}
    if not ml.ml_available():
        return {"status": "bibliotecas de ML não instaladas (pip install -r requirements-ml.txt)", "samples": len(y)}
    ds = {"X": X, "y": y, "t0": t0, "t1": t1, "pnl": pnl, "side": []}
    ev = ml.oos_evaluation(ds, n_splits=5, embargo=3600)
    if not ev.get("samples"):
        return {"status": "validação purgada sem amostras suficientes", "samples": len(y)}
    summary = {"samples": len(y), "oos_samples": ev["samples"], "auc": round(ev["auc"], 3), "base": ev["base"], "filtered": ev["filtered"]}
    lb = ml.auc_lower_bound(ev["auc"], ev.get("pos", 0), ev.get("neg", 0))
    summary["auc_limite_inferior_95"] = round(lb, 3)
    if ev["samples"] < MIN_OOS:
        return {"status": f"poucas amostras fora da amostra ({ev['samples']} < {MIN_OOS}): sem como concluir; nada registrado", **summary}
    better = lb > 0.5 and ev["filtered"]["n"] >= MIN_FILTERED and ev["filtered"]["avg"] > ev["base"]["avg"]
    if not better:
        return {"status": "modelo NÃO melhorou fora da amostra: nada registrado", **summary}
    model = ml.train(X, y)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"model_{(when or datetime.now()).strftime('%Y%m%d')}.txt"
    ml.save_model(model, str(path))
    cfg = copy.deepcopy(merged(champion_cfg))
    base_rate = sum(y) / len(y)
    cfg["ml"].update(enabled=True, model_path=str(path), margin=0.03, threshold=round(base_rate + 0.03, 4))
    vid = None
    if store is not None:
        vid = store.register_version(f"Desafiante ML {(when or datetime.now()).strftime('%Y-%m-%d')}", "challenger", cfg,
                                     f"retreino automático; AUC fora da amostra {summary['auc']}; PF filtrado {summary['filtered']['pf']} x base {summary['base']['pf']}")
    return {"status": "desafiante registrado (NÃO está em uso: precisa de ≥ 10 pregões em sombra e da sua aprovação)", "version_id": vid, "model": str(path), **summary}


def retrain(data_dir: Path, models_dir: Path, store, settings: dict, champion_cfg: dict | None) -> dict:
    per: dict[str, tuple] = {}
    for f in sorted(Path(data_dir).glob("*/*_ticks.csv.gz")):
        sym = f.name.split("_")[0]
        if sym[:3] not in ("WIN", "WDO"):
            continue
        per.setdefault(sym, ([], []))
    for sym in list(per):
        ticks: list[TickRec] = []
        for f in sorted(Path(data_dir).glob(f"*/{sym}_ticks.csv.gz")):
            ticks += read_ticks(f)
        per[sym] = bars_from_ticks(ticks)
    return retrain_from_bars(per, settings, champion_cfg, models_dir, store)
