from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path


def default_state_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    return Path(base) / "HexadeskConnector" if base else Path.home() / ".hexadesk-connector"


@dataclass
class Config:
    """Configuração NÃO secreta (os segredos ficam em secrets.bin, criptografados)."""
    supabase_url: str = "http://localhost:54321"
    mt5_path: str | None = None           # ex.: C:\\Program Files\\Clear MetaTrader 5\\terminal64.exe (vazio = automático)
    allow_real: bool = False              # SEGUNDA trava do modo real (a primeira está no site)
    extra_holidays: list[str] = field(default_factory=list)   # "AAAA-MM-DD"
    roll_days: dict[str, int] = field(default_factory=lambda: {"WIN": 2, "WDO": 1})
    timeframe: str = "M5"
    loop_seconds: float = 1.0

    @staticmethod
    def load(state_dir: Path) -> "Config":
        p = state_dir / "config.json"
        return Config(**json.loads(p.read_text(encoding="utf-8"))) if p.exists() else Config()

    def save(self, state_dir: Path) -> None:
        state_dir.mkdir(parents=True, exist_ok=True)
        (state_dir / "config.json").write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
