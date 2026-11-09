"""Interface com o MetaTrader 5.

`RealMt5Gateway` usa a biblioteca oficial `MetaTrader5` (só instala e roda no Windows, com o terminal MT5 instalado).
`FakeGateway` (fake_mt5.py) simula o mesmo contrato para testes e desenvolvimento fora do Windows.
ATENÇÃO: o RealMt5Gateway NÃO foi executado contra um terminal MT5 de verdade por quem o escreveu — teste na conta DEMO.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .risk import SymbolSpec


@dataclass
class Account:
    login: int
    server: str
    balance: float
    equity: float
    margin_free: float
    mode: str  # 'demo' | 'real' | 'contest' | 'unknown'
    currency: str = "BRL"


@dataclass
class Tick:
    bid: float
    ask: float
    time_msc: int


@dataclass
class Position:
    ticket: int
    symbol: str
    side: str  # 'buy' | 'sell'
    volume: float
    price_open: float
    sl: float
    tp: float
    profit: float
    time: float


@dataclass
class OrderResult:
    ok: bool
    ticket: int | None = None   # ticket da posição
    price: float | None = None
    retcode: int | None = None
    comment: str = ""


@dataclass
class ClosedInfo:
    price_close: float
    profit: float
    time: float


@dataclass
class Credentials:
    login: int
    password: str
    server: str


class Gateway(Protocol):
    def connect(self, creds: Credentials) -> None: ...
    def shutdown(self) -> None: ...
    def is_connected(self) -> bool: ...
    def account(self) -> Account: ...
    def symbols(self, pattern: str) -> list[str]: ...
    def select(self, symbol: str) -> bool: ...
    def spec(self, symbol: str) -> SymbolSpec: ...
    def tick(self, symbol: str) -> Tick | None: ...
    def candles(self, symbol: str, timeframe: str, n: int) -> list[tuple]: ...
    def positions(self) -> list[Position]: ...
    def send_order(self, symbol: str, side: str, volume: float, sl: float, tp: float, comment: str = "") -> OrderResult: ...
    def close_position(self, p: Position, comment: str = "") -> OrderResult: ...
    def cancel_orders(self) -> int: ...
    def history_closed(self, ticket: int) -> ClosedInfo | None: ...
    def margin(self, symbol: str, side: str, volume: float, price: float) -> float | None: ...


class RealMt5Gateway:
    MAGIC = 260001

    def __init__(self, terminal_path: str | None = None):
        self.path = terminal_path
        self.mt5 = None

    def _lib(self):
        if self.mt5 is None:
            try:
                import MetaTrader5 as mt5  # type: ignore
            except ImportError as e:  # pragma: no cover
                raise RuntimeError("A biblioteca MetaTrader5 só funciona no Windows (pip install MetaTrader5).") from e
            self.mt5 = mt5
        return self.mt5

    def connect(self, creds: Credentials) -> None:
        mt5 = self._lib()
        kwargs = dict(login=creds.login, password=creds.password, server=creds.server, timeout=30_000)
        if self.path:
            kwargs["path"] = self.path
        if not mt5.initialize(**kwargs):  # abre o terminal se ainda não estiver aberto
            raise RuntimeError(f"MT5 initialize falhou: {mt5.last_error()}")

    def shutdown(self) -> None:
        if self.mt5:
            self.mt5.shutdown()

    def is_connected(self) -> bool:
        mt5 = self._lib()
        ti = mt5.terminal_info()
        return bool(ti and ti.connected)

    def account(self) -> Account:
        mt5 = self._lib()
        a = mt5.account_info()
        if a is None:
            raise RuntimeError(f"account_info falhou: {mt5.last_error()}")
        mode = {mt5.ACCOUNT_TRADE_MODE_DEMO: "demo", mt5.ACCOUNT_TRADE_MODE_REAL: "real", mt5.ACCOUNT_TRADE_MODE_CONTEST: "contest"}.get(a.trade_mode, "unknown")
        return Account(a.login, a.server, a.balance, a.equity, a.margin_free, mode, a.currency)

    def symbols(self, pattern: str) -> list[str]:
        r = self._lib().symbols_get(pattern)
        return [s.name for s in r] if r else []

    def select(self, symbol: str) -> bool:
        return bool(self._lib().symbol_select(symbol, True))

    def spec(self, symbol: str) -> SymbolSpec:
        i = self._lib().symbol_info(symbol)
        if i is None:
            raise RuntimeError(f"símbolo {symbol} indisponível")
        mt5 = self._lib()
        return SymbolSpec(i.point, i.trade_tick_size, i.trade_tick_value, i.volume_min, i.volume_max, i.volume_step, i.digits,
                          i.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL)

    def tick(self, symbol: str) -> Tick | None:
        t = self._lib().symbol_info_tick(symbol)
        return Tick(t.bid, t.ask, t.time_msc) if t else None

    def candles(self, symbol: str, timeframe: str, n: int) -> list[tuple]:
        mt5 = self._lib()
        tf = getattr(mt5, f"TIMEFRAME_{timeframe}")
        rows = mt5.copy_rates_from_pos(symbol, tf, 1, n)  # começa em 1: ignora o candle em formação
        return [(int(r["time"]), r["open"], r["high"], r["low"], r["close"], r["tick_volume"]) for r in rows] if rows is not None else []

    def positions(self) -> list[Position]:
        mt5 = self._lib()
        r = mt5.positions_get() or []
        return [Position(p.ticket, p.symbol, "buy" if p.type == mt5.POSITION_TYPE_BUY else "sell", p.volume, p.price_open, p.sl, p.tp, p.profit, p.time) for p in r]

    def _send(self, req: dict) -> OrderResult:
        mt5 = self._lib()
        for filling in (mt5.ORDER_FILLING_RETURN, mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK):  # B3: a corretora define qual aceita
            req["type_filling"] = filling
            r = mt5.order_send(req)
            if r is None:
                return OrderResult(False, comment=f"order_send None: {mt5.last_error()}")
            if r.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED):
                return OrderResult(True, ticket=getattr(r, "order", None), price=r.price, retcode=r.retcode, comment=r.comment)
            if r.retcode != 10030:  # 10030 = modo de preenchimento não suportado → tenta o próximo
                return OrderResult(False, retcode=r.retcode, comment=r.comment)
        return OrderResult(False, retcode=10030, comment="nenhum modo de preenchimento aceito")

    def send_order(self, symbol, side, volume, sl, tp, comment=""):
        mt5 = self._lib()
        t = mt5.symbol_info_tick(symbol)
        if t is None:
            return OrderResult(False, comment="sem cotação")
        buy = side == "buy"
        req = {"action": mt5.TRADE_ACTION_DEAL, "symbol": symbol, "volume": float(volume), "type": mt5.ORDER_TYPE_BUY if buy else mt5.ORDER_TYPE_SELL,
               "price": t.ask if buy else t.bid, "sl": float(sl), "tp": float(tp), "deviation": 20, "magic": self.MAGIC, "comment": comment[:30], "type_time": mt5.ORDER_TIME_GTC}
        res = self._send(req)
        if res.ok:  # ticket da POSIÇÃO (o que o MT5 devolve em `order` é o da ordem)
            for p in self.positions():
                if p.symbol == symbol and p.sl:
                    res.ticket = p.ticket
                    break
            else:
                ps = [p for p in self.positions() if p.symbol == symbol]
                if ps:
                    res.ticket = ps[-1].ticket
        return res

    def close_position(self, p: Position, comment: str = ""):
        mt5 = self._lib()
        t = mt5.symbol_info_tick(p.symbol)
        if t is None:
            return OrderResult(False, comment="sem cotação")
        sell = p.side == "buy"
        req = {"action": mt5.TRADE_ACTION_DEAL, "symbol": p.symbol, "volume": float(p.volume), "type": mt5.ORDER_TYPE_SELL if sell else mt5.ORDER_TYPE_BUY,
               "position": p.ticket, "price": t.bid if sell else t.ask, "deviation": 30, "magic": self.MAGIC, "comment": comment[:30], "type_time": mt5.ORDER_TIME_GTC}
        return self._send(req)

    def cancel_orders(self) -> int:
        mt5 = self._lib()
        n = 0
        for o in mt5.orders_get() or []:
            r = mt5.order_send({"action": mt5.TRADE_ACTION_REMOVE, "order": o.ticket})
            n += 1 if r and r.retcode == mt5.TRADE_RETCODE_DONE else 0
        return n

    def history_closed(self, ticket: int) -> ClosedInfo | None:
        mt5 = self._lib()
        deals = mt5.history_deals_get(position=ticket)
        if not deals:
            return None
        out = [d for d in deals if d.entry == mt5.DEAL_ENTRY_OUT]
        if not out:
            return None
        return ClosedInfo(out[-1].price, sum(d.profit + d.commission + d.swap for d in deals), float(out[-1].time))

    def margin(self, symbol, side, volume, price):
        mt5 = self._lib()
        return mt5.order_calc_margin(mt5.ORDER_TYPE_BUY if side == "buy" else mt5.ORDER_TYPE_SELL, symbol, float(volume), float(price))
