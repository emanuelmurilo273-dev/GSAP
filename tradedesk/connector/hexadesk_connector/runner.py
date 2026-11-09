"""Executor do conector real: coletor ao vivo a cada 200 ms (preços, book, trades → painel e disco) + motor a cada 1 s."""
from __future__ import annotations

import time as _time

from .engine import Engine
from .live import LiveCollector


class Runner:
    def __init__(self, engine: Engine, collector: LiveCollector, recorder=None):
        self.engine, self.live, self.rec = engine, collector, recorder

    def tick(self, i: int) -> None:
        self.live.poll()
        if i % 5 == 0:
            self.engine.step()

    def run_forever(self) -> None:  # pragma: no cover
        self.engine.log("info", "logger", "Conector iniciado (ao vivo a cada 200 ms).")
        i = 0
        try:
            while True:
                i += 1
                self.tick(i)
                _time.sleep(0.2)
        finally:
            if self.rec:
                self.rec.flush()
