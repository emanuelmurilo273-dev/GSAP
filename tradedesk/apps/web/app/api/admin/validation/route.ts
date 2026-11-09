import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';
import { ownerValidation } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  return NextResponse.json(await ownerValidation(g.data.admin));
}

export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { action } = await req.json().catch(() => ({}));
  const { admin } = g.data;
  if (action === 'start') await admin.from('app_settings').upsert({ key: 'owner_validation', value: { start: new Date().toISOString() } });
  else if (action === 'reset') await admin.from('app_settings').delete().eq('key', 'owner_validation');
  else return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
  await auditOwner(admin, { id: g.data.userId, email: g.data.email }, `admin.validation.${action}`, {}, req);
  return NextResponse.json({ ok: true });
}
