import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { cleanB3Settings } from '@/lib/b3';
import { auditOwner } from '@/lib/owner';

export async function PUT(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const b = await req.json().catch(() => ({}));
  const { data: cur } = await admin.from('b3_settings').select('*').eq('id', 1).maybeSingle();
  if (!cur) return NextResponse.json({ error: 'rode a migration 003 no banco' }, { status: 500 });
  const next = cleanB3Settings(b, cur);
  const { error } = await admin.from('b3_settings').update({ ...next, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditOwner(admin, { id: g.data.userId, email: g.data.email }, 'b3.settings', next, req);
  return NextResponse.json({ ok: true, settings: next });
}
