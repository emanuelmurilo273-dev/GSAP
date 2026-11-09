import { EXCHANGES, fetchHistory, makeExchange, runBacktest, type ExchangeId } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';
import { cleanParams } from '@/lib/params';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Backtest em dados históricos REAIS (candles públicos da corretora) com taxas e slippage. */
export async function POST(req: Request) {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
  const b = await req.json().catch(() => ({}));
  const exchange = (b.exchange in EXCHANGES ? b.exchange : 'binance') as ExchangeId;
  const symbol = String(b.symbol ?? '');
  const days = [30, 90, 365].includes(Number(b.days)) ? Number(b.days) : 90;
  if (!/^[A-Z0-9]{2,10}\/(USDT|BRL)$/.test(symbol)) return NextResponse.json({ error: 'par inválido (ex.: BTC/USDT)' }, { status: 400 });
  const params = cleanParams(b.params);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from('backtests').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
  if ((count ?? 0) >= 30) return NextResponse.json({ error: 'limite diário de backtests atingido' }, { status: 429 });

  try {
    const ex = makeExchange(exchange);
    const candles = await fetchHistory(ex, symbol, params.timeframe, days);
    if (candles.length < 200) return NextResponse.json({ error: `dados insuficientes (${candles.length} candles) para ${symbol}` }, { status: 422 });
    const r = runBacktest(candles, { params });
    const row = {
      kind: 'user', user_id: userId, exchange, symbol, days, timeframe: params.timeframe, params,
      metrics: r.metrics, equity: r.equity,
      data_from: new Date(r.metrics.from).toISOString(), data_to: new Date(r.metrics.to).toISOString(),
    };
    const { data } = await admin.from('backtests').insert(row).select('id').single();
    await admin.from('bot_settings').update({ backtest_done_at: new Date().toISOString() }).eq('user_id', userId);
    return NextResponse.json({ id: data?.id, metrics: r.metrics, equity: r.equity, trades: r.trades.slice(-50) });
  } catch (e: any) {
    return NextResponse.json({ error: `Falha ao obter dados da corretora: ${String(e?.message ?? e).slice(0, 150)}` }, { status: 502 });
  }
}
