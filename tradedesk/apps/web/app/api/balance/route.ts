import { decrypt, fetchPortfolio, makeExchange } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Saldo REAL puxado da corretora do cliente. */
export async function GET() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
  const [{ data: acc }, { data: s }] = await Promise.all([
    admin.from('exchange_accounts').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('bot_settings').select('quote').eq('user_id', userId).maybeSingle(),
  ]);
  if (!acc) return NextResponse.json({ connected: false });
  try {
    const ex = makeExchange(acc.exchange, { apiKey: decrypt(acc.api_key_enc), secret: decrypt(acc.api_secret_enc) });
    const p = await fetchPortfolio(ex, s?.quote ?? 'USDT');
    return NextResponse.json({ connected: true, exchange: acc.exchange, quote: s?.quote ?? 'USDT', ...p, at: Date.now() });
  } catch (e: any) {
    await admin.from('exchange_accounts').update({ last_error: String(e?.message ?? e).slice(0, 300), last_error_at: new Date().toISOString() }).eq('user_id', userId);
    return NextResponse.json({ connected: true, error: 'Falha ao consultar a corretora.' }, { status: 502 });
  }
}
