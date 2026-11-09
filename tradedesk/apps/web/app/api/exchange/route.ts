import { EXCHANGES, enabledExchangeIds, encrypt, validateKeys, type ExchangeId } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Conecta a corretora: valida a chave na hora e RECUSA chave com permissão de saque. */
export async function POST(req: Request) {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
  const b = await req.json().catch(() => ({}));
  const exchange = b.exchange as ExchangeId;
  const apiKey = String(b.apiKey ?? '').trim();
  const secret = String(b.secret ?? '').trim();
  if (!(exchange in EXCHANGES) || !enabledExchangeIds().includes(exchange) || apiKey.length < 8 || secret.length < 8) return NextResponse.json({ error: exchange === 'mercado' ? 'Mercado Bitcoin está temporariamente indisponível.' : 'dados inválidos' }, { status: 400 });

  const { count } = await admin.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open');
  if (count) return NextResponse.json({ error: 'Feche as posições abertas antes de trocar a chave/corretora.' }, { status: 409 });

  const check = await validateKeys(exchange, { apiKey, secret }, !!b.attestNoWithdraw);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });

  await admin.from('exchange_accounts').upsert({
    user_id: userId,
    exchange,
    api_key_enc: encrypt(apiKey),
    api_secret_enc: encrypt(secret),
    key_hint: apiKey.slice(-4),
    permissions: check.permissions,
    verified: check.verified,
    attested_no_withdraw: !!b.attestNoWithdraw,
    last_error: null,
  });
  await admin.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
  return NextResponse.json({ ok: true, permissions: check.permissions, verified: check.verified, note: check.note });
}

export async function DELETE() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
  const { count } = await admin.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open');
  if (count) return NextResponse.json({ error: 'Feche as posições abertas primeiro.' }, { status: 409 });
  await admin.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
  await admin.from('exchange_accounts').delete().eq('user_id', userId);
  return NextResponse.json({ ok: true });
}
