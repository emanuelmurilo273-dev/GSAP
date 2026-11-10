import { decrypt, fetchPortfolio, healthOf, makeExchange } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';
import { loadRealTrades } from '@/lib/stats';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Tudo da tela inicial do cliente: saldo REAL na corretora, resultado de hoje, status por mercado, saúde (30 dias reais) e última decisão. */
export async function GET() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin, isOwner } = g.data as any;
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [s, acc, ds, open, logs, snap] = await Promise.all([
    admin.from('bot_settings').select('bot_enabled,quote,paused_reason,risk_accepted_at').eq('user_id', userId).maybeSingle(),
    admin.from('exchange_accounts').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('daily_state').select('start_equity,halted,halted_reason').eq('user_id', userId).eq('day', day).maybeSingle(),
    admin.from('trades').select('symbol,qty,entry_price,stop_price,target_price,analysis').eq('user_id', userId).eq('status', 'open').eq('testnet', false),
    admin.from('bot_logs').select('ts,agent,level,message').eq('user_id', userId).in('agent', ['analyst', 'filter', 'risk']).order('ts', { ascending: false }).limit(5),
    admin.from('equity_snapshots').select('equity').eq('user_id', userId).order('ts', { ascending: false }).limit(1).maybeSingle(),
  ]);
  let equity: number | null = snap.data?.equity == null ? null : Number(snap.data.equity), live = false, error: string | null = null;
  if (acc.data) {
    try { const ex = makeExchange(acc.data.exchange, { apiKey: decrypt(acc.data.api_key_enc), secret: decrypt(acc.data.api_secret_enc) }); const p = await fetchPortfolio(ex, s.data?.quote ?? 'BRL'); equity = p.equity; live = true; }
    catch { error = 'Não consegui consultar a corretora agora.'; }
  }
  const { trades } = await loadRealTrades(admin, { userId, includeB3: !!isOwner });
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const health = healthOf(trades.filter((t) => t.closedAt >= since).map((t) => t.pnl));
  const startEq = ds.data?.start_equity == null ? null : Number(ds.data.start_equity);
  let b3: any = null;
  if (isOwner) {
    const [st, set] = await Promise.all([admin.from('b3_status').select('state,positions,day_pnl,connector_ts,source,account_mode').eq('id', 1).maybeSingle(), admin.from('b3_settings').select('mode,enabled').eq('id', 1).maybeSingle()]);
    const age = st.data?.connector_ts ? (Date.now() - new Date(st.data.connector_ts).getTime()) / 1000 : null;
    b3 = { mode: set.data?.mode, enabled: !!set.data?.enabled, state: st.data?.state, positions: st.data?.positions ?? [], dayPnl: Number(st.data?.day_pnl ?? 0), connectorAgeSec: age };
  }
  return NextResponse.json({
    connected: !!acc.data, exchange: acc.data?.exchange ?? null, enabled: !!s.data?.bot_enabled, pausedReason: s.data?.paused_reason ?? null, quote: s.data?.quote ?? 'BRL',
    equity, live, error, dayPnl: equity != null && startEq != null ? equity - startEq : null, dayPct: equity != null && startEq ? (equity - startEq) / startEq : null,
    halted: !!ds.data?.halted, haltedReason: ds.data?.halted_reason ?? null, open: open.data ?? [], logs: logs.data ?? [], health, b3, hasB3: !!isOwner,
  }, { headers: { 'cache-control': 'no-store' } });
}
