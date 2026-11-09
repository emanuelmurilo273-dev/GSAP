"""Dimensionamento (nº de contratos) e limites diários."""
from __future__ import annotations

import math
from dataclasses import dataclass

# % do saldo arriscado por operação, por perfil
PROFILE_RISK = {"conservador": 0.005, "moderado": 0.01, "agressivo": 0.02}


@dataclass
class SymbolSpec:
    point: float
    tick_size: float
    tick_value: float          # R$ por tick, por contrato (informado pela corretora)
    volume_min: float
    volume_max: float
    volume_step: float
    digits: int = 0
    trade_allowed: bool = True

    @property
    def brl_per_point(self) -> float:
        return self.tick_value / self.tick_size


def size_contracts(balance: float, profile: str, cap_brl: float, stop_points: float, spec: SymbolSpec, max_contracts: int) -> int:
    """Quantos contratos cabem no risco: min(perfil% do saldo, teto em R$) ÷ (pontos de stop × R$/ponto)."""
    if balance <= 0 or stop_points <= 0:
        return 0
    risk_brl = min(balance * PROFILE_RISK.get(profile, PROFILE_RISK["conservador"]), cap_brl)
    per_contract = stop_points * spec.brl_per_point
    if per_contract <= 0:
        return 0
    n = math.floor(risk_brl / per_contract)
    n = min(n, max_contracts, int(spec.volume_max))
    step = spec.volume_step or 1
    n = int(math.floor(n / step) * step)
    return n if n >= spec.volume_min else 0


def day_state(day_pnl: float, loss_limit: float, target: float | None) -> str:
    if loss_limit > 0 and day_pnl <= -abs(loss_limit):
        return "loss"
    if target and day_pnl >= target:
        return "target"
    return "ok"
