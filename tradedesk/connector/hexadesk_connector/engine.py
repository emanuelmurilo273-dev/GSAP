"""Motor do conector: os 6 agentes do day trade na B3 (WIN/WDO) sobre um Gateway (MT5) e um Store (painel).

Regras que o motor GARANTE (testadas em tests/test_engine.py):
  - só abre posição em dia útil, entre `open_from` e `open_until`; zera tudo em `flat_at`;
  - no máximo 1 posição por ativo, N operações por dia; limite de perda (e meta) diária em R$;
  - toda ordem sai com stop gravado no servidor da corretora; sem stop confirmado → fecha na hora;
  - nunca opera numa conta de tipo diferente do modo (SIMULADOR só em DEMO; REAL só em conta real);
  - REAL exige duas travas: `real_unlocked` (site) e `allow_real` (esta máquina);
  - PARAR TUDO (comando) zera tudo e desliga; feed de preços parado ou painel fora do ar → não abre novas posições.
"""
from __future__ import annotations

import time as _time
from datetime import date, datetime, time, timezone
from typing import Callable
from zoneinfo import ZoneInfo

from . import __version__
from .calendar_b3 import is_business_day
from .config import Config
from .contracts import current_contract
from .gateway import Account, Credentials, Gateway
from .intel.pipeline import IntelPipeline
from .risk import adaptive_size, day_state, size_contracts
from .shadow import ShadowManager
from .store import Store, StoreError
from .strategy import baseline_signal

SP = ZoneInfo("America/Sao_Paulo")
STALE_SECONDS = 120
STORE_DOWN_LIMIT = 60
HEARTBEAT_SECONDS = 5


# Tetos do modo REAL LIMITADO (estratégia não validada). Repetem packages/core/src/b3rules.ts: mantenha os dois iguais.
LIMITED = {"max_contracts": 1, "daily_loss_brl": 100.0, "max_trades_per_day": 3, "risk_per_trade_brl": 50.0, "max_open": 1}


def effective_settings(s: dict) -> dict:
    """No modo REAL LIMITADO os tetos valem acima de QUALQUER configuração (defesa em profundidade: o conector não confia só no painel)."""
    if s.get("mode") == "real" and s.get("real_limited"):
        s = dict(s)
        s["profile"] = "conservador"
        s["max_contracts"] = min(int(s["max_contracts"]), LIMITED["max_contracts"])
        s["daily_loss_brl"] = min(float(s["daily_loss_brl"]), LIMITED["daily_loss_brl"])
        s["max_trades_per_day"] = min(int(s["max_trades_per_day"]), LIMITED["max_trades_per_day"])
        s["risk_per_trade_brl"] = min(float(s["risk_per_trade_brl"]), LIMITED["risk_per_trade_brl"])
        s["_max_open"] = LIMITED["max_open"]
    return s


def hm(text: str) -> time:
    h, m = text.split(":")
    return time(int(h), int(m))


class Engine:
    def __init__(self, gw: Gateway, store: Store, cfg: Config, secrets: dict,
                 now_fn: Callable[[], datetime] | None = None, mono_fn: Callable[[], float] | None = None,
                 signal_fn: Callable = baseline_signal, source: str = "mt5", live=None, shadow: ShadowManager | None = None):
        self.gw, self.store, self.cfg, self.secrets = gw, store, cfg, secrets
        self.source = source  # 'mt5' (conta demo/real) ou 'internal' (simulador com preços artificiais)
        self.live, self.shadow = live, shadow
        self.intel = IntelPipeline()          # camadas de inteligência: TODAS desligadas até o campeão ligar alguma
        self.champion_id = None
        self._champ_cfg: dict | None = None
        self.last_intel_load = -1e9
        self.user_events: list[dict] = []
        self.loss_streak = 0
        self.last_size: int | None = None
        self.now = now_fn or (lambda: datetime.now(SP))
        self.mono = mono_fn or _time.monotonic
        self.signal_fn = signal_fn
        self.extra = tuple(date.fromisoformat(d) for d in cfg.extra_holidays)
        self.connected_mode: str | None = None
        self.settings: dict | None = None
        self.store_down_since: float | None = None
        self.tracked: dict[int, int] = {}          # ticket -> id do trade no painel
        self.intent: dict[int, str] = {}           # ticket -> motivo de fechamento iniciado por nós
        self.last_bar: dict[str, float] = {}
        self.cooldown: dict[str, float] = {}
        self.tickwatch: dict[str, tuple[int, float]] = {}
        self.contract_cache: dict[tuple[str, date], str] = {}
        self.sess: dict | None = None
        self.last_hb = -1e9
        self.last_flush = -1e9
        self.last_mono: float | None = None
        self.active_seconds = 0.0
        self.error: str | None = None
        self.state = "stopped"
        self.last_connect_try = -1e9

    # ------------------------------------------------------------------ utilidades
    def log(self, level: str, agent: str, msg: str) -> None:
        self.store.log(level, agent, msg)

    def _load_settings(self) -> dict | None:
        try:
            s = self.store.get_settings()
            self.store_down_since = None
            if s:
                self.settings = s
            return self.settings
        except StoreError:
            if self.store_down_since is None:
                self.store_down_since = self.mono()
            return self.settings  # usa o último conhecido

    def _store_down(self) -> bool:
        return self.store_down_since is not None and self.mono() - self.store_down_since > STORE_DOWN_LIMIT

    def _safe(self, fn, *a):
        try:
            return fn(*a)
        except StoreError:
            if self.store_down_since is None:
                self.store_down_since = self.mono()
            return None

    # ------------------------------------------------------------------ conexão / modo
    def _ensure_connection(self, s: dict) -> bool:
        desired = s["mode"]
        if self.connected_mode == desired and self.gw.is_connected():
            return True
        if self.connected_mode and self.connected_mode != desired:
            # troca de modo (SIMULADOR <-> REAL): zera tudo, desliga o robô e troca de conta
            self.log("warn", "risk", f"Troca de modo {self.connected_mode} → {desired}: zerando posições e desligando o robô.")
            self._flatten("troca de modo")
            self._safe(self.store.update_settings, {"enabled": False})
            self.gw.shutdown()
            self.connected_mode = None
        if self.mono() - self.last_connect_try < 10:
            return False
        self.last_connect_try = self.mono()
        c = self.secrets.get("demo" if desired == "sim" else "real")
        if not c:
            self.error = f"Credenciais {'DEMO' if desired == 'sim' else 'REAL'} não configuradas nesta máquina (rode: configurar)."
            return False
        try:
            self.gw.connect(Credentials(int(c["login"]), c["password"], c["server"]))
            self.connected_mode = desired
            self.error = None
            self.log("info", "scout", f"Conectado ao MT5 ({c['server']}) em modo {'SIMULADOR' if desired == 'sim' else 'REAL'}.")
            return True
        except Exception as e:
            self.error = f"Falha ao conectar no MT5: {e}"
            return False

    # ------------------------------------------------------------------ posições / fechamento
    def _flatten(self, reason: str) -> int:
        n = 0
        try:
            self.gw.cancel_orders()
            for p in self.gw.positions():
                self.intent[p.ticket] = reason
                r = self.gw.close_position(p, reason)
                if r.ok:
                    n += 1
                    self.log("trade", "executor", f"ZERAGEM {p.symbol} ({reason}).")
                else:
                    self.log("error", "executor", f"Falha ao zerar {p.symbol}: {r.comment}. INTERVENÇÃO MANUAL pode ser necessária.")
        except Exception as e:
            self.log("error", "executor", f"Erro ao zerar posições: {e}")
        return n

    def _reconcile(self, mode: str) -> None:
        live = {p.ticket for p in self.gw.positions()}
        for ticket, tid in list(self.tracked.items()):
            if ticket in live:
                continue
            info = self.gw.history_closed(ticket)
            reason = self.intent.pop(ticket, None)
            patch: dict = {"status": "closed", "closed_at": self.now().isoformat(), "close_reason": reason or "stop/alvo na corretora"}
            if info:
                patch.update(price_close=info.price_close, pnl=info.profit)
            self._safe(self.store.update_trade, tid, patch)
            if info:
                self.loss_streak = self.loss_streak + 1 if info.profit < 0 else 0
            self.log("trade", "executor", f"SAÍDA ticket {ticket}: {patch['close_reason']} · P&L {info.profit if info else '?'} R$")
            del self.tracked[ticket]

    # ------------------------------------------------------------------ sessão do dia
    def _session(self, day: date, mode: str, acct: Account) -> dict:
        key = (str(day), mode)
        if self.sess and (self.sess["day"], self.sess["mode"]) == key:
            return self.sess
        row = self._safe(self.store.get_session, key[0], mode, self.source)
        if not row:
            row = {"day": key[0], "mode": mode, "source": self.source, "start_equity": acct.equity, "pnl": 0.0, "trades": 0, "halted": False, "active_minutes": 0}
            self._safe(self.store.upsert_session, row)
        self.sess = row
        self.active_seconds = float(row.get("active_minutes", 0)) * 60
        return row

    # ------------------------------------------------------------------ contrato vigente e feed
    def _contract(self, root: str, today: date) -> str:
        k = (root, today)
        if k not in self.contract_cache:
            avail = self.gw.symbols(root + "*")
            self.contract_cache[k] = current_contract(root, today, self.extra, self.cfg.roll_days.get(root, 1), avail or None)
            self.gw.select(self.contract_cache[k])
            self.log("info", "scout", f"Contrato vigente de {root}: {self.contract_cache[k]}")
        return self.contract_cache[k]

    def _fresh(self, symbol: str) -> bool:
        t = self.gw.tick(symbol)
        if t is None:
            return False
        last = self.tickwatch.get(symbol)
        if last is None or last[0] != t.time_msc:
            self.tickwatch[symbol] = (t.time_msc, self.mono())
            return True
        return self.mono() - last[1] <= STALE_SECONDS

    # ------------------------------------------------------------------ comandos do painel
    def _commands(self) -> None:
        cmds = self._safe(self.store.pending_commands) or []
        for c in cmds:
            if c["command"] in ("panic", "close_all"):
                n = self._flatten("PARAR TUDO")
                self._safe(self.store.update_settings, {"enabled": False})
                self.log("warn", "risk", f"PARAR TUDO acionado: {n} posição(ões) zerada(s); robô desligado.")
                self._safe(self.store.ack_command, c["id"], "done", f"{n} zerada(s)")
            elif c["command"] == "refresh":
                self.last_hb = -1e9
                self._safe(self.store.ack_command, c["id"], "done", "ok")
            else:
                self._safe(self.store.ack_command, c["id"], "error", "comando desconhecido")

    # ------------------------------------------------------------------ bloqueios de entrada
    def _block(self, s: dict, now: datetime, sess: dict) -> str | None:
        if not s.get("enabled"):
            return "paused"
        if not is_business_day(now.date(), self.extra):
            return "closed_holiday"
        t = now.time()
        if not (hm(s["open_from"]) <= t <= hm(s["open_until"])):
            return "outside_hours"
        if sess.get("halted"):
            return "halted"
        if sess.get("trades", 0) >= s["max_trades_per_day"]:
            return "max_trades"
        if self._store_down():
            return "panel_down"
        return None

    # ------------------------------------------------------------------ passo principal
    def step(self) -> None:
        try:
            self._step()
        except Exception as e:  # o motor nunca morre: registra e segue (posições têm stop no servidor)
            self.error = f"erro interno: {e}"
            self.log("error", "logger", self.error)

    def _step(self) -> None:
        now = self.now()
        mono = self.mono()
        dt = min(5.0, mono - self.last_mono) if self.last_mono is not None else 0.0
        self.last_mono = mono
        s = self._load_settings()
        if s is None:
            self.state = "stopped"
            return
        s = effective_settings(s)
        if not self._ensure_connection(s):
            self.state = "error"
            self._heartbeat(now, s, None)
            return
        acct = self.gw.account()
        expected = "demo" if s["mode"] == "sim" else "real"
        if acct.mode != expected:
            self.error = f"Conta {acct.mode.upper()} conectada, mas o modo é {'SIMULADOR' if s['mode'] == 'sim' else 'REAL'}. Operação BLOQUEADA."
            self.state = "error"
            self._heartbeat(now, s, acct)
            return
        if s["mode"] == "real" and not (self.cfg.allow_real and s.get("real_unlocked")):
            self.error = "Modo REAL sem as duas travas (site: real_unlocked + esta máquina: allow_real). Operação BLOQUEADA."
            self.state = "error"
            self._heartbeat(now, s, acct)
            return
        self.error = None

        self._refresh_intel()
        self._commands()
        self._reconcile(s["mode"])
        sess = self._session(now.date(), s["mode"], acct)
        day_pnl = acct.equity - sess["start_equity"]

        # zeragem de fim de dia
        positions = self.gw.positions()
        if positions and now.time() >= hm(s["flat_at"]) and is_business_day(now.date(), self.extra):
            self._flatten("zeragem fim de dia")
        # limites diários
        st = day_state(day_pnl, s["daily_loss_brl"], s.get("daily_target_brl"))
        if st != "ok" and not sess.get("halted"):
            sess["halted"] = True
            sess["halt_reason"] = "limite de perda diário" if st == "loss" else "meta diária atingida"
            self._flatten(sess["halt_reason"])
            self._safe(self.store.upsert_session, dict(sess))
            self.log("warn", "risk", f"{sess['halt_reason'].upper()} ({day_pnl:+.2f} R$). Sem novas entradas até amanhã.")

        self._shadow_step(s, now)
        block = self._block(s, now, sess)
        if block is None:
            self.active_seconds += dt
            self._entries(s, acct, now, sess)
        self.state = "halted" if sess.get("halted") else (block or "trading")
        self._flush(now, s, acct, sess, day_pnl)
        self._heartbeat(now, s, acct, day_pnl, sess)

    # ------------------------------------------------------------------ entradas
    def _entries(self, s: dict, acct: Account, now: datetime, sess: dict) -> None:
        held = {p.symbol for p in self.gw.positions()}
        for root in s["symbols"]:
            if s.get("_max_open") and len(held) >= s["_max_open"]:
                return  # modo limitado: uma posição por vez, no total
            contract = self._contract(root, now.date())
            if any(h.startswith(root) for h in held):
                continue  # no máximo 1 posição por ativo
            if self.cooldown.get(contract, 0) > self.mono():
                continue
            if not self._fresh(contract):
                self.log("warn", "filter", f"RECUSA {contract}: preços parados/sem cotação.")
                continue
            sig = self.signal_fn(self.gw.candles(contract, self.cfg.timeframe, 120))
            if not sig:
                continue
            side, bar = sig
            if self.last_bar.get(contract) == bar:
                continue
            self.last_bar[contract] = bar
            if sess.get("trades", 0) >= s["max_trades_per_day"]:
                return
            ctx = {"side": side, "candles": self.gw.candles(contract, self.cfg.timeframe, 300), "now": now, "symbol": contract, "user_events": self.user_events,
                   "flow": self.live.flow(contract) if self.live else None}
            dec = self.intel.evaluate(ctx)
            self._safe(self.store.log_decision, {"symbol": contract, "decision": "entrou" if dec.allow else "nao_entrou", "reason": dec.text or ("entrou" if dec.allow else ""),
                                                 "regime": dec.regime, "prob": dec.prob, "version": str(self.champion_id), "details": {"layers": dec.layers, "side": side}})
            if not dec.allow:
                self.log("refuse", "analyst", f"{contract}: {dec.reason}")
                continue
            self._open(s, acct, root, contract, side, sess, dec)
            held = {p.symbol for p in self.gw.positions()}

    def _open(self, s: dict, acct: Account, root: str, contract: str, side: str, sess: dict, dec=None) -> None:
        spec = self.gw.spec(contract)
        if not spec.trade_allowed:
            self.log("refuse", "filter", f"RECUSA {contract}: negociação não permitida no símbolo.")
            return
        stop_pts = float(s["stop_points_win"] if root == "WIN" else s["stop_points_wdo"])
        n = size_contracts(acct.balance, s["profile"], float(s["risk_per_trade_brl"]), stop_pts, spec, int(s["max_contracts"]))
        if n <= 0:
            self.log("refuse", "risk", f"RECUSA {contract}: risco por operação não comporta nem 1 contrato (stop {stop_pts} pts).")
            return
        ar = self.intel.cfg["adaptive_risk"]                       # e) risco adaptativo: só REDUZ; nunca aumenta para recuperar perda
        n = adaptive_size(n, self.loss_streak, self.last_size, bool(dec and dec.high_vol), ar["after_losses"], ar["mult"], ar["high_vol_mult"], ar["enabled"])
        t = self.gw.tick(contract)
        price = t.ask if side == "buy" else t.bid
        m = self.gw.margin(contract, side, n, price)
        if m is not None and m > acct.margin_free * 0.9:
            self.log("refuse", "risk", f"RECUSA {contract}: margem insuficiente ({m:.2f} > {acct.margin_free * 0.9:.2f}).")
            return
        tick = spec.tick_size or 1.0
        rnd = lambda x: round(round(x / tick) * tick, spec.digits or 6)
        sign = 1 if side == "buy" else -1
        sl = rnd(price - sign * stop_pts)
        tp = rnd(price + sign * stop_pts * float(s.get("rr", 1.5)))
        res = self.gw.send_order(contract, side, n, sl, tp, "hexadesk")
        if not res.ok:
            self.log("error", "executor", f"Ordem recusada em {contract}: {res.comment} (código {res.retcode}).")
            self.cooldown[contract] = self.mono() + 60
            return
        pos = next((p for p in self.gw.positions() if p.ticket == res.ticket), None)
        if pos is None or not pos.sl:
            # stop NÃO confirmado no servidor: nunca fica posicionado sem proteção
            self.log("error", "risk", f"{contract}: stop não confirmado no servidor da corretora. Zerando por segurança.")
            if pos:
                self.intent[pos.ticket] = "sem stop no servidor"
                self.gw.close_position(pos, "sem stop")
            self.cooldown[contract] = self.mono() + 300
            return
        tid = self._safe(self.store.insert_trade, {"mode": s["mode"], "source": self.source, "root": root, "contract": contract, "side": side, "volume": n, "price_open": pos.price_open,
                                                  "sl": pos.sl, "tp": pos.tp, "ticket": pos.ticket, "opened_at": self.now().isoformat(), "stop_points": stop_pts})
        if tid is not None:
            self.tracked[pos.ticket] = tid
        sess["trades"] = sess.get("trades", 0) + 1
        self.last_size = n
        self.log("trade", "executor", f"ENTRADA {side.upper()} {n}x {contract} @ {pos.price_open} · stop {pos.sl} · alvo {pos.tp} (servidor da corretora)")

    # ------------------------------------------------------------------ inteligência
    def _refresh_intel(self) -> None:
        if self.mono() - self.last_intel_load < 30:
            return
        self.last_intel_load = self.mono()
        champ = self._safe(self.store.get_champion)
        cfg = (champ or {}).get("config") or {}
        if champ and cfg != self._champ_cfg:
            self._champ_cfg, self.champion_id = cfg, champ.get("id")
            self.intel = IntelPipeline(cfg)
            self.log("info", "analyst", f"Versão campeã carregada: {champ.get('name')} (camadas ligadas: {', '.join(k for k, v in self.intel.cfg.items() if v.get('enabled')) or 'nenhuma'}).")
        self.user_events = self._safe(self.store.get_events) or []

    def _shadow_step(self, s: dict, now: datetime) -> None:
        if not self.shadow:
            return
        self.shadow.sync(self.mono())
        if not self.shadow.traders:
            return
        for root in s["symbols"]:
            contract = self._contract(root, now.date())
            c = self.gw.candles(contract, self.cfg.timeframe, 300)
            if len(c) < 60:
                continue
            spec, tick = self.gw.spec(contract), self.gw.tick(contract)
            flow = self.live.flow(contract) if self.live else None
            for tr in self.shadow.traders.values():
                tr.on_bar(root, contract, c, now, tick, spec, s, flow, self.user_events)

    # ------------------------------------------------------------------ painel
    def _flush(self, now: datetime, s: dict, acct: Account, sess: dict, day_pnl: float) -> None:
        if self.mono() - self.last_flush < 60:
            return
        self.last_flush = self.mono()
        sess.update(pnl=round(day_pnl, 2), active_minutes=int(self.active_seconds // 60))
        self._safe(self.store.upsert_session, dict(sess))
        self._safe(self.store.snapshot, acct.equity, s["mode"])

    def _heartbeat(self, now: datetime, s: dict, acct: Account | None, day_pnl: float = 0.0, sess: dict | None = None) -> None:
        if self.mono() - self.last_hb < HEARTBEAT_SECONDS:
            return
        self.last_hb = self.mono()
        row = {"connector_ts": datetime.now(timezone.utc).isoformat(), "connector_version": __version__, "source": self.source, "state": self.state, "last_error": self.error,
               "account_mode": acct.mode if acct else "unknown", "mode_wanted": s["mode"],
               "account_login": (f"***{str(acct.login)[-3:]}" if acct else None), "account_server": acct.server if acct else None,
               "balance": acct.balance if acct else None, "equity": acct.equity if acct else None, "margin_free": acct.margin_free if acct else None,
               "day_pnl": round(day_pnl, 2), "trades_today": (sess or {}).get("trades", 0), "halted": bool((sess or {}).get("halted")),
               "contracts": {r: self.contract_cache.get((r, now.date())) for r in s["symbols"]}}
        if acct and self.connected_mode:
            try:
                row["positions"] = [{"symbol": p.symbol, "side": p.side, "volume": p.volume, "price_open": p.price_open, "sl": p.sl, "tp": p.tp, "profit": p.profit} for p in self.gw.positions()]
            except Exception:
                pass
        self._safe(self.store.upsert_status, row)

    def run_forever(self) -> None:  # pragma: no cover
        self.log("info", "logger", f"Conector v{__version__} iniciado.")
        while True:
            self.step()
            _time.sleep(self.cfg.loop_seconds)
