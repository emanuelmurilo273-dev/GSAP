import { RISK_TERMS_VERSION } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

export async function POST(req: Request) {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
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
  const missing: string[] = [];
  if (!acc || !(acc.verified || acc.attested_no_withdraw)) missing.push('conectar a corretora');
  if (!s?.backtest_done_at) missing.push('rodar o backtest com a configuração atual');
  if (!s?.risk_accepted_at || s.risk_terms_version !== RISK_TERMS_VERSION) missing.push('aceitar o termo de risco');
  if (missing.length) return NextResponse.json({ error: `Antes de ligar: ${missing.join(', ')}.` }, { status: 412 });
  await admin.from('bot_settings').update({ bot_enabled: true }).eq('user_id', userId);
  await admin.from('bot_logs').insert({ user_id: userId, agent: 'logger', level: 'info', message: 'Robô LIGADO. Mesa de 6 agentes em operação.' });
  return NextResponse.json({ on: true });
}
