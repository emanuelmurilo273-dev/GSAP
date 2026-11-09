"""Corretora simulada em memória (mesmo contrato do Gateway). Usada nos testes e no modo `--fake` (sem MT5)."""
from __future__ import annotations

from .gateway import Account, ClosedInfo, Credentials, OrderResult, Position, Tick
from .risk import SymbolSpec

WIN_SPEC = SymbolSpec(point=5, tick_size=5, tick_value=1.0, volume_min=1, volume_max=1000, volume_step=1)   # R$ 0,20 por ponto
WDO_SPEC = SymbolSpec(point=0.5, tick_size=0.5, tick_value=5.0, volume_min=1, volume_max=1000, volume_step=1)  # R$ 10 por ponto


class FakeGateway:
    def __init__(self, symbols: dict[str, SymbolSpec] | None = None, mode: str | None = None, balance: float = 10_000.0):
        self.specs = symbols or {"WINZ26": WIN_SPEC, "WDOZ26": WDO_SPEC}
        self.force_mode = mode          # força o tipo da conta (para testar a trava de segurança)
        self.mode = mode or "demo"
        self.balance = balance
        self.connected = False
        self.creds: Credentials | None = None
        self.prices: dict[str, float] = {s: (130_000.0 if s.startswith("WIN") else 5_400.0) for s in self.specs}
        self.time_msc: dict[str, int] = {}   # relógio de ticks POR símbolo
        self.bars: dict[str, list[tuple]] = {}
        self._positions: list[Position] = []
        self._closed: dict[int, ClosedInfo] = {}
        self._seq = 100
        self.fail_orders = False
        self.drop_sl = False       # simula corretora que não grava o stop
        self.stale = False         # simula feed parado
        self.connect_calls: list[str] = []

    # --- conexão
    def connect(self, creds: Credentials) -> None:
        self.creds, self.connected = creds, True
        self.mode = self.force_mode or ("demo" if "DEMO" in creds.server.upper() else "real")
        self.connect_calls.append(creds.server)

    def shutdown(self) -> None:
        self.connected = False

    def is_connected(self) -> bool:
        return self.connected

    def account(self) -> Account:
        floating = sum(p.profit for p in self._positions)
        return Account(self.creds.login if self.creds else 0, self.creds.server if self.creds else "", self.balance, self.balance + floating, self.balance + floating, self.mode)

    # --- mercado
    def symbols(self, pattern: str) -> list[str]:
        root = pattern.rstrip("*")
        return [s for s in self.specs if s.startswith(root)]

    def select(self, symbol: str) -> bool:
        return symbol in self.specs

    def spec(self, symbol: str) -> SymbolSpec:
        return self.specs[symbol]

    def tick(self, symbol: str) -> Tick | None:
        if symbol not in self.prices:
            return None
        if not self.stale or symbol not in self.time_msc:
            self.time_msc[symbol] = self.time_msc.get(symbol, 1_000) + 1
        p = self.prices[symbol]
        return Tick(p, p + self.specs[symbol].tick_size, self.time_msc[symbol])

    def candles(self, symbol: str, timeframe: str, n: int) -> list[tuple]:
        return self.bars.get(symbol, [])[-n:]

    # --- negociação
    def positions(self) -> list[Position]:
        return list(self._positions)

    def _profit(self, p: Position, price: float) -> float:
        sp = self.specs[p.symbol]
        d = (price - p.price_open) if p.side == "buy" else (p.price_open - price)
        return d * sp.brl_per_point * p.volume

    def send_order(self, symbol, side, volume, sl, tp, comment="") -> OrderResult:
        if self.fail_orders:
            return OrderResult(False, retcode=10006, comment="rejeitada")
        t = self.tick(symbol)
        price = t.ask if side == "buy" else t.bid
        self._seq += 1
        p = Position(self._seq, symbol, side, volume, price, 0.0 if self.drop_sl else sl, tp, 0.0, 0.0)
        self._positions.append(p)
        return OrderResult(True, ticket=p.ticket, price=price, retcode=10009)

    def _finish(self, p: Position, price: float) -> None:
        profit = self._profit(p, price)
        self.balance += profit
        self._positions = [x for x in self._positions if x.ticket != p.ticket]
        self._closed[p.ticket] = ClosedInfo(price, profit, 0.0)

    def close_position(self, p: Position, comment: str = "") -> OrderResult:
        t = self.tick(p.symbol)
        price = t.bid if p.side == "buy" else t.ask
        self._finish(p, price)
        return OrderResult(True, ticket=p.ticket, price=price, retcode=10009)

    def cancel_orders(self) -> int:
        return 0

    def history_closed(self, ticket: int) -> ClosedInfo | None:
        return self._closed.get(ticket)

    def margin(self, symbol, side, volume, price):
        return 150.0 * volume

    # --- controle do simulador
    def move(self, symbol: str, price: float) -> None:
        """Move o preço; stops/alvos gravados na posição disparam como no servidor da corretora."""
        self.prices[symbol] = price
        for p in list(self._positions):
            if p.symbol != symbol:
                continue
            if p.sl and ((p.side == "buy" and price <= p.sl) or (p.side == "sell" and price >= p.sl)):
                self._finish(p, p.sl)
            elif p.tp and ((p.side == "buy" and price >= p.tp) or (p.side == "sell" and price <= p.tp)):
                self._finish(p, p.tp)
            else:
                p.profit = self._profit(p, price)
