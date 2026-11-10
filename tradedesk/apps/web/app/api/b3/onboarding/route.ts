import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

/** Onboarding de 3 passos: aplica o perfil escolhido (risco por operação e perda máxima do dia em R$) e marca como concluído. */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'profile') {
    const P: Record<string, { risk: number; day: number }> = { conservador: { risk: 0.005, day: 0.01 }, moderado: { risk: 0.01, day: 0.02 }, agressivo: { risk: 0.02, day: 0.04 } };
    const p = P[String(b.profile)];
    if (!p) return NextResponse.json({ error: 'perfil inválido' }, { status: 400 });
    const { data: st } = await admin.from('b3_status').select('balance,equity').eq('id', 1).maybeSingle();
    const bal = Math.max(1000, Number(st?.balance ?? st?.equity ?? 10000));
    const upd = { profile: b.profile, risk_per_trade_brl: Math.max(10, Math.round(bal * p.risk)), daily_loss_brl: Math.max(10, Math.round(bal * p.day)), updated_at: new Date().toISOString() };
    await admin.from('b3_settings').update(upd).eq('id', 1);
    await auditOwner(admin, { id: g.data.userId, email: g.data.email }, 'b3.onboarding.profile', upd, req);
    return NextResponse.json({ ok: true, ...upd });
  }
  if (b.action === 'done') {
    await admin.from('app_settings').upsert({ key: 'b3_onboarded', value: { at: new Date().toISOString() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
