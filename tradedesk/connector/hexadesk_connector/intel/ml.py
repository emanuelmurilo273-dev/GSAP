"""d) Modelo de machine learning (LightGBM): probabilidade de acerto de cada SINAL. Treino com validação PURGADA (purged walk-forward).

Regras anti-autoengano:
  * features só usam candles já FECHADOS até o sinal (nada do futuro);
  * rótulo = "triple barrier" do próprio robô (stop / alvo / fim da sessão), stop vence se os dois couberem no mesmo candle;
  * validação em janelas que avançam no tempo; do treino são REMOVIDAS as amostras cujo rótulo (que olha o futuro) se sobrepõe ao período de teste;
  * o limiar de entrada não é escolhido olhando o teste: é a taxa de acerto do próprio treino + uma margem fixa.
"""
from __future__ import annotations

import math
from typing import Callable

from .indicators import adx, atr, bollinger_width, ema, rsi, session_vwap

FEATURES = ["ret1", "ret3", "ret12", "atr_pct", "adx", "bb_width", "ema_gap", "rsi", "vol_ratio", "hour", "dow", "dist_vwap", "side", "bar_imb", "book_imb"]
NAN = float("nan")


def ml_available() -> bool:
    try:
        import lightgbm, numpy  # noqa: F401
        return True
    except ImportError:
        return False


def precompute(c: list[tuple], day_of: Callable[[float], int] = lambda t: int(t // 86400)) -> dict:
    closes = [b[4] for b in c]
    a = atr(c)
    return {"adx": adx(c), "atr": a, "bbw": bollinger_width(closes), "rsi": rsi(closes), "ema9": ema(closes, 9), "ema21": ema(closes, 21),
            "vwap": session_vwap(c, day_of), "vol": [b[5] for b in c]}


def features_at(c: list[tuple], pre: dict, i: int, side: str, flow: dict | None = None) -> list[float]:
    """Vetor de features no candle i (FECHADO). `flow` = {'imbalance','book_imbalance'} se houver (senão NaN: o LightGBM lida)."""
    cl = lambda k: c[i][4] / c[i - k][4] - 1 if i >= k else 0.0
    v = pre["vol"]
    mv = sum(v[max(0, i - 19): i + 1]) / len(v[max(0, i - 19): i + 1])
    t = c[i][0]
    return [cl(1), cl(3), cl(12), pre["atr"][i] / c[i][4], pre["adx"][i], pre["bbw"][i], pre["ema9"][i] / pre["ema21"][i] - 1, pre["rsi"][i],
            (v[i] / mv) if mv else 1.0, (t % 86400) / 3600, (t // 86400 + 4) % 7, c[i][4] / pre["vwap"][i] - 1, 1.0 if side == "buy" else -1.0,
            (flow or {}).get("imbalance", NAN), (flow or {}).get("book_imbalance", NAN)]


def triple_barrier(c: list[tuple], i: int, side: str, stop: float, target: float, max_bars: int, end_idx: int | None = None, cost: float = 0.0):
    """Entra na abertura do candle i+1. Devolve (rótulo 1/0, índice final do rótulo, pnl em pontos já com custo). Stop vence empate no candle."""
    if i + 1 >= len(c):
        return None
    sign = 1 if side == "buy" else -1
    entry = c[i + 1][1]
    last = min(len(c) - 1, i + max_bars, end_idx if end_idx is not None else 10**9)
    for j in range(i + 1, last + 1):
        lo, hi = c[j][3], c[j][2]
        hit_stop = lo <= entry - stop if sign > 0 else hi >= entry + stop
        hit_tgt = hi >= entry + target if sign > 0 else lo <= entry - target
        if hit_stop:
            return 0, j, -stop - cost
        if hit_tgt:
            return 1, j, target - cost
    pnl = sign * (c[last][4] - entry) - cost
    return (1 if pnl > 0 else 0), last, pnl


def build_dataset(c: list[tuple], signal_fn: Callable | None, stop, rr: float, max_bars: int, cost: float = 0.0,
                  session_end: Callable[[int], int | None] | None = None, flow_at: Callable[[int], dict | None] | None = None,
                  warmup: int = 60, allow: Callable[[int], bool] | None = None, signals: list | None = None) -> dict:
    """Percorre os candles; a cada sinal da estratégia monta (features, rótulo, janela). `session_end(i)` = índice do candle de zeragem da sessão."""
    pre = precompute(c)
    X, y, t0, t1, side_l, pnl = [], [], [], [], [], []
    for i in range(warmup, len(c) - 2):
        if allow and not allow(i):
            continue
        sig = ((signals[i], c[i][0]) if signals[i] else None) if signals is not None else signal_fn(c[: i + 1])
        if not sig:
            continue
        side = sig[0]
        st = stop(i) if callable(stop) else stop            # stop pode depender do preço (modo pct)
        r = triple_barrier(c, i, side, st, st * rr, max_bars, session_end(i) if session_end else None, cost)
        if r is None:
            continue
        X.append(features_at(c, pre, i, side, flow_at(i) if flow_at else None)); y.append(r[0]); t0.append(i); t1.append(r[1]); side_l.append(side); pnl.append(r[2])
    return {"X": X, "y": y, "t0": t0, "t1": t1, "side": side_l, "pnl": pnl}


def purged_walk_forward(t0: list[int], t1: list[int], n_splits: int = 5, embargo: int = 0):
    """Gera (índices de treino, índices de teste). Teste = bloco k (cronológico); treino = amostras ANTERIORES cujo rótulo termina antes do início
    do teste (menos o embargo): o que se sobrepõe ao teste é purgado."""
    n = len(t0)
    order = sorted(range(n), key=lambda i: t0[i])
    size = n // (n_splits + 1)
    for k in range(1, n_splits + 1):
        test = order[k * size: (k + 1) * size if k < n_splits else n]
        if not test:
            continue
        start = min(t0[i] for i in test)
        train = [i for i in order[: k * size] if t1[i] < start - embargo]
        yield train, test


def auc(y: list[int], p: list[float]) -> float:
    pairs = sorted(zip(p, y))
    ranks, i = [0.0] * len(pairs), 0
    while i < len(pairs):
        j = i
        while j + 1 < len(pairs) and pairs[j + 1][0] == pairs[i][0]:
            j += 1
        for k in range(i, j + 1):
            ranks[k] = (i + j) / 2 + 1
        i = j + 1
    pos = sum(1 for _, yy in pairs if yy == 1)
    neg = len(pairs) - pos
    if not pos or not neg:
        return 0.5
    return (sum(r for r, (_, yy) in zip(ranks, pairs) if yy == 1) - pos * (pos + 1) / 2) / (pos * neg)


def auc_lower_bound(a: float, pos: int, neg: int, z: float = 1.645) -> float:
    """Limite inferior (95%, unilateral) do AUC — erro-padrão de Hanley & McNeil. AUC de 0,53 com 100 amostras é ruído: aqui ele não passa de 0,5."""
    if pos < 2 or neg < 2:
        return 0.0
    q1, q2 = a / (2 - a), 2 * a * a / (1 + a)
    se = math.sqrt(max(0.0, (a * (1 - a) + (pos - 1) * (q1 - a * a) + (neg - 1) * (q2 - a * a)) / (pos * neg)))
    return a - z * se


def profit_factor(pnls: list[float]) -> float | None:
    gw, gl = sum(x for x in pnls if x > 0), -sum(x for x in pnls if x < 0)
    return gw / gl if gl > 0 else (float("inf") if gw > 0 else None)


LGB_PARAMS = dict(objective="binary", num_leaves=15, learning_rate=0.03, min_data_in_leaf=40, bagging_fraction=0.8, bagging_freq=1,
                  feature_fraction=0.8, lambda_l2=1.0, seed=7, verbose=-1, num_threads=1, deterministic=True)
ROUNDS = 200


def train(X: list[list[float]], y: list[int]):
    """LightGBM nativo (não precisa de scikit-learn). Pequeno e regularizado de propósito: poucos dados → modelo simples."""
    import lightgbm as lgb
    import numpy as np
    return lgb.train(LGB_PARAMS, lgb.Dataset(np.array(X, dtype=float), label=np.array(y)), num_boost_round=ROUNDS)


def predict(model, X: list[list[float]]) -> list[float]:
    import numpy as np
    return [float(p) for p in model.predict(np.array(X, dtype=float))]


def oos_evaluation(ds: dict, n_splits: int = 5, embargo: int = 0, margin: float = 0.03, min_train: int = 200) -> dict:
    """Probabilidades FORA DA AMOSTRA (purged walk-forward) e comparação filtrado × sem filtro (com os custos já embutidos no pnl)."""
    n = len(ds["y"])
    p_oos: list[float | None] = [None] * n
    thr: dict[int, float] = {}
    for train_idx, test_idx in purged_walk_forward(ds["t0"], ds["t1"], n_splits, embargo):
        if len(train_idx) < min_train or len({ds["y"][i] for i in train_idx}) < 2:
            continue
        m = train([ds["X"][i] for i in train_idx], [ds["y"][i] for i in train_idx])
        base = sum(ds["y"][i] for i in train_idx) / len(train_idx)
        for i, pr in zip(test_idx, predict(m, [ds["X"][i] for i in test_idx])):
            p_oos[i], thr[i] = pr, base + margin
    ev = [i for i in range(n) if p_oos[i] is not None]
    if not ev:
        return {"samples": 0}
    yy, pp = [ds["y"][i] for i in ev], [p_oos[i] for i in ev]
    keep = [i for i in ev if p_oos[i] >= thr[i]]
    allp, kp = [ds["pnl"][i] for i in ev], [ds["pnl"][i] for i in keep]
    return {"samples": len(ev), "pos": sum(yy), "neg": len(yy) - sum(yy), "auc": auc(yy, pp), "base": {"n": len(allp), "pf": profit_factor(allp), "avg": sum(allp) / len(allp)},
            "filtered": {"n": len(kp), "pf": profit_factor(kp), "avg": (sum(kp) / len(kp)) if kp else 0.0}, "p_oos": p_oos, "keep": keep}


def save_model(model, path: str) -> None:
    model.save_model(path)


def load_model(path: str):
    import lightgbm as lgb
    return lgb.Booster(model_file=path)


predict_booster = predict
