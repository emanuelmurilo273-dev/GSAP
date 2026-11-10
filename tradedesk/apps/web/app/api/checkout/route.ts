import { asaas, salesOpen } from '@desk/core';
import { NextResponse } from 'next/server';
import { getPlanPrice } from '@/lib/price';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 8;
}

export async function POST(req: Request) {
  if (!salesOpen()) return NextResponse.json({ error: 'A venda ainda não está aberta (a estratégia ainda não foi aprovada). Entre na lista de espera.' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'ip';
  if (limited(ip)) return NextResponse.json({ error: 'muitas tentativas, aguarde' }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase();
  const cpfCnpj = String(b.cpfCnpj ?? '').replace(/\D/g, '');
  if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || ![11, 14].includes(cpfCnpj.length)) {
    return NextResponse.json({ error: 'dados inválidos (nome, e-mail, CPF/CNPJ)' }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) {
    const { data: s } = await admin.from('subscriptions').select('status').eq('user_id', existing.id).maybeSingle();
    if (s && ['active', 'overdue'].includes(s.status)) return NextResponse.json({ error: 'já existe assinatura ativa para este e-mail — faça login.' }, { status: 409 });
  }
  try {
    const value = await getPlanPrice();
    const { data: chk, error } = await admin.from('checkouts').insert({ email, name, cpf_cnpj: cpfCnpj }).select('id').single();
    if (error || !chk) throw new Error(error?.message);
    const customer = await asaas.createCustomer({ name, email, cpfCnpj, externalReference: chk.id });
    const sub = await asaas.createSubscription({ customer: customer.id, value, externalReference: chk.id, description: `Assinatura ${process.env.NEXT_PUBLIC_APP_NAME ?? 'HEXADESK'}` });
    const pays = await asaas.subscriptionPayments(sub.id);
    const first = pays?.data?.[0];
    if (!first) throw new Error('cobrança inicial não gerada');
    await admin.from('checkouts').update({ asaas_customer_id: customer.id, asaas_subscription_id: sub.id, asaas_payment_id: first.id }).eq('id', chk.id);
    const qr = await asaas.pixQr(first.id).catch(() => null);
    return NextResponse.json({ checkoutId: chk.id, value, invoiceUrl: first.invoiceUrl, qr: qr && { image: qr.encodedImage, payload: qr.payload, expires: qr.expirationDate } });
  } catch (e: any) {
    console.error('[checkout]', e);
    return NextResponse.json({ error: 'Não foi possível gerar a cobrança. Tente novamente.' }, { status: 502 });
  }
}
