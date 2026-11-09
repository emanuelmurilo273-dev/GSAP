import math
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ["HEXADESK_DEV"] = "1"

from test_engine import BASE, SECRETS, Clock, Signals, make, run  # noqa: E402
from test_intel import bars  # noqa: E402

from hexadesk_connector.config import Config  # noqa: E402
from hexadesk_connector.fake_mt5 import WIN_SPEC, FakeGateway  # noqa: E402
from hexadesk_connector.gateway import Tick  # noqa: E402
from hexadesk_connector.shadow import ShadowManager, ShadowTrader  # noqa: E402
from hexadesk_connector.store import MemoryStore  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")
LATERAL = bars(300, lambda i: 1000 + 12 * math.sin(i / 3.0))
TREND = bars(300, lambda i: 1000 + i * 3.0)


def champion(cfg):
    return {"id": 7, "name": "Teste", "role": "champion", "config": cfg}


class EngineIntel(unittest.TestCase):
    def setup_engine(self, cfg, candles, **settings):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"], **settings))
        store.champion = champion(cfg)
        gw.bars["WINZ26"] = candles
        return eng, gw, store, clock, sig

    def test_default_version_enters_and_logs_the_decision(self):
        eng, gw, store, clock, sig = self.setup_engine({}, TREND)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        self.assertEqual([d["decision"] for d in store.decisions], ["entrou"])
        self.assertEqual(store.decisions[0]["version"], "7")

    def test_regime_layer_blocks_in_a_range_market_and_explains_why(self):
        eng, gw, store, clock, sig = self.setup_engine({"regime": {"enabled": True}}, LATERAL)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        d = store.decisions[0]
        self.assertEqual((d["decision"], d["reason"], d["regime"]), ("nao_entrou", "Não entrei: mercado lateral", "lateral"))
        self.assertTrue(store.has_log("mercado lateral"))

    def test_regime_layer_lets_a_trend_through(self):
        eng, gw, store, clock, sig = self.setup_engine({"regime": {"enabled": True}}, TREND)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)

    def test_news_layer_blocks_around_the_us_open(self):
        eng, gw, store, clock, sig = self.setup_engine({"news": {"enabled": True}}, TREND)
        clock.set(11, 20)                                            # 10 min antes das 11:30 (abertura de NY em novembro)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions(), [])
        self.assertEqual(store.decisions[0]["reason"], "Não entrei: abertura de Nova York em 10 min")

    def test_user_calendar_event_blocks(self):
        eng, gw, store, clock, sig = self.setup_engine({"news": {"enabled": True, "recurring": False}}, TREND)
        store.events = [{"starts_at": datetime(2026, 11, 9, 14, 20, tzinfo=SP).isoformat(), "title": "Copom"}]
        clock.set(14, 10)
        run(eng, clock); sig.fire(); run(eng, clock)
        self.assertEqual(store.decisions[0]["reason"], "Não entrei: Copom em 10 min")

    def test_flow_layer_needs_aggressors_on_our_side(self):
        eng, gw, store, clock, sig = self.setup_engine({"flow": {"enabled": True}}, TREND)
        class L:                                                       # coletor falso com fluxo comprador forte
            def flow(self, s, w=60): return {"trades": 80, "imbalance": 0.5, "book_imbalance": 0.3}
        eng.live = L()
        run(eng, clock); sig.fire("buy"); run(eng, clock)
        self.assertEqual(len(gw.positions()), 1)
        eng2, gw2, store2, clock2, sig2 = self.setup_engine({"flow": {"enabled": True}}, TREND)
        eng2.live = L()
        run(eng2, clock2); sig2.fire("sell"); run(eng2, clock2)         # venda contra o fluxo comprador
        self.assertEqual(gw2.positions(), [])
        self.assertIn("fluxo", store2.decisions[0]["reason"])

    def test_adaptive_risk_halves_after_two_losses_and_never_scales_up(self):
        eng, gw, store, clock, sig = self.setup_engine({"adaptive_risk": {"enabled": True}}, TREND, risk_per_trade_brl=500, profile="agressivo",
                                                      max_contracts=4, daily_loss_brl=5000, max_trades_per_day=10)
        run(eng, clock)
        sizes = []
        for _ in range(4):
            sig.fire(); run(eng, clock)
            p = gw.positions()[0]; sizes.append(p.volume)
            gw.move("WINZ26", p.sl - 5); run(eng, clock)                # perde
        self.assertEqual(sizes, [4, 4, 2, 2])                          # reduz depois de 2 perdas seguidas
        self.assertTrue(all(b <= a for a, b in zip(sizes, sizes[1:])))  # nunca aumenta após perda
        sig.fire(); run(eng, clock)
        p = gw.positions()[0]
        gw.move("WINZ26", p.tp + 5); run(eng, clock)                    # uma vitória zera a sequência
        sig.fire(); run(eng, clock)
        self.assertEqual(gw.positions()[0].volume, 4)

    def test_champion_change_reloads_layers(self):
        eng, gw, store, clock, sig = self.setup_engine({}, TREND)
        run(eng, clock)
        self.assertFalse(eng.intel.any_enabled)
        store.champion = champion({"regime": {"enabled": True}})
        clock.advance(40); run(eng, clock)
        self.assertTrue(eng.intel.any_enabled)
        self.assertTrue(store.has_log("Versão campeã carregada"))


def sc(price, t=0, v=10.0):
    return (t, price, price + 10, price - 10, price, v)


class Shadow(unittest.TestCase):
    S = dict(BASE, enabled=True, flat_at="17:30", rr=1.5)

    def mk(self, cfg=None, fees=None):
        st = MemoryStore()
        return ShadowTrader(1, "x", cfg, "mt5", st, fees), st

    def feed(self, tr, candles_list, now, tick):
        """Alimenta candle a candle, como o motor faria."""
        for i in range(len(candles_list)):
            tr.on_bar("WIN", "WINZ26", candles_list[: i + 1], now, tick, WIN_SPEC, self.S, None, [])

    def test_entry_uses_one_tick_slippage_and_pays_costs(self):
        tr, st = self.mk(fees={"WIN": 0.50})
        tr.signal_fn = lambda c: ("buy", c[-1][0]) if len(c) == 61 else None
        base = bars(61, lambda i: 130000)
        now = datetime(2026, 11, 9, 10, 0, tzinfo=SP)
        tr.on_bar("WIN", "WINZ26", base, now, Tick(129995, 130000, 1), WIN_SPEC, self.S, None, [])   # abre: ask 130000 + 1 tick
        self.assertEqual(tr.pos["WINZ26"]["entry"], 130000 + 5)
        self.assertEqual(tr.pos["WINZ26"]["sl"], 130005 - 150)
        # próximo candle atinge o stop: sai em sl - 1 tick (slippage) → perda = (150+5)*0.2 + 0.50 de custo
        nxt = base + [(61 * 300, 130000, 130001, 129800, 129850, 10.0)]
        tr.on_bar("WIN", "WINZ26", nxt, now, Tick(129845, 129850, 2), WIN_SPEC, self.S, None, [])
        self.assertEqual(len(tr.trades), 1)
        self.assertAlmostEqual(tr.trades[0]["pnl"], -((150 + 5) * 0.2 + 0.50), places=2)
        self.assertEqual(st.shadow[0]["source"], "mt5")

    def test_target_flat_at_close_and_one_position_per_symbol(self):
        tr, st = self.mk(fees={"WIN": 0.0})
        n = [0]
        tr.signal_fn = lambda c: ("buy", c[-1][0])
        base = bars(61, lambda i: 130000)
        now = datetime(2026, 11, 9, 10, 0, tzinfo=SP)
        tr.on_bar("WIN", "WINZ26", base, now, Tick(129995, 130000, 1), WIN_SPEC, self.S, None, [])
        again = base + [(61 * 300, 130000, 130040, 129990, 130010, 10.0)]
        tr.on_bar("WIN", "WINZ26", again, now, Tick(130005, 130010, 2), WIN_SPEC, self.S, None, [])
        self.assertEqual(len(tr.pos), 1)                                  # sinal repetido não abre 2ª posição
        hit = again + [(62 * 300, 130010, 130300, 130000, 130290, 10.0)]
        tr.on_bar("WIN", "WINZ26", hit, now, Tick(130285, 130290, 3), WIN_SPEC, self.S, None, [])
        self.assertEqual(tr.trades[-1]["reason"], "alvo")
        self.assertGreater(tr.trades[-1]["pnl"], 0)
        late = hit + [(63 * 300, 130010, 130020, 130000, 130015, 10.0)]            # candle sem tocar stop nem alvo
        tr.pos["WINZ26"] = {"side": "buy", "entry": 130000, "sl": 129850, "tp": 130225, "opened_at": now.isoformat()}
        tr.on_bar("WIN", "WINZ26", late, datetime(2026, 11, 9, 17, 30, tzinfo=SP), Tick(130290, 130295, 4), WIN_SPEC, self.S, None, [])
        self.assertEqual(tr.trades[-1]["reason"], "zeragem fim de dia")

    def test_layers_make_the_challenger_trade_differently_than_the_champion(self):
        champ, _ = self.mk({})
        chall, _ = self.mk({"regime": {"enabled": True}})
        for tr in (champ, chall):
            tr.signal_fn = lambda c: ("buy", c[-1][0])
        now = datetime(2026, 11, 9, 10, 0, tzinfo=SP)
        for tr in (champ, chall):
            tr.on_bar("WIN", "WINZ26", LATERAL, now, Tick(999, 1000, 1), WIN_SPEC, self.S, None, [])
        self.assertEqual(len(champ.pos), 1)
        self.assertEqual(len(chall.pos), 0)                               # o desafiante com filtro de regime ficou de fora do mercado lateral

    def test_manager_builds_one_trader_per_version_and_never_touches_orders(self):
        st = MemoryStore()
        st.champion = {"id": 1, "name": "campeã", "config": {}}
        st.challengers = [{"id": 2, "name": "desafiante", "config": {"regime": {"enabled": True}}}]
        m = ShadowManager(st, "mt5")
        m.sync(0)
        self.assertEqual(set(m.traders), {1, 2})
        st.challengers = []
        m.sync(100)
        self.assertEqual(set(m.traders), {1})

    def test_engine_runs_shadow_without_sending_orders(self):
        eng, gw, store, clock, sig = make(dict(symbols=["WIN"], enabled=False))      # robô PAUSADO: só a sombra trabalha
        store.champion = champion({})
        store.challengers = [{"id": 2, "name": "d", "config": {}}]
        gw.bars["WINZ26"] = TREND
        eng.shadow = ShadowManager(store, "mt5")
        eng.shadow.sync(1e9)
        for t in eng.shadow.traders.values():
            t.signal_fn = lambda c: ("buy", c[-1][0])
        eng.shadow.last_sync = 1e18                                       # evita recarregar e perder o signal_fn de teste
        run(eng, clock, 2)
        self.assertEqual(gw.positions(), [])                              # nenhuma ordem real
        self.assertTrue(all(t.pos for t in eng.shadow.traders.values()))   # mas as sombras abriram posição virtual


if __name__ == "__main__":
    unittest.main()


def setUpModule():      # estes testes cobrem o MOTOR (stops fixos, limites…); as regras v2 têm testes próprios em test_safety.py
    import hexadesk_connector.engine as _E
    _E.DEFAULT_RULES = "legacy"


def tearDownModule():
    import hexadesk_connector.engine as _E
    _E.DEFAULT_RULES = "v2"
