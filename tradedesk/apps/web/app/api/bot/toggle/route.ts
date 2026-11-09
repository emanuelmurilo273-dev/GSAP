import { enableBlockers } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

export async function POST(req: Request) {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin, isOwner } = g.data;
  const { on } = await req.json().catch(() => ({ on: false }));
  if (!on) {
    await admin.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
    await admin.from('bot_logs').insert({ user_id: userId, agent: 'logger', level: 'info', message: 'Robô PAUSADO pelo cliente (posições abertas mantêm o stop).' });
    return NextResponse.json({ on: false });
  }
  const [{ data: s }, { data: acc }] = await Promise.all([
    admin.from('bot_settings').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('exchange_accounts').select('verified,attested_no_withdraw').eq('user_id', userId).maybeSingle(),
  ]);
  const missing = enableBlockers({ account: acc, settings: s, isOwner });
  if (missing.length) return NextResponse.json({ error: `Antes de ligar: ${missing.join('; ')}.` }, { status: 412 });
  await admin.from('bot_settings').update({ bot_enabled: true }).eq('user_id', userId);
  await admin.from('bot_logs').insert({ user_id: userId, agent: 'logger', level: 'info', message: 'Robô LIGADO. Mesa de 6 agentes em operação.' });
  return NextResponse.json({ on: true });
}
