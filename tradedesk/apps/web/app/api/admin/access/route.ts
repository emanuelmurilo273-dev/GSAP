import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';

export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { userId, blocked } = await req.json().catch(() => ({}));
  if (typeof userId !== 'string' || typeof blocked !== 'boolean') return NextResponse.json({ error: 'dados inválidos' }, { status: 400 });
  const { admin } = g.data;
  await admin.from('subscriptions').update({ blocked_by_admin: blocked }).eq('user_id', userId);
  if (blocked) await admin.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
  return NextResponse.json({ ok: true });
}
