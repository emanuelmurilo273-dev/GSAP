import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { realChecklist } from '@/lib/b3';

export const runtime = 'nodejs';

/** Estado completo do painel B3 (o navegador consulta a cada poucos segundos). Só o dono. */
export async function GET() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const since = new Date(Date.now() - 18 * 3600_000).toISOString();
  const [settings, status, logs, open, trades, equity, checklist, decisions] = await Promise.all([
    admin.from('b3_settings').select('*').eq('id', 1).maybeSingle(),
    admin.from('b3_status').select('*').eq('id', 1).maybeSingle(),
    admin.from('b3_logs').select('id,ts,level,agent,message').order('ts', { ascending: false }).limit(80),
    admin.from('b3_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false }),
    admin.from('b3_trades').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(40),
    admin.from('b3_equity').select('ts,equity').gte('ts', since).order('ts', { ascending: true }).limit(1500),
    realChecklist(admin),
    admin.from('b3_decisions').select('ts,symbol,decision,reason,regime').order('ts', { ascending: false }).limit(5),
  ]);
  const ts = status.data?.connector_ts ? new Date(status.data.connector_ts).getTime() : 0;
  return NextResponse.json({
    settings: settings.data, status: status.data, connectorAgeSec: ts ? Math.round((Date.now() - ts) / 1000) : null,
    logs: logs.data ?? [], open: open.data ?? [], trades: trades.data ?? [],
    decisions: decisions.data ?? [], equity: (equity.data ?? []).map((r) => ({ t: new Date(r.ts).getTime(), v: Number(r.equity) })), checklist,
  });
}
