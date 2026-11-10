"""Regras de proteção do robô (v2), aplicadas SEMPRE, mesmo com as camadas de inteligência desligadas.
Nascidas da autópsia (DIAGNOSTICO.md): stop fixo dentro do ruído do mercado, custo grande perto do risco e entradas em qualquer horário.

  * não opera nos primeiros 15 min do pregão (abertura = leilão/gap/spread largo);
  * não opera 15 min antes/depois de notícia forte (calendário do painel + abertura de Nova York);
  * para o dia depois de 1 perda (perfil inicial de emergência);
  * stop TÉCNICO: além do último fundo/topo e ao menos 1×ATR (não um número fixo); alvo = stop × relação risco/retorno (mínimo 1:2);
  * o stop técnico nunca pode passar do risco permitido pelo perfil: se passar, NÃO entra (operar menos);
  * bloqueios por horário/ativo/regime/lado só entram quando o diagnóstico prova prejuízo consistente (config da versão, campo `blocks`);
  * PROIBIDO: martingale, preço médio contra a posição, aumentar a mão para recuperar, tirar o stop (não existe código que faça isso).
"""
from __future__ import annotations

from datetime import datetime, time

from .intel.indicators import atr

FIRST_ENTRY = time(9, 15)       # nada antes disso, mesmo que o painel diga 09:05
MIN_RR = 2.0                    # EMERGÊNCIA: risco/retorno mínimo 1:2
MAX_LOSSES_IN_ROW = 1           # EMERGÊNCIA (perfil inicial): para o dia após 1 perda
MAX_TRADES_PER_DAY = 3          # no máximo 3 operações por dia, só sinais de qualidade
FIXED_CONTRACTS = 1             # 1 contrato fixo
DEFAULT_BLOCKED_REGIMES = ("lateral", "volatil")   # não opera em mercado lateral nem agitado demais
ATR_MIN_MULT = 1.0              # stop nunca menor que 1×ATR
ATR_MAX_MULT = 3.0              # nem maior que 3×ATR (stop gigante = tamanho de mão minúsculo e alvo irreal)
SWING_BARS = 8                  # estrutura: último fundo/topo das últimas 8 barras fechadas
SWING_BUFFER_ATR = 0.25         # folga além da estrutura


def earliest_entry(open_from: time) -> time:
    return max(open_from, FIRST_ENTRY)


def effective_rr(rr: float | None) -> float:
    return max(float(rr or MIN_RR), MIN_RR)


def technical_stop(candles: list[tuple], side: str, entry: float, tick: float, cap_pts: float) -> tuple[float | None, str]:
    """Distância do stop em PONTOS (múltiplo do tick) ou (None, motivo). candles: (t,o,h,l,c,v) fechados."""
    if len(candles) < 30:
        return None, "poucos candles para calcular o ATR"
    a = atr(candles)[-1]
    if not a or a <= 0:
        return None, "ATR indisponível"
    recent = candles[-SWING_BARS:]
    if side == "buy":
        structure = entry - (min(c[3] for c in recent) - SWING_BUFFER_ATR * a)
    else:
        structure = (max(c[2] for c in recent) + SWING_BUFFER_ATR * a) - entry
    dist = min(max(structure, ATR_MIN_MULT * a), ATR_MAX_MULT * a)
    dist = max(tick, round(dist / tick) * tick)
    if dist > cap_pts:
        return None, f"stop técnico de {dist:.0f} pts maior que o risco permitido ({cap_pts:.0f} pts): setup caro demais"
    return dist, ""


def blocked_by_config(blocks: dict | None, root: str, now: datetime, side: str, regime: str | None) -> str | None:
    """Bloqueios provados pelo diagnóstico. blocks = {"hours": ["09:30", ...] (início de faixas de 30 min), "symbols": [...], "regimes": [...], "sides": [...]}"""
    b = blocks or {}
    if root in (b.get("symbols") or []):
        return f"{root} bloqueado: prejuízo consistente no diagnóstico"
    if side in (b.get("sides") or []):
        return f"{'compra' if side == 'buy' else 'venda'} bloqueada: prejuízo consistente no diagnóstico"
    if regime and regime in (b.get("regimes") or []):
        return f"mercado {'lateral' if regime == 'lateral' else 'agitado demais' if regime == 'volatil' else regime}: o robô não opera nesse regime"
    slot = f"{now.hour:02d}:{(now.minute // 30) * 30:02d}"
    if slot in (b.get("hours") or []):
        return f"faixa das {slot} bloqueada: prejuízo consistente no diagnóstico"
    return None
