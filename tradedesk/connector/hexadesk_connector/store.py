"""Comunicação com o painel (Supabase/PostgREST) e uma versão em memória para testes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Protocol


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store(Protocol):
    def get_settings(self) -> dict | None: ...
    def update_settings(self, patch: dict) -> None: ...
    def upsert_status(self, row: dict) -> None: ...
    def pending_commands(self) -> list[dict]: ...
    def ack_command(self, id: Any, status: str, result: str) -> None: ...
    def log(self, level: str, agent: str, message: str, meta: dict | None = None) -> None: ...
    def insert_trade(self, row: dict) -> Any: ...
    def update_trade(self, id: Any, patch: dict) -> None: ...
    def open_trades(self, mode: str) -> list[dict]: ...
    def get_session(self, day: str, mode: str, source: str = "mt5") -> dict | None: ...
    def upsert_session(self, row: dict) -> None: ...
    def snapshot(self, equity: float, mode: str) -> None: ...
    def get_status(self) -> dict | None: ...
    def kv_get(self, key: str) -> Any: ...
    def kv_set(self, key: str, value: Any) -> None: ...
    def get_champion(self) -> dict | None: ...
    def get_challengers(self) -> list[dict]: ...
    def get_events(self) -> list[dict]: ...
    def log_decision(self, row: dict) -> None: ...
    def alert(self, kind: str, title: str, body: str = "") -> None: ...
    def real_stats(self) -> dict: ...
    def insert_shadow(self, row: dict) -> None: ...
    def register_version(self, name: str, role: str, config: dict, notes: str = "") -> Any: ...


class StoreError(RuntimeError):
    pass


class SupabaseStore:
    """PostgREST via HTTP. Usa a chave service_role, guardada criptografada só nesta máquina."""

    def __init__(self, url: str, key: str, timeout: float = 10.0):
        import requests  # importado aqui para os testes não exigirem a biblioteca
        self.s = requests.Session()
        self.base = url.rstrip("/") + "/rest/v1"
        self.s.headers.update({"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        self.timeout = timeout

    def _req(self, method: str, table: str, params: dict | None = None, json: Any = None, prefer: str | None = None):
        h = {"Prefer": prefer} if prefer else {}
        try:
            r = self.s.request(method, f"{self.base}/{table}", params=params, json=json, headers=h, timeout=self.timeout)
        except Exception as e:  # rede fora
            raise StoreError(f"{table}: {e}") from e
        if r.status_code >= 300:
            raise StoreError(f"{table}: HTTP {r.status_code} {r.text[:200]}")
        return r.json() if r.text else None

    def get_settings(self):
        r = self._req("GET", "b3_settings", {"id": "eq.1", "select": "*"})
        return r[0] if r else None

    def update_settings(self, patch):
        self._req("PATCH", "b3_settings", {"id": "eq.1"}, {**patch, "updated_at": _now()})

    def upsert_status(self, row):
        self._req("POST", "b3_status", None, {"id": 1, **row}, "resolution=merge-duplicates")

    def pending_commands(self):
        return self._req("GET", "b3_commands", {"status": "eq.pending", "order": "id.asc", "select": "*"}) or []

    def ack_command(self, id, status, result):
        self._req("PATCH", "b3_commands", {"id": f"eq.{id}"}, {"status": status, "result": result, "handled_at": _now()})

    def log(self, level, agent, message, meta=None):
        try:
            self._req("POST", "b3_logs", None, {"level": level, "agent": agent, "message": message, "meta": meta or {}})
        except StoreError:
            pass  # log nunca derruba o robô

    # colunas novas (migration 007). Se ainda não existirem no banco, grava só as antigas: um trade NUNCA deixa de ser registrado.
    _NEW_TRADE_COLS = ("fees", "gross_pnl", "price_signal", "regime", "why", "atr_pts")

    def insert_trade(self, row):
        try:
            r = self._req("POST", "b3_trades", None, row, "return=representation")
        except StoreError as e:
            if "PGRST204" not in str(e) and "column" not in str(e).lower():
                raise
            r = self._req("POST", "b3_trades", None, {k: v for k, v in row.items() if k not in self._NEW_TRADE_COLS}, "return=representation")
        return r[0]["id"]

    def update_trade(self, id, patch):
        try:
            self._req("PATCH", "b3_trades", {"id": f"eq.{id}"}, patch)
        except StoreError as e:
            if "PGRST204" not in str(e) and "column" not in str(e).lower():
                raise
            self._req("PATCH", "b3_trades", {"id": f"eq.{id}"}, {k: v for k, v in patch.items() if k not in self._NEW_TRADE_COLS})

    def open_trades(self, mode):
        return self._req("GET", "b3_trades", {"status": "eq.open", "mode": f"eq.{mode}", "select": "*"}) or []

    def get_session(self, day, mode, source="mt5"):
        r = self._req("GET", "b3_sessions", {"day": f"eq.{day}", "mode": f"eq.{mode}", "source": f"eq.{source}", "select": "*"})
        return r[0] if r else None

    def upsert_session(self, row):
        self._req("POST", "b3_sessions", None, row, "resolution=merge-duplicates")

    def snapshot(self, equity, mode):
        self._req("POST", "b3_equity", None, {"equity": equity, "mode": mode})

    def get_status(self):
        r = self._req("GET", "b3_status", {"id": "eq.1", "select": "*"})
        return r[0] if r else None

    def kv_get(self, key):
        r = self._req("GET", "app_settings", {"key": f"eq.{key}", "select": "value"})
        return r[0]["value"] if r else None

    def kv_set(self, key, value):
        self._req("POST", "app_settings", None, {"key": key, "value": value}, "resolution=merge-duplicates")

    def get_champion(self):
        r = self._req("GET", "strategy_versions", {"role": "eq.champion", "select": "*"})
        return r[0] if r else None

    def get_challengers(self):
        return self._req("GET", "strategy_versions", {"role": "eq.challenger", "select": "*", "order": "id.asc"}) or []

    def get_events(self):
        from datetime import datetime, timedelta, timezone
        lo = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        hi = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        return self._req("GET", "b3_events", {"and": f"(starts_at.gte.{lo},starts_at.lte.{hi})", "select": "starts_at,title,impact"}) or []

    def log_decision(self, row):
        try:
            self._req("POST", "b3_decisions", None, row)
        except StoreError:
            pass

    def alert(self, kind, title, body=""):
        try:
            self._req("POST", "b3_alerts", None, {"kind": kind, "title": title, "body": body})
        except StoreError:
            pass       # alerta nunca derruba o robô (a tabela pode nem existir ainda)

    def real_stats(self):
        """Pregões REAIS (MT5, conta real) e resultado acumulado: libera mais de 1 contrato só depois de provar."""
        rows = self._req("GET", "b3_sessions", {"mode": "eq.real", "source": "eq.mt5", "select": "day,pnl,active_minutes"}) or []
        ok = [r for r in rows if (r.get("active_minutes") or 0) >= 240]
        return {"sessions": len(ok), "pnl": sum(float(r.get("pnl") or 0) for r in ok)}

    def insert_shadow(self, row):
        try:
            self._req("POST", "b3_shadow_trades", None, row)
        except StoreError:
            pass

    def register_version(self, name, role, config, notes=""):
        r = self._req("POST", "strategy_versions", None, {"name": name, "role": role, "config": config, "notes": notes}, "return=representation")
        return r[0]["id"]


class MemoryStore:
    """Para testes e para o modo --fake."""

    def __init__(self, settings: dict | None = None):
        self.settings = settings
        self.status: dict = {}
        self.commands: list[dict] = []
        self.logs: list[tuple] = []
        self.trades: list[dict] = []
        self.sessions: dict[tuple, dict] = {}
        self.kv: dict[str, Any] = {}
        self.champion: dict | None = None
        self.challengers: list[dict] = []
        self.events: list[dict] = []
        self.decisions: list[dict] = []
        self.alerts: list[tuple] = []
        self.shadow: list[dict] = []
        self.versions: list[dict] = []
        self.snaps: list[tuple] = []
        self.down = False  # simula internet/painel fora
        self._id = 0

    def _chk(self):
        if self.down:
            raise StoreError("painel indisponível")

    def get_settings(self):
        self._chk(); return dict(self.settings) if self.settings else None

    def update_settings(self, patch):
        self._chk(); self.settings = {**(self.settings or {}), **patch}

    def upsert_status(self, row):
        self._chk(); self.status = {**self.status, **row}

    def pending_commands(self):
        self._chk(); return [c for c in self.commands if c["status"] == "pending"]

    def ack_command(self, id, status, result):
        self._chk()
        for c in self.commands:
            if c["id"] == id:
                c.update(status=status, result=result)

    def push_command(self, command: str):
        self._id += 1
        self.commands.append({"id": self._id, "command": command, "status": "pending"})

    def log(self, level, agent, message, meta=None):
        self.logs.append((level, agent, message))

    def insert_trade(self, row):
        self._chk(); self._id += 1
        self.trades.append({"id": self._id, "status": "open", **row}); return self._id

    def update_trade(self, id, patch):
        self._chk()
        for t in self.trades:
            if t["id"] == id:
                t.update(patch)

    def open_trades(self, mode):
        self._chk(); return [t for t in self.trades if t["status"] == "open" and t["mode"] == mode]

    def get_session(self, day, mode, source="mt5"):
        self._chk(); return self.sessions.get((day, mode, source))

    def upsert_session(self, row):
        k = (row["day"], row["mode"], row.get("source", "mt5"))
        self._chk(); self.sessions[k] = {**self.sessions.get(k, {}), **row}

    def get_status(self):
        self._chk(); return dict(self.status) if self.status else None

    def kv_get(self, key):
        self._chk(); return self.kv.get(key)

    def kv_set(self, key, value):
        self._chk(); self.kv[key] = value

    def get_champion(self):
        self._chk(); return self.champion

    def get_challengers(self):
        self._chk(); return list(self.challengers)

    def get_events(self):
        self._chk(); return list(self.events)

    def log_decision(self, row):
        self.decisions.append(row)

    def alert(self, kind, title, body=""):
        self.alerts.append((kind, title, body))

    def real_stats(self):
        ok = [r for k, r in self.sessions.items() if k[1] == "real" and k[2] == "mt5" and (r.get("active_minutes") or 0) >= 240]
        return {"sessions": len(ok), "pnl": sum(float(r.get("pnl") or 0) for r in ok)}

    def insert_shadow(self, row):
        self.shadow.append(row)

    def register_version(self, name, role, config, notes=""):
        v = {"id": len(self.versions) + 100, "name": name, "role": role, "config": config, "notes": notes}
        self.versions.append(v)
        if role == "challenger":
            self.challengers.append(v)
        return v["id"]

    def snapshot(self, equity, mode):
        self.snaps.append((equity, mode))

    def has_log(self, text: str) -> bool:
        return any(text in m for _, _, m in self.logs)
