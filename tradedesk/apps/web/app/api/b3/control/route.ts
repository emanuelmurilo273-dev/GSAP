import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

/** Ligar / pausar o robô (só controla se pode ABRIR posições; não mexe nas já abertas, que têm stop na corretora). */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const { action } = await req.json().catch(() => ({}));
  if (action !== 'start' && action !== 'pause') return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
  await admin.from('b3_settings').update({ enabled: action === 'start', updated_at: new Date().toISOString() }).eq('id', 1);
  await admin.from('b3_logs').insert({ level: 'info', agent: 'logger', message: action === 'start' ? 'Robô LIGADO pelo dono.' : 'Robô PAUSADO pelo dono (posições abertas mantêm o stop).' });
  await auditOwner(admin, { id: g.data.userId, email: g.data.email }, `b3.${action}`, {}, req);
  return NextResponse.json({ ok: true, enabled: action === 'start' });
}
