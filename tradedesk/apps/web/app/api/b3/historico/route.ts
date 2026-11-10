import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';

export const runtime = 'nodejs';

/** Histórico de operações fechadas (mais recentes primeiro) + resultado por dia. Filtro: ?origem=internal|demo|real (padrão: o modo atual). */
export async function GET(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const o = new URL(req.url).searchParams.get('origem');
  const { data: s } = await admin.from('b3_settings').select('mode').eq('id', 1).maybeSingle();
  const origem = o === 'internal' || o === 'demo' || o === 'real' ? o : s?.mode === 'real' ? 'real' : 'internal';
  let q = admin.from('b3_trades').select('id,side,contract,volume,opened_at,closed_at,pnl,close_reason,why,price_open,price_close,fees,source,mode').eq('status', 'closed').order('closed_at', { ascending: false }).limit(400);
  q = origem === 'internal' ? q.eq('source', 'internal') : origem === 'demo' ? q.neq('source', 'internal').eq('mode', 'sim') : q.neq('source', 'internal').eq('mode', 'real');
  const { data } = await q;
  const trades = data ?? [];
  const byDay = new Map<string, { day: string; pnl: number; n: number }>();
  for (const t of trades) {
    const day = new Date(t.closed_at ?? t.opened_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const e = byDay.get(day) ?? { day, pnl: 0, n: 0 };
    e.pnl += Number(t.pnl ?? 0); e.n++; byDay.set(day, e);
  }
  return NextResponse.json({ origem, trades, days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)) }, { headers: { 'cache-control': 'no-store' } });
}
