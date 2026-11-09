"""Pipeline de decisão: aplica, em ordem, as camadas ligadas na versão (config) e explica o porquê ("Não entrei: mercado lateral").
Tudo DESLIGADO por padrão: com a config padrão a decisão é sempre "pode entrar" (comportamento idêntico ao robô sem camadas)."""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime

from . import flow as flowmod
from . import ml
from .news import NewsFilter
from .regime import NOMES, TENDENCIA, VOLATIL, classify

DEFAULT_CONFIG: dict = {
    "regime": {"enabled": False, "allowed": [TENDENCIA], "adx_trend": 25.0, "adx_range": 20.0, "vol_rank": 0.9},
    "flow": {"enabled": False, "min_imbalance": 0.10, "use_book": True, "min_book": 0.05},
    "news": {"enabled": False, "window_min": 15, "recurring": True},
    "ml": {"enabled": False, "model_path": None, "margin": 0.03, "threshold": None},
    "adaptive_risk": {"enabled": False, "after_losses": 2, "mult": 0.5, "high_vol_mult": 0.5},
}


def merged(config: dict | None) -> dict:
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    for k, v in (config or {}).items():
        if k in cfg and isinstance(v, dict):
            cfg[k].update(v)
    return cfg


@dataclass
class Decision:
    allow: bool
    reason: str = ""
    regime: str | None = None
    prob: float | None = None
    high_vol: bool = False
    layers: list[str] = field(default_factory=list)   # camadas que participaram

    @property
    def text(self) -> str:
        return self.reason if not self.allow else (self.reason or "entrou")


class IntelPipeline:
    def __init__(self, config: dict | None = None):
        self.cfg = merged(config)
        self._model = None

    @property
    def any_enabled(self) -> bool:
        return any(v.get("enabled") for v in self.cfg.values())

    def evaluate(self, ctx: dict) -> Decision:
        """ctx: side, candles (fechados), now (datetime com fuso), flow (dict|None), user_events (list), symbol."""
        c, layers = self.cfg, []
        regime = None
        # c) notícias
        if c["news"]["enabled"]:
            layers.append("noticias")
            blocked, why = NewsFilter(c["news"]["window_min"], c["news"]["recurring"]).blocked(ctx["now"], ctx.get("user_events"))
            if blocked:
                return Decision(False, f"Não entrei: {why}", layers=layers)
        # a) regime (também calculado quando o risco adaptativo precisa saber se o dia está volátil)
        info = None
        if c["regime"]["enabled"] or c["adaptive_risk"]["enabled"]:
            info = classify(ctx["candles"], c["regime"]["adx_trend"], c["regime"]["adx_range"], c["regime"]["vol_rank"])
            regime = info["regime"]
        if c["regime"]["enabled"]:
            layers.append("regime")
            if regime == VOLATIL:
                return Decision(False, "Não entrei: mercado volátil demais", regime, layers=layers, high_vol=True)
            if regime not in c["regime"]["allowed"]:
                return Decision(False, f"Não entrei: mercado {NOMES.get(regime, regime)}", regime, layers=layers)
        # b) fluxo de ordens
        if c["flow"]["enabled"]:
            layers.append("fluxo")
            ok, why = flowmod.confirms(ctx["side"], ctx.get("flow"), c["flow"]["min_imbalance"], c["flow"]["use_book"], c["flow"]["min_book"])
            if not ok:
                return Decision(False, f"Não entrei: {why}", regime, layers=layers)
        # d) probabilidade do modelo
        prob = None
        if c["ml"]["enabled"]:
            layers.append("ml")
            p, why = self._prob(ctx)
            if p is None:
                return Decision(False, f"Não entrei: {why}", regime, layers=layers)
            prob = p
            thr = c["ml"]["threshold"]
            if thr is None:
                return Decision(False, "Não entrei: modelo sem limiar definido", regime, p, layers=layers)
            if p < thr:
                return Decision(False, f"Não entrei: probabilidade {p:.2f} < {thr:.2f}", regime, p, layers=layers)
        return Decision(True, f"Entrei: {', '.join(layers)} liberaram" if layers else "", regime, prob, layers=layers, high_vol=(regime == VOLATIL))

    def _prob(self, ctx: dict):
        path = self.cfg["ml"]["model_path"]
        if not path:
            return None, "modelo não configurado"
        if not ml.ml_available():
            return None, "bibliotecas de ML não instaladas"
        try:
            if self._model is None:
                self._model = ml.load_model(path)
            c = ctx["candles"]
            pre = ml.precompute(c)
            x = ml.features_at(c, pre, len(c) - 1, ctx["side"], ctx.get("flow"))
            return ml.predict_booster(self._model, [x])[0], ""
        except Exception as e:
            return None, f"modelo indisponível ({str(e)[:60]})"
