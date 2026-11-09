import type { SupabaseClient } from '@supabase/supabase-js';
import { runBacktest } from './backtest';
import { fetchHistory, makeExchange } from './exchange';
import { DEFAULT_PARAMS } from './types';

export const OFFICIAL_PERIODS = [90, 365] as const;

/**
 * Backtest OFICIAL da estratégia padrão (BTC/USDT na Binance, dados públicos reais).
 * Roda toda semana no worker; o admin pode disparar manualmente. A landing mostra só o que está aqui.
 */
export async function runOfficialBacktests(sb: SupabaseClient) {
  const ex = makeExchange('binance');
  const out: string[] = [];
  for (const days of OFFICIAL_PERIODS) {
    const candles = await fetchHistory(ex, 'BTC/USDT', DEFAULT_PARAMS.timeframe, days);
    if (candles.length < 200) throw new Error(`poucos candles (${candles.length}) para ${days}d`);
    const r = runBacktest(candles, { params: DEFAULT_PARAMS });
    const { error } = await sb.from('backtests').insert({
      kind: 'official',
      user_id: null,
      exchange: 'binance',
      symbol: 'BTC/USDT',
      days,
      timeframe: DEFAULT_PARAMS.timeframe,
      params: DEFAULT_PARAMS,
      metrics: r.metrics,
      equity: r.equity,
      data_from: new Date(r.metrics.from).toISOString(),
      data_to: new Date(r.metrics.to).toISOString(),
    });
    if (error) throw error;
    out.push(`${days}d: ${r.metrics.trades} trades`);
  }
  return out;
}
