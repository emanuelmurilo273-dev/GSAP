"""SIMULADOR INTERNO — mercado ARTIFICIAL para você ver o robô funcionando sem MT5, sem login e sem dinheiro.

  * Os preços são SINTÉTICOS (passeio aleatório com tendências), NÃO são cotações da B3.
  * O mercado é NEUTRO por padrão (passeio aleatório sem tendência): o resultado do robô aqui NÃO indica nada sobre o mercado real
    (com `trending=True` há tendências embutidas, que inflam o resultado — só para testar o motor).
  * O relógio é acelerado (padrão: 30x → um candle de 5 min a cada 10 s; um pregão inteiro em ~17 min).
  * Passa pelo MESMO motor (engine.py) do conector real: mesmos stops, limites, zeragem às 17:30 e PARAR TUDO.
  * Os dias do simulador interno NÃO contam para os "20 pregões" exigidos antes do modo REAL (source='internal').
"""
from __future__ import annotations

import random
import time as _time
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from .calendar_b3 import add_business_days, is_business_day
from .config import Config
from .contracts import WIN_MONTHS, symbol_for
from .engine import Engine
from .fake_mt5 import WDO_SPEC, WIN_SPEC, FakeGateway
from .store import Store, StoreError
from .strategy import baseline_signal

SP = ZoneInfo("America/Sao_Paulo")
SERVER = "SIMULADOR-INTERNO"
BAR_SECONDS = 300  # candles de 5 min
START_PX = {"WIN": 130_000.0, "WDO": 5_400.0}
SIGMA = {"WIN": 0.00005, "WDO": 0.00004}   # volatilidade por segundo simulado
AUTOSTART_KEY = "b3_internal_sim_autostart"


class SimGateway(FakeGateway):
    def __init__(self, balance: float = 10_000.0, seed: int | None = None, speed: float = 30.0, start_date: date | None = None, trending: bool = False):
        d = start_date or datetime.now(SP).date()
        while not is_business_day(d):
            d += timedelta(days=1)
        specs = {}
        for y in range(d.year, d.year + 3):
            for m in range(1, 13):
                specs[symbol_for("WDO", y, m)] = WDO_SPEC
                if m in WIN_MONTHS:
                    specs[symbol_for("WIN", y, m)] = WIN_SPEC
        super().__init__(symbols=specs, mode="demo", balance=balance)
        self.rng = random.Random(seed)
        self.trending = trending   # False (padrão): mercado NEUTRO, sem tendência embutida (não infla o resultado)
        self.speed = speed
        self.t = datetime.combine(d, time(9, 0), tzinfo=SP)
        self.px = dict(START_PX)
        self.drift = {"WIN": 0.0, "WDO": 0.0}
        self.regime_left = {"WIN": 0, "WDO": 0}
        self.root_bars: dict[str, list[tuple]] = {"WIN": [], "WDO": []}
        self.forming: dict[str, list] = {}
        for root in ("WIN", "WDO"):          # histórico inicial para a estratégia ter o que analisar
            for _ in range(150 * BAR_SECONDS):
                self._tick_root(root, record_only=True)
        self._publish()

    def sim_now(self) -> datetime:
        return self.t

    # --- mercado artificial
    def _tick_root(self, root: str, record_only: bool = False) -> None:
        if self.regime_left[root] <= 0:     # novo "regime": tendência de alta, baixa ou lateral, ~30 min
            self.drift[root] = self.rng.gauss(0, 2e-6) if self.trending else 0.0
            self.regime_left[root] = int(self.rng.uniform(900, 2700))
        self.regime_left[root] -= 1
        tick = 5.0 if root == "WIN" else 0.5
        p = self.px[root] * (1 + self.drift[root] + SIGMA[root] * self.rng.gauss(0, 1))
        self.px[root] = max(tick, round(p / tick) * tick)
        ts = int(self.t.timestamp()) if not record_only else len(self.root_bars[root]) * BAR_SECONDS + int(self.forming.get(root, [0])[0] or 0) + 0
        b = self.forming.get(root)
        bucket = (int(self.t.timestamp()) // BAR_SECONDS) * BAR_SECONDS if not record_only else None
        if record_only:
            if b is None or b[6] >= BAR_SECONDS:      # barra sintética do histórico: cada barra = 300 passos
                if b:
                    self.root_bars[root].append((b[0], b[1], b[2], b[3], b[4], b[5]))
                base = (int(self.t.timestamp()) - (150 - len(self.root_bars[root])) * BAR_SECONDS)
                b = self.forming[root] = [base, self.px[root], self.px[root], self.px[root], self.px[root], 0, 0]
            b[2], b[3], b[4], b[6] = max(b[2], self.px[root]), min(b[3], self.px[root]), self.px[root], b[6] + 1
            b[5] += self.rng.randint(1, 20)
            return
        if b is None or b[0] != bucket:
            if b:
                self.root_bars[root].append((b[0], b[1], b[2], b[3], b[4], b[5]))
                self.root_bars[root] = self.root_bars[root][-600:]
            b = self.forming[root] = [bucket, self.px[root], self.px[root], self.px[root], self.px[root], 0, 0]
        b[2], b[3], b[4] = max(b[2], self.px[root]), min(b[3], self.px[root]), self.px[root]
        b[5] += self.rng.randint(1, 20)

    def _publish(self) -> None:
        for sym in self.specs:
            self.prices[sym] = self.px[sym[:3]]

    def _advance_one(self) -> None:
        self.t += timedelta(seconds=1)
        if self.t.time() >= time(18, 0):    # fecha o pregão: pula para o próximo dia útil com um "gap" de abertura
            nd = add_business_days(self.t.date(), 1)
            self.t = datetime.combine(nd, time(9, 0), tzinfo=SP)
            for root in self.px:
                self.px[root] *= 1 + self.rng.gauss(0, 0.002)
                self.forming.pop(root, None)
        for root in ("WIN", "WDO"):
            self._tick_root(root)
        for sym in self.specs:
            self.move(sym, self.px[sym[:3]])   # dispara stops/alvos gravados nas posições

    def pump(self) -> None:
        for _ in range(max(1, int(self.speed))):
            self._advance_one()

    def candles(self, symbol: str, timeframe: str, n: int) -> list[tuple]:
        return self.root_bars[symbol[:3]][-n:]


def _age_seconds(iso: str | None) -> float:
    if not iso:
        return 1e9
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds()
    except ValueError:
        return 1e9


class SimRunner:
    def __init__(self, store: Store, cfg: Config | None = None, balance: float = 10_000.0, speed: float = 30.0, seed: int | None = None, trending: bool = False):
        self.store = store
        self.cfg = cfg or Config()
        self.gw = SimGateway(balance=balance, seed=seed, speed=speed, trending=trending)
        secrets = {"demo": {"login": 1_000_001, "password": "-", "server": SERVER}}
        self.engine = Engine(self.gw, store, self.cfg, secrets, now_fn=self.gw.sim_now, signal_fn=baseline_signal, source="internal")
        self.yielded = False

    def autostart(self) -> bool:
        """Na PRIMEIRA vez liga o robô sozinho (dinheiro fictício), para você ver funcionando. Depois respeita o seu liga/pausa.
        Devolve True quando concluído (False = painel ainda indisponível; tenta de novo)."""
        try:
            if self.store.kv_get(AUTOSTART_KEY):
                return True
            s = self.store.get_settings()
            if not s:
                return False
            if s["mode"] == "sim" and not s["enabled"]:
                self.store.update_settings({"enabled": True})
                self.store.log("info", "logger", "Simulador interno ligou o robô automaticamente (dinheiro fictício, preços artificiais).")
            self.store.kv_set(AUTOSTART_KEY, {"at": datetime.now(timezone.utc).isoformat()})
            return True
        except StoreError:
            return False

    def tick(self) -> str:
        """Um passo. Se o conector MT5 de verdade estiver ativo, o simulador interno fica em espera (não disputa o painel)."""
        try:
            st = self.store.get_status()
        except StoreError:
            st = None
        if st and st.get("source") == "mt5" and _age_seconds(st.get("connector_ts")) < 30:
            if not self.yielded:
                self.yielded = True
                self.store.log("info", "logger", "Conector MT5 ativo: simulador interno em espera.")
            return "idle"
        self.yielded = False
        self.gw.pump()
        self.engine.step()
        return "ran"

    def run_forever(self) -> None:  # pragma: no cover
        print(f"Simulador interno HEXADESK B3: saldo fictício R$ {self.gw.balance:,.2f}, relógio {self.gw.speed:g}x, mercado ARTIFICIAL.", flush=True)
        done, announced, waited = False, False, 0
        while True:
            if not done:
                done = self.autostart()
                if not done:
                    waited += 1
                    if waited % 30 == 1:
                        print("Aguardando o painel/banco (as migrations 003 e 004 foram aplicadas?)…", flush=True)
                    _time.sleep(1.0)
                    continue
            if not announced:
                announced = True
                self.store.log("info", "logger", f"Simulador interno iniciado (saldo fictício R$ {self.gw.balance:,.2f}, relógio {self.gw.speed:g}x, preços ARTIFICIAIS).")
            self.tick()
            _time.sleep(1.0)
