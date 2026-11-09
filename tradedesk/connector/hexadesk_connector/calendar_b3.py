"""Calendário de pregão da B3 (dias úteis e feriados).

ATENÇÃO: a lista é CONSERVADORA (inclui todos os feriados nacionais). Se a B3 abrir num feriado da lista, o robô
simplesmente não opera naquele dia (seguro). Para travar um dia a mais, use `extra_holidays` na configuração.
Além disso, o motor só opera se os preços estiverem chegando (ver engine.TickWatch), o que cobre erros desta lista.
Confirme no calendário oficial da B3 todo início de ano.
"""
from __future__ import annotations

from datetime import date, timedelta


def easter(y: int) -> date:
    """Domingo de Páscoa (algoritmo gregoriano)."""
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(y, month, day)


def holidays(year: int, extra: tuple[date, ...] = ()) -> set[date]:
    fixed = [(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (12, 24), (12, 25), (12, 31)]
    h = {date(year, m, d) for m, d in fixed}
    if year >= 2024:
        h.add(date(year, 11, 20))  # Consciência Negra (feriado nacional desde 2024)
    e = easter(year)
    h |= {e - timedelta(days=48), e - timedelta(days=47), e - timedelta(days=2), e + timedelta(days=60)}  # Carnaval (seg/ter), Sexta Santa, Corpus Christi
    h |= {d for d in extra if d.year == year}
    return h


def is_business_day(d: date, extra: tuple[date, ...] = ()) -> bool:
    return d.weekday() < 5 and d not in holidays(d.year, extra)


def add_business_days(d: date, n: int, extra: tuple[date, ...] = ()) -> date:
    step = 1 if n >= 0 else -1
    left = abs(n)
    while left:
        d += timedelta(days=step)
        if is_business_day(d, extra):
            left -= 1
    return d
