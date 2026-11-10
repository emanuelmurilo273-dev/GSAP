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


def adaptive_size(base_n: int, loss_streak: int, last_size: int | None, high_vol: bool, after_losses: int = 2, mult: float = 0.5,
                  high_vol_mult: float = 0.5, enabled: bool = True) -> int:
    """Gestão de risco adaptativa: reduz a mão após `after_losses` perdas seguidas e em dia de volatilidade alta.
    NUNCA aumenta para recuperar perda (proibido martingale): depois de uma perda, o tamanho nunca passa do anterior.
    Retorna ao tamanho normal só quando há uma operação vencedora (streak zera). Mínimo de 1 contrato quando há base."""
    if base_n <= 0:
        return 0
    n = float(base_n)
    if enabled:
        if loss_streak >= after_losses:
            n *= mult
        if high_vol:
            n *= high_vol_mult
    if loss_streak > 0 and last_size is not None:
        n = min(n, last_size)                       # trava anti-martingale
    return max(1, min(base_n, int(n)))


# ---- dinheiro REAL: começa com 1 contrato e só sobe devagar (repete packages/core/src/b3rules.ts: mantenha igual)
REAL_START_CONTRACTS = 1
REAL_SCALE_AFTER = 30      # pregões reais com resultado acumulado positivo
REAL_SCALE_STEP = 15       # +1 contrato a cada 15 pregões positivos a mais
REAL_DD_STOP = 0.05        # 5% abaixo do pico → volta ao simulador


def real_contract_cap(sessions: int, pnl: float, requested: int) -> int:
    if sessions < REAL_SCALE_AFTER or not pnl > 0:
        return REAL_START_CONTRACTS
    cap = 2 + (sessions - REAL_SCALE_AFTER) // REAL_SCALE_STEP
    return max(REAL_START_CONTRACTS, min(int(round(requested)), cap))
