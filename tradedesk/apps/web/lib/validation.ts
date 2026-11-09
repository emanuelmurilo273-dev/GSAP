import 'server-only';
import { fetchHistory, makeExchange, runBacktest, type StrategyParams } from '@desk/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsToParams } from './params';

const DAY = 86_400_000;

/** Validação de 30 dias com a conta do dono: resultado REAL (trades fechados) × backtest do MESMO período e parâmetros. */
export async function ownerValidation(admin: SupabaseClient) {
  const { data: st } = await admin.from('app_settings').select('value').eq('key', 'owner_validation').maybeSingle();
  const start: string | undefined = (st?.value as any)?.start;
  if (!start) return { started: false as const };
  const { data: owner } = await admin.from('profiles').select('id').eq('role', 'owner').maybeSingle();
  if (!owner) return { started: false as const };
  const { data: s } = await admin.from('bot_settings').select('*').eq('user_id', owner.id).maybeSingle();
  const [{ data: closed }, { data: open }, { data: snaps }] = await Promise.all([
    admin.from('trades').select('pnl,pnl_pct,symbol,exit_at').eq('user_id', owner.id).eq('status', 'closed').gte('entry_at', start),
    admin.from('trades').select('id').eq('user_id', owner.id).eq('status', 'open'),
    admin.from('equity_snapshots').select('ts,equity').eq('user_id', owner.id).gte('ts', start).order('ts', { ascending: true }),
  ]);
  const t = closed ?? [];
  const wins = t.filter((x) => Number(x.pnl) > 0);
  const gw = wins.reduce((a, x) => a + Number(x.pnl), 0);
  const gl = Math.abs(t.filter((x) => Number(x.pnl) <= 0).reduce((a, x) => a + Number(x.pnl), 0));
  const eq0 = snaps?.[0] ? Number(snaps[0].equity) : null;
  const eq1 = snaps?.length ? Number(snaps[snaps.length - 1].equity) : null;
  const real = {
    trades: t.length, openNow: open?.length ?? 0, winRate: t.length ? wins.length / t.length : null,
    profitFactor: gl > 0 ? gw / gl : null, avgTradePct: t.length ? t.reduce((a, x) => a + Number(x.pnl_pct), 0) / t.length : null,
    pnl: t.reduce((a, x) => a + Number(x.pnl), 0), equityChangePct: eq0 && eq1 ? eq1 / eq0 - 1 : null, equityNow: eq1,
  };
  const days = Math.max(1, (Date.now() - new Date(start).getTime()) / DAY);

  let backtest: null | { trades: number; winRate: number | null; profitFactor: number | null; avgTradePct: number | null; pnlPct: number; note: string } = null;
  try {
    const params: StrategyParams = settingsToParams(s);
    const ex = makeExchange('binance');
    const bases: string[] = s?.bases ?? ['BTC'];
    let trades = 0, wn = 0, gW = 0, gL = 0, sumPct = 0, pnl = 0;
    for (const b of bases) {
      const c = await fetchHistory(ex, `${b}/${s?.quote ?? 'USDT'}`, params.timeframe, Math.ceil(days) + 12);
      const r = runBacktest(c, { params, startT: new Date(start).getTime() });
      trades += r.trades.length; wn += r.trades.filter((x) => x.pnl > 0).length;
      for (const x of r.trades) { if (x.pnl > 0) gW += x.pnl; else gL += -x.pnl; sumPct += x.pnlPct; }
      pnl += r.metrics.totalPnlPct;
    }
    backtest = { trades, winRate: trades ? wn / trades : null, profitFactor: gL > 0 ? gW / gL : null, avgTradePct: trades ? sumPct / trades : null, pnlPct: pnl / bases.length, note: `${bases.length} par(es), mesmos parâmetros, mesmo período` };
  } catch (e: any) { backtest = null; }
  return { started: true as const, start, days, real, backtest, params: s ? settingsToParams(s) : null };
}
