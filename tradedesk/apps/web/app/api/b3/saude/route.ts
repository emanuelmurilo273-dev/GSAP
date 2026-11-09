import { healthOf } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';

export const runtime = 'nodejs';

/** Saúde do robô: expectativa por operação em R$ e semáforo, separados por origem (simulador interno × conta demo MT5 × real). */
export async function GET() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const [t, s] = await Promise.all([
    admin.from('b3_trades').select('source,mode,pnl,fees,gross_pnl,closed_at').eq('status', 'closed').not('pnl', 'is', null).order('closed_at', { ascending: true }).limit(20000),
    admin.from('b3_settings').select('mode,real_locked,real_locked_reason,real_unlocked,real_limited').eq('id', 1).maybeSingle(),
  ]);
  const rows = t.data ?? [];
  const groups: Record<string, { label: string; rows: any[] }> = {
    internal: { label: 'Simulador interno (preços artificiais)', rows: rows.filter((r) => r.source === 'internal') },
    demo: { label: 'Conta demo do MT5 (preços reais)', rows: rows.filter((r) => r.source !== 'internal' && r.mode === 'sim') },
    real: { label: 'Conta real (dinheiro de verdade)', rows: rows.filter((r) => r.source !== 'internal' && r.mode === 'real') },
  };
  const out = Object.entries(groups).map(([id, gr]) => {
    const pnls = gr.rows.map((r) => Number(r.pnl));
    const fees = gr.rows.reduce((a, r) => a + Number(r.fees ?? 0), 0);
    const gross = gr.rows.reduce((a, r) => a + Number(r.gross_pnl ?? r.pnl), 0);
    return { id, label: gr.label, health: healthOf(pnls), costs: { fees, gross, net: pnls.reduce((a, b) => a + b, 0) } };
  });
  const cur = s.data?.mode === 'real' ? 'real' : 'internal';
  return NextResponse.json({ groups: out, current: cur, lock: { locked: s.data?.real_locked !== false, reason: s.data?.real_locked_reason ?? null, mode: s.data?.mode ?? 'sim' } }, { headers: { 'cache-control': 'no-store' } });
}
