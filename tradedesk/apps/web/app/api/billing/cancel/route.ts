import { asaas } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

/** Cancelamento a qualquer momento: encerra as cobranças futuras; o acesso vale até o fim do período pago. */
export async function POST() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
  const { data: sub } = await admin.from('subscriptions').select('asaas_subscription_id').eq('user_id', userId).maybeSingle();
  if (!sub?.asaas_subscription_id) return NextResponse.json({ error: 'assinatura não encontrada' }, { status: 404 });
  try {
    await asaas.cancelSubscription(sub.asaas_subscription_id);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
  await admin.from('subscriptions').update({ status: 'canceled' }).eq('user_id', userId);
  return NextResponse.json({ ok: true });
}
