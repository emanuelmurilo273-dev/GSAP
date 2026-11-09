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
    def get_session(self, day: str, mode: str) -> dict | None: ...
    def upsert_session(self, row: dict) -> None: ...
    def snapshot(self, equity: float, mode: str) -> None: ...


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

    def insert_trade(self, row):
        r = self._req("POST", "b3_trades", None, row, "return=representation")
        return r[0]["id"]

    def update_trade(self, id, patch):
        self._req("PATCH", "b3_trades", {"id": f"eq.{id}"}, patch)

    def open_trades(self, mode):
        return self._req("GET", "b3_trades", {"status": "eq.open", "mode": f"eq.{mode}", "select": "*"}) or []

    def get_session(self, day, mode):
        r = self._req("GET", "b3_sessions", {"day": f"eq.{day}", "mode": f"eq.{mode}", "select": "*"})
        return r[0] if r else None

    def upsert_session(self, row):
        self._req("POST", "b3_sessions", None, row, "resolution=merge-duplicates")

    def snapshot(self, equity, mode):
        self._req("POST", "b3_equity", None, {"equity": equity, "mode": mode})


class MemoryStore:
    """Para testes e para o modo --fake."""

    def __init__(self, settings: dict | None = None):
        self.settings = settings
        self.status: dict = {}
        self.commands: list[dict] = []
        self.logs: list[tuple] = []
        self.trades: list[dict] = []
        self.sessions: dict[tuple, dict] = {}
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

    def get_session(self, day, mode):
        self._chk(); return self.sessions.get((day, mode))

    def upsert_session(self, row):
        self._chk(); self.sessions[(row["day"], row["mode"])] = {**self.sessions.get((row["day"], row["mode"]), {}), **row}

    def snapshot(self, equity, mode):
        self.snaps.append((equity, mode))

    def has_log(self, text: str) -> bool:
        return any(text in m for _, _, m in self.logs)
