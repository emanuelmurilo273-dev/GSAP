"""Modo SOMBRA (campeão x desafiante): cada versão "opera" em paralelo, com dinheiro de mentira, nos MESMOS candles, ticks e fluxo do mercado,
com o MESMO modelo de custos (1 tick de slippage na entrada e na saída + emolumentos/corretagem por contrato). Nenhuma ordem é enviada.
A conta real/demo executa só o campeão; a comparação justa é sombra(campeão) × sombra(desafiante). Nada é promovido automaticamente."""
from __future__ import annotations

from datetime import datetime

from .calendar_b3 import is_business_day
from .intel.pipeline import IntelPipeline
from .strategy import baseline_signal

# PLACEHOLDER: custo por contrato (ida e volta) em R$ — emolumentos + corretagem. CONFIRME no extrato/tabela da sua corretora.
DEFAULT_FEE_RT = {"WIN": 0.50, "WDO": 2.00}


def hm(t: str):
    h, m = t.split(":")
    return int(h) * 60 + int(m)


class ShadowTrader:
    def __init__(self, version_id, name: str, config: dict | None, source: str, store, fees: dict | None = None, signal_fn=baseline_signal):
        self.id, self.name, self.config, self.source, self.store = version_id, name, config or {}, source, store
        self.pipe = IntelPipeline(self.config)
        self.fees = {**DEFAULT_FEE_RT, **(fees or {})}
        self.signal_fn = signal_fn
        self.pos: dict[str, dict] = {}
        self.last_bar: dict[str, float] = {}
        self.trades: list[dict] = []
        self.loss_streak = 0
        self.last_size = None

    # --- um candle FECHADO novo para o símbolo
    def on_bar(self, root: str, symbol: str, candles: list[tuple], now: datetime, tick, spec, s: dict, flow: dict | None, user_events: list[dict]) -> None:
        bar = candles[-1]
        if self.last_bar.get(symbol) == bar[0]:
            return
        self.last_bar[symbol] = bar[0]
        slip = spec.tick_size
        p = self.pos.get(symbol)
        mins = now.hour * 60 + now.minute
        if p:
            sign = 1 if p["side"] == "buy" else -1
            hit_stop = bar[3] <= p["sl"] if sign > 0 else bar[2] >= p["sl"]
            hit_tp = bar[2] >= p["tp"] if sign > 0 else bar[3] <= p["tp"]
            if hit_stop:
                self._close(symbol, p["sl"] - sign * slip, now, "stop", spec, root)
            elif hit_tp:
                self._close(symbol, p["tp"] - sign * slip, now, "alvo", spec, root)
            elif mins >= hm(s["flat_at"]):
                self._close(symbol, bar[4] - sign * slip, now, "zeragem fim de dia", spec, root)
        # a sombra avalia versões no mercado ao vivo mesmo com o robô PAUSADO (ela não envia ordens)
        if symbol in self.pos or not is_business_day(now.date()):
            return
        if not (hm(s["open_from"]) <= mins <= hm(s["open_until"])):
            return
        sig = self.signal_fn(candles)
        if not sig:
            return
        side = sig[0]
        dec = self.pipe.evaluate({"side": side, "candles": candles, "now": now, "flow": flow, "user_events": user_events, "symbol": symbol})
        if not dec.allow or tick is None:
            return
        stop = float(s["stop_points_win"] if root == "WIN" else s["stop_points_wdo"])
        sign = 1 if side == "buy" else -1
        entry = (tick.ask if side == "buy" else tick.bid) + sign * slip           # 1 tick de slippage na entrada
        self.pos[symbol] = {"side": side, "entry": entry, "sl": entry - sign * stop, "tp": entry + sign * stop * float(s.get("rr", 1.5)), "opened_at": now.isoformat()}

    def _close(self, symbol: str, price: float, now: datetime, reason: str, spec, root: str) -> None:
        p = self.pos.pop(symbol)
        sign = 1 if p["side"] == "buy" else -1
        pnl = (price - p["entry"]) * sign * spec.brl_per_point - self.fees.get(root, 0.0)
        row = {"version_id": self.id, "day": str(now.date()), "symbol": symbol, "side": p["side"], "opened_at": p["opened_at"], "closed_at": now.isoformat(),
               "pnl": round(pnl, 2), "reason": reason, "source": self.source}
        self.trades.append(row)
        self.loss_streak = self.loss_streak + 1 if pnl < 0 else 0
        try:
            self.store.insert_shadow(row)
        except Exception:
            pass


class ShadowManager:
    """Mantém um ShadowTrader por versão (campeão + desafiantes). Recarrega as versões do painel a cada 60 s."""

    def __init__(self, store, source: str, fees: dict | None = None):
        self.store, self.source, self.fees = store, source, fees
        self.traders: dict[object, ShadowTrader] = {}
        self.last_sync = -1e9

    def sync(self, mono: float) -> None:
        if mono - self.last_sync < 60:
            return
        self.last_sync = mono
        try:
            versions = [v for v in [self.store.get_champion(), *self.store.get_challengers()] if v]
        except Exception:
            return
        keep = set()
        for v in versions:
            keep.add(v["id"])
            cur = self.traders.get(v["id"])
            if cur is None or cur.config != (v.get("config") or {}):
                self.traders[v["id"]] = ShadowTrader(v["id"], v.get("name", ""), v.get("config"), self.source, self.store, self.fees)
        for k in list(self.traders):
            if k not in keep:
                del self.traders[k]
