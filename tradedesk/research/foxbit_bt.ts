import { DEFAULT_PARAMS, fetchHistory, runBacktest, makeExchange } from '../packages/core/src';
(async () => {
  const ex: any = new (require('ccxt').foxbit)({ enableRateLimit: true });
  for (const sym of ['BTC/BRL', 'ETH/BRL', 'SOL/BRL']) {
    for (const [fee, lab] of [[0.005, 'taker 0,5%'], [0.0025, 'maker 0,25%']] as const) {
      const c = await fetchHistory(ex, sym, '1h', 365 * 2);
      
      const r = runBacktest(c, { params: DEFAULT_PARAMS, feePct: fee, slippagePct: 0.0005 });
      const m = r.metrics;
      console.log(sym, lab, 'candles', c.length, new Date(c[0].t).toISOString().slice(0, 10), '→', new Date(c[c.length - 1].t).toISOString().slice(0, 10), 'trades', m.trades, 'acerto', m.winRate?.toFixed(2), 'PF', m.profitFactor?.toFixed(2), 'médio%', ((m.avgTradePct ?? 0) * 100).toFixed(2), 'pnl%', (m.totalPnlPct * 100).toFixed(1), 'DD%', (m.maxDrawdownPct * 100).toFixed(1), 'B&H%', (m.buyHoldPct * 100).toFixed(0));
    }
  }
})();
