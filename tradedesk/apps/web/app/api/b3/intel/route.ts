import { compare, MIN_SESSIONS, MIN_TRADES } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';

export const runtime = 'nodejs';

/** Aba "Inteligência": regime atual, decisões recentes (por que entrou / não entrou) e campeão x desafiante. */
export async function GET() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const [decisions, versions, analyst] = await Promise.all([
    admin.from('b3_decisions').select('*').order('ts', { ascending: false }).limit(60),
    admin.from('strategy_versions').select('*').neq('role', 'retired').order('id', { ascending: true }),
    admin.from('app_settings').select('value').eq('key', 'b3_analyst').maybeSingle(),
  ]);
  const vs = versions.data ?? [];
  const champ = vs.find((v) => v.role === 'champion') ?? null;
  const out: any[] = [];
  for (const v of vs.filter((x) => x.role === 'challenger')) {
    // só operações-sombra com preços REAIS (source = 'mt5'): as do simulador interno (preços artificiais) nunca contam
    const [a, b] = await Promise.all([
      champ ? admin.from('b3_shadow_trades').select('day,pnl,closed_at').eq('version_id', champ.id).eq('source', 'mt5').order('closed_at', { ascending: true }).limit(5000) : { data: [] as any[] },
      admin.from('b3_shadow_trades').select('day,pnl,closed_at').eq('version_id', v.id).eq('source', 'mt5').order('closed_at', { ascending: true }).limit(5000),
    ]);
    const cmp = compare((a.data ?? []).map((t: any) => ({ day: t.day, pnl: Number(t.pnl) })), (b.data ?? []).map((t: any) => ({ day: t.day, pnl: Number(t.pnl) })));
    const curve = (rows: any[]) => { let e = 0; return rows.map((t) => ({ t: new Date(t.closed_at).getTime(), v: (e += Number(t.pnl)) })); };
    out.push({ version: v, comparison: cmp, curves: { champion: curve(a.data ?? []), challenger: curve(b.data ?? []) } });
  }
  return NextResponse.json({
    decisions: decisions.data ?? [], champion: champ, challengers: out, analyst: (analyst.data?.value as any) ?? null,
    rules: { minSessions: MIN_SESSIONS, minTrades: MIN_TRADES },
  });
}
