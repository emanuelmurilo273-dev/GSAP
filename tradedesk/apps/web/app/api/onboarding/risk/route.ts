import { RISK_TERMS_VERSION } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

export async function POST(req: Request) {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const b = await req.json().catch(() => ({}));
  if (b.accept !== true) return NextResponse.json({ error: 'é necessário aceitar o termo' }, { status: 400 });
  await g.data.admin.from('bot_settings').update({
    risk_accepted_at: new Date().toISOString(),
    risk_terms_version: RISK_TERMS_VERSION,
    risk_accepted_ip: req.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  }).eq('user_id', g.data.userId);
  return NextResponse.json({ ok: true });
}
