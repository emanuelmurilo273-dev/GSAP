"""c) Filtro de notícias: não abre posição de 15 min antes a 15 min depois de eventos importantes.
Eventos: (1) recorrentes calculados (abertura de NY 09:30 ET todo dia útil — respeita o horário de verão dos EUA; payroll = 1ª sexta, 08:30 ET,
APROXIMADO) e (2) os que VOCÊ cadastra no painel (Copom, CPI, falas do Fed, etc. — as datas mudam todo ano, por isso são seus)."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
SP = ZoneInfo("America/Sao_Paulo")


def recurring_events(day: date) -> list[tuple[datetime, str]]:
    out: list[tuple[datetime, str]] = []
    if day.weekday() < 5:
        out.append((datetime.combine(day, time(9, 30), tzinfo=NY), "abertura de Nova York"))
        if day.weekday() == 4 and day.day <= 7:
            out.append((datetime.combine(day, time(8, 30), tzinfo=NY), "payroll (EUA, 1ª sexta — horário aproximado)"))
    return out


class NewsFilter:
    def __init__(self, window_min: int = 15, recurring: bool = True):
        self.window = timedelta(minutes=window_min)
        self.recurring = recurring

    def blocked(self, now: datetime, user_events: list[dict] | None = None) -> tuple[bool, str]:
        """user_events: [{'starts_at': datetime|iso, 'title': str}]. Devolve (bloqueado?, motivo para o painel)."""
        cands = []
        if self.recurring:
            for d in {(now - timedelta(days=1)).date(), now.date(), (now + timedelta(days=1)).date()}:
                cands += recurring_events(d)
        for e in user_events or []:
            ts = e["starts_at"]
            ts = datetime.fromisoformat(str(ts).replace("Z", "+00:00")) if not isinstance(ts, datetime) else ts
            cands.append((ts, e["title"]))
        for ts, title in sorted(cands, key=lambda x: abs((x[0] - now).total_seconds())):
            delta = (ts - now).total_seconds() / 60
            if -self.window.total_seconds() / 60 <= delta <= self.window.total_seconds() / 60:
                return True, (f"{title} em {delta:.0f} min" if delta >= 0 else f"{title} há {-delta:.0f} min")
        return False, ""
