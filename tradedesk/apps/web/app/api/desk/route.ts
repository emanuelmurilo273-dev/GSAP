import { healthOf } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';
import { reasonOf } from '@/lib/desk';
import { loadRealTrades } from '@/lib/stats';

export const runtime = 'nodejs';

/** Dados REAIS da mesa de 6 agentes: status, contadores de hoje, log, descartes, última nota, operação aberta. Nada inventado. */
export async function GET() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin, isOwner } = g.data as any;
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const since = new Date(`${day}T00:00:00-03:00`).toISOString();
  const [ag, logs, set, sym, open, last, snaps, ds] = await Promise.all([
    admin.from('agent_status').select('agent,state,detail,updated_at').eq('user_id', userId),
    admin.from('bot_logs').select('id,ts,agent,level,message').eq('user_id', userId).gte('ts', since).order('ts', { ascending: false }).limit(2000),
    admin.from('bot_settings').select('min_score,bases,quote,bot_enabled,position_pct').eq('user_id', userId).maybeSingle(),
    admin.from('symbol_state').select('symbol,last_score').eq('user_id', userId),
    admin.from('trades').select('id,symbol,qty,entry_price,stop_price,target_price,peak_price,trailing_active,entry_at,analysis,score,entry_order_id').eq('user_id', userId).eq('status', 'open').eq('testnet', false),
    admin.from('trades').select('id,symbol,pnl,exit_reason,exit_at,entry_price,exit_price,stop_price').eq('user_id', userId).eq('status', 'closed').eq('testnet', false).order('exit_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('equity_snapshots').select('ts,equity').eq('user_id', userId).gte('ts', new Date(Date.now() - 36 * 3600_000).toISOString()).order('ts', { ascending: true }).limit(600),
    admin.from('daily_state').select('start_equity,halted,halted_reason').eq('user_id', userId).eq('day', day).maybeSingle(),
  ]);
  let rows = (logs.data ?? []) as any[];
  if (isOwner) {   // o dono vê também a B3 no mesmo fluxo
    const b = await admin.from('b3_logs').select('id,ts,agent,level,message').gte('ts', since).order('ts', { ascending: false }).limit(1000);
    rows = [...rows, ...(b.data ?? []).map((r: any) => ({ ...r, id: `b3-${r.id}`, message: `B3 · ${r.message}` }))].sort((a, z) => z.ts.localeCompare(a.ts));
  }
  const by = (agent: string, level?: string) => rows.filter((r) => r.agent === agent && (!level || r.level === level)).length;
  const refuse = rows.filter((r) => r.level === 'refuse');
  const discards: Record<string, number> = {}; for (const r of refuse) { const k = reasonOf(r.message); discards[k] = (discards[k] ?? 0) + 1; }
  const analystLogs = by('analyst');
  const scored = rows.filter((r) => r.agent === 'analyst' && /nota/i.test(r.message));
  const lastScoreRow = scored[0]; const m = lastScoreRow?.message.match(/nota ([0-9][.,][0-9]+)/i);
  const { trades } = await loadRealTrades(admin, { userId, includeB3: !!isOwner });
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const health = healthOf(trades.filter((t) => t.closedAt >= since30).map((t) => t.pnl));
  const eq = (snaps.data ?? []).map((s: any) => ({ t: new Date(s.ts).getTime(), v: Number(s.equity) }));
  const startEq = ds.data?.start_equity == null ? (eq[0]?.v ?? null) : Number(ds.data.start_equity);
  const equity = eq.length ? eq[eq.length - 1].v : null;
  const tradesToday = rows.filter((r) => r.agent === 'executor' && r.level === 'trade' && /ENTRADA|COMPROU/i.test(r.message)).length;
  return NextResponse.json({
    at: Date.now(), equity, dayPnl: equity != null && startEq != null ? equity - startEq : null, dayPct: equity != null && startEq ? (equity - startEq) / startEq : null, curve: eq,
    halted: !!ds.data?.halted, haltedReason: ds.data?.halted_reason ?? null, enabled: !!set.data?.bot_enabled, minScore: Number(set.data?.min_score ?? 0.7), symbols: [...(set.data?.bases ?? []).map((b: string) => `${b}/${set.data?.quote ?? 'BRL'}`), ...(isOwner ? ['WIN', 'WDO'] : [])],
    agents: ag.data ?? [], counters: { scout: by('filter', 'refuse') + analystLogs, filter: by('filter', 'refuse'), analyst: scored.length, executor: tradesToday, risk: by('risk'), logger: refuse.length },
    discards: Object.entries(discards).sort((a, z) => z[1] - a[1]).map(([reason, n]) => ({ reason, n })),
    logs: rows.slice(0, 60), lastScore: m ? Number(m[1].replace(',', '.')) : null, lastScoreText: lastScoreRow?.message ?? null, scores: sym.data ?? [],
    open: open.data ?? [], lastClosed: last.data ?? null, health, filterRefusals: rows.filter((r) => r.agent === 'filter' && r.level === 'refuse').slice(0, 12), hasB3: !!isOwner,
  }, { headers: { 'cache-control': 'no-store' } });
}
