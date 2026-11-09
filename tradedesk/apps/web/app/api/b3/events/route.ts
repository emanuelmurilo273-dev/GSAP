import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

/** Calendário de notícias do filtro (Copom, CPI, falas do Fed…). As datas mudam todo ano: quem cadastra é você. */
export async function GET() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data } = await g.data.admin.from('b3_events').select('*').gte('starts_at', since).order('starts_at', { ascending: true }).limit(100);
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const b = await req.json().catch(() => ({}));
  const when = new Date(String(b.starts_at ?? ''));
  const title = String(b.title ?? '').trim().slice(0, 80);
  if (Number.isNaN(when.getTime()) || title.length < 2) return NextResponse.json({ error: 'data/hora e título são obrigatórios' }, { status: 400 });
  const impact = b.impact === 'medio' ? 'medio' : 'alto';
  const { data, error } = await g.data.admin.from('b3_events').insert({ starts_at: when.toISOString(), title, impact }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditOwner(g.data.admin, { id: g.data.userId, email: g.data.email }, 'b3.event.add', { title, when: when.toISOString() }, req);
  return NextResponse.json({ ok: true, event: data });
}

export async function DELETE(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  await g.data.admin.from('b3_events').delete().eq('id', id);
  await auditOwner(g.data.admin, { id: g.data.userId, email: g.data.email }, 'b3.event.delete', { id }, req);
  return NextResponse.json({ ok: true });
}
