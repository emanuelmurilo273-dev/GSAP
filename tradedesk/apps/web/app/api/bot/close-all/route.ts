import { closeTrade, decrypt, log, makeExchange, type TradeRow } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Pânico: pausa o robô e vende a mercado todas as posições abertas. */
export async function POST() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
  await admin.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
  const [{ data: acc }, { data: open }] = await Promise.all([
    admin.from('exchange_accounts').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('trades').select('*').eq('user_id', userId).eq('status', 'open'),
  ]);
  if (!open?.length) return NextResponse.json({ closed: 0, failed: 0, note: 'Robô pausado. Não há posições abertas.' });
  if (!acc) return NextResponse.json({ error: 'corretora não conectada' }, { status: 400 });
  const ex = makeExchange(acc.exchange, { apiKey: decrypt(acc.api_key_enc), secret: decrypt(acc.api_secret_enc) });
  await ex.loadMarkets();
  await log(admin, userId, 'logger', 'warn', 'FECHAR TODAS AS POSIÇÕES acionado pelo cliente.');
  let closed = 0;
  const errors: string[] = [];
  for (const t of open as TradeRow[]) {
    try { await closeTrade(admin, ex, t, 'fechamento manual'); closed++; }
    catch (e: any) {
      errors.push(`${t.symbol}: ${String(e?.message ?? e).slice(0, 100)}`);
      await log(admin, userId, 'executor', 'error', `Falha ao fechar ${t.symbol}: ${String(e?.message ?? e)}`);
    }
  }
  return NextResponse.json({ closed, failed: errors.length, errors });
}
