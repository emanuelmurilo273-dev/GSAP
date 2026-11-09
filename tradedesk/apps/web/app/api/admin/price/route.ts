import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

/** Altera o preço para NOVAS assinaturas (assinaturas existentes mantêm o valor contratado). */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { amount } = await req.json().catch(() => ({}));
  const n = Number(amount);
  if (!(n >= 5 && n <= 100000)) return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
  await g.data.admin.from('app_settings').upsert({ key: 'plan_price', value: { amount: n } });
  await auditOwner(g.data.admin, { id: g.data.userId, email: g.data.email }, 'admin.price', { amount: n }, req);
  return NextResponse.json({ ok: true });
}
