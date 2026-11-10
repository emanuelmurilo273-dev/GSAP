"""SIMULADOR INTERNO — mercado ARTIFICIAL para você ver o robô funcionando sem MT5, sem login e sem dinheiro.

  * Os preços são SINTÉTICOS (passeio aleatório com tendências), NÃO são cotações da B3.
  * O mercado é NEUTRO por padrão (passeio aleatório sem tendência): o resultado do robô aqui NÃO indica nada sobre o mercado real
    (com `trending=True` há tendências embutidas, que inflam o resultado — só para testar o motor).
  * O relógio é acelerado (padrão: 30x → um candle de 5 min a cada 10 s; um pregão inteiro em ~17 min).
  * Passa pelo MESMO motor (engine.py) do conector real: mesmos stops, limites, zeragem às 17:30 e PARAR TUDO.
  * Os dias do simulador interno NÃO contam para os "30 pregões" exigidos antes do modo REAL (source='internal').
"""
from __future__ import annotations

import random
import time as _time
from collections import deque
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from .calendar_b3 import add_business_days, is_business_day
from .config import Config
from .contracts import WIN_MONTHS, symbol_for
from .engine import Engine
from .fake_mt5 import WDO_SPEC, WIN_SPEC, FakeGateway
from .live import FLAG_BUY, FLAG_SELL, AsyncSink, LiveCollector, TickRec
from .store import Store, StoreError
from .strategy import baseline_signal

SP = ZoneInfo("America/Sao_Paulo")
SERVER = "SIMULADOR-INTERNO"
BAR_SECONDS = 300  # candles de 5 min
START_PX = {"WIN": 130_000.0, "WDO": 5_400.0}
SIGMA = {"WIN": 0.00005, "WDO": 0.00004}   # volatilidade por segundo simulado
AUTOSTART_KEY = "b3_internal_sim_autostart"
SIM_FEES = {"WIN": 0.50, "WDO": 2.00}   # R$ por contrato, ida e volta (valores provisórios)


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
        self.fee_rt = dict(SIM_FEES)               # PLACEHOLDER: confirme emolumentos+corretagem na Clear
        self.stop_slip_ticks = 1.0                 # 1 tick de derrapagem quando o stop dispara / zeragem a mercado
        self.trending = trending   # False (padrão): mercado NEUTRO, sem tendência embutida (não infla o resultado)
        self.speed = speed
        self.t = datetime.combine(d, time(9, 0), tzinfo=SP)
        self.px = dict(START_PX)
        self.drift = {"WIN": 0.0, "WDO": 0.0}
        self.regime_left = {"WIN": 0, "WDO": 0}
        self.root_bars: dict[str, list[tuple]] = {"WIN": [], "WDO": []}
        self.ticks: dict[str, deque] = {"WIN": deque(maxlen=30000), "WDO": deque(maxlen=30000)}
        self.book_rng = random.Random((seed or 0) + 1)   # gerador separado: o book não altera a trajetória dos preços
        self.tick_n = 0
        self.forming: dict[str, list] = {}
        for root in ("WIN", "WDO"):          # histórico inicial para a estratégia ter o que analisar
            for _ in range(150 * BAR_SECONDS):
                self._tick_root(root, record_only=True)
        self._publish()

    def sim_now(self) -> datetime:
        return self.t

    def _epoch(self) -> int:
        """Relógio de parede como se fosse UTC (igual ao MT5: horário do servidor da corretora)."""
        t = self.t
        return int(datetime(t.year, t.month, t.day, t.hour, t.minute, t.second, tzinfo=timezone.utc).timestamp())

    # --- mercado artificial
    def _tick_root(self, root: str, record_only: bool = False) -> None:
        if self.regime_left[root] <= 0:     # novo "regime": tendência de alta, baixa ou lateral, ~30 min
            self.drift[root] = self.rng.gauss(0, 2e-6) if self.trending else 0.0
            self.regime_left[root] = int(self.rng.uniform(900, 2700))
        self.regime_left[root] -= 1
        tick = 5.0 if root == "WIN" else 0.5
        p = self.px[root] * (1 + self.drift[root] + SIGMA[root] * self.rng.gauss(0, 1))
        self.px[root] = max(tick, round(p / tick) * tick)
        b = self.forming.get(root)
        bucket = (self._epoch() // BAR_SECONDS) * BAR_SECONDS if not record_only else None
        if record_only:
            if b is None or b[6] >= BAR_SECONDS:      # barra sintética do histórico: cada barra = 300 passos
                if b:
                    self.root_bars[root].append((b[0], b[1], b[2], b[3], b[4], b[5]))
                base = (self._epoch() - (150 - len(self.root_bars[root])) * BAR_SECONDS)
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
            before = self.px[root]
            self._tick_root(root)
            self._emit_tick(root, before)
        for sym in self.specs:
            self.move(sym, self.px[sym[:3]])   # dispara stops/alvos gravados nas posições

    def _emit_tick(self, root: str, before: float) -> None:
        """Negócio sintético: agressor = lado do movimento do preço (empate sorteia). Neutro: não embute previsão."""
        tick = 5.0 if root == "WIN" else 0.5
        px = self.px[root]
        side = FLAG_BUY if px > before else FLAG_SELL if px < before else (FLAG_BUY if self.book_rng.random() < 0.5 else FLAG_SELL)
        vol = self.book_rng.randint(30, 80) if self.book_rng.random() < 0.01 else self.book_rng.randint(1, 12)   # raros "lotes grandes"
        self.tick_n += 1
        self.ticks[root].append(TickRec(self._epoch() * 1000 + (self.tick_n % 1000), px, px + tick, px, float(vol), side | 4 | 8))

    def ticks_since(self, symbol, since_msc):
        out = []
        for t in reversed(self.ticks[symbol[:3]]):
            if t.t_msc <= since_msc:
                break
            out.append(t)
        return out[::-1]

    def book(self, symbol):
        root, px = symbol[:3], self.px[symbol[:3]]
        tick = 5.0 if root == "WIN" else 0.5
        lv = []
        for k in range(10):
            lv.append((px - k * tick, float(self.book_rng.randint(5, 60)), "buy"))
            lv.append((px + (k + 1) * tick, float(self.book_rng.randint(5, 60)), "sell"))
        return lv

    def pump(self, seconds: float | None = None) -> None:
        n = max(1, int(round(self.speed * seconds))) if seconds is not None else max(1, int(self.speed))
        for _ in range(n):
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
    def __init__(self, store: Store, cfg: Config | None = None, balance: float = 10_000.0, speed: float = 30.0, seed: int | None = None, trending: bool = False, sink=None, rules: str | None = None):
        self.store = store
        self.cfg = cfg or Config()
        self.gw = SimGateway(balance=balance, seed=seed, speed=speed, trending=trending)
        secrets = {"demo": {"login": 1_000_001, "password": "-", "server": SERVER}}
        self.engine = Engine(self.gw, store, self.cfg, secrets, now_fn=self.gw.sim_now, signal_fn=baseline_signal, source="internal", rules=rules)
        self.yielded = False
        self.live = LiveCollector(self.gw, self._symbols, sink) if sink is not None else None   # sem gravar em disco: dados sintéticos
        self.engine.live = self.live
        from .shadow import ShadowManager
        self.engine.shadow = ShadowManager(store, "internal")   # fonte 'internal': nunca conta para liberar o real

    def _symbols(self) -> list[str]:
        roots = (self.engine.settings or {}).get("symbols") or ["WIN", "WDO"]
        try:
            return [self.engine._contract(r, self.gw.t.date()) for r in roots]
        except Exception:
            return []

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

    def tick(self, dt: float | None = None, step: bool = True) -> str:
        """Um passo. `dt` = segundos REAIS decorridos (None = 1 s de relógio acelerado inteiro). Se o conector MT5 de verdade estiver ativo, fica em espera."""
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
        self.gw.pump(dt)
        if self.live:
            self.live.poll()
        if step:
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
            i = getattr(self, "_i", 0) + 1
            self._i = i
            self.tick(0.2, step=(i % 5 == 0))      # ao vivo a cada 200 ms; o motor decide a cada 1 s
            _time.sleep(0.2)
