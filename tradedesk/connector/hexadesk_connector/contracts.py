"""Contrato vigente de WIN (mini índice) e WDO (mini dólar) e rolagem automática."""
from __future__ import annotations

import re
from datetime import date, timedelta

from .calendar_b3 import add_business_days, is_business_day

MONTH_CODE = {1: "F", 2: "G", 3: "H", 4: "J", 5: "K", 6: "M", 7: "N", 8: "Q", 9: "U", 10: "V", 11: "X", 12: "Z"}
CODE_MONTH = {v: k for k, v in MONTH_CODE.items()}
WIN_MONTHS = (2, 4, 6, 8, 10, 12)  # WIN vence nos meses pares; WDO em todos


def win_expiry(y: int, m: int, extra: tuple[date, ...] = ()) -> date:
    """Quarta-feira mais próxima do dia 15 (se não for dia útil, o dia útil anterior)."""
    d = date(y, m, 15)
    delta = 2 - d.weekday()
    if delta > 3:
        delta -= 7
    if delta < -3:
        delta += 7
    d += timedelta(days=delta)
    while not is_business_day(d, extra):
        d -= timedelta(days=1)
    return d


def wdo_expiry(y: int, m: int, extra: tuple[date, ...] = ()) -> date:
    """Primeiro dia útil do mês do contrato."""
    d = date(y, m, 1)
    while not is_business_day(d, extra):
        d += timedelta(days=1)
    return d


def expiry(root: str, y: int, m: int, extra: tuple[date, ...] = ()) -> date:
    return win_expiry(y, m, extra) if root == "WIN" else wdo_expiry(y, m, extra)


def symbol_for(root: str, y: int, m: int) -> str:
    return f"{root}{MONTH_CODE[m]}{y % 100:02d}"


def parse_symbol(sym: str) -> tuple[str, int, int] | None:
    m = re.fullmatch(r"(WIN|WDO)([FGHJKMNQUVXZ])(\d{2})", sym.upper())
    return (m.group(1), 2000 + int(m.group(3)), CODE_MONTH[m.group(2)]) if m else None


def current_contract(root: str, today: date, extra: tuple[date, ...] = (), roll_days: int = 1,
                     available: list[str] | None = None) -> str:
    """Contrato vigente hoje. Troca `roll_days` dias úteis ANTES do vencimento (a liquidez migra antes).
    Se `available` (símbolos que a corretora oferece) for dado, só devolve símbolo que exista lá."""
    months = WIN_MONTHS if root == "WIN" else tuple(range(1, 13))
    cands: list[tuple[date, str]] = []
    for k in range(-1, 16):
        y, m0 = divmod(today.month - 1 + k, 12)
        y, m = today.year + y, m0 + 1
        if m in months:
            cands.append((expiry(root, y, m, extra), symbol_for(root, y, m)))
    avail = {s.upper() for s in available} if available is not None else None
    for exp, sym in cands:
        if today >= add_business_days(exp, -roll_days, extra):
            continue  # já passou da data de rolagem
        if avail is None or sym in avail:
            return sym
    if avail:  # fallback: o mais próximo do vencimento entre os que existem
        parsed = [(expiry(r, y, m, extra), s) for s in avail if (p := parse_symbol(s)) and p[0] == root for r, y, m in [p]]
        parsed = [x for x in parsed if x[0] >= today]
        if parsed:
            return min(parsed)[1]
    raise RuntimeError(f"não encontrei contrato vigente de {root} para {today}")
