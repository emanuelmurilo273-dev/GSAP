import 'server-only';
import { APP_NAME, asaas, emailLayout, sendEmail } from '@desk/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function findUserByEmail(admin: SupabaseClient, email: string) {
  const { data } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  return data?.id as string | undefined;
}

/** Link de acesso por token_hash — verificado no servidor em /auth/callback (sem depender do front). */
export async function accessLink(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink: ${error?.message}`);
  return `${APP_URL()}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/app/onboarding`;
}

function addMonth(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

/**
 * Processa eventos do Asaas. Idempotente (tabela webhook_events).
 * O acesso nasce AQUI (servidor, após a assinatura do webhook ser validada) — nunca no front-end.
 */
export async function handleAsaasEvent(admin: SupabaseClient, body: any) {
  const event: string = body?.event;
  const pay = body?.payment;
  const evId: string = body?.id ?? `${event}:${pay?.id ?? body?.subscription?.id}:${pay?.status ?? ''}`;

  const { error: dup } = await admin.from('webhook_events').insert({ id: evId });
  if (dup) return { duplicate: true };

  // ---- cancelamento de assinatura
  if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
    const id = body?.subscription?.id;
    if (id) await admin.from('subscriptions').update({ status: 'canceled' }).eq('asaas_subscription_id', id);
    return { ok: true };
  }
  if (!pay?.id) return { ignored: event };

  const subId: string | undefined = pay.subscription;
  const { data: sub } = subId ? await admin.from('subscriptions').select('*').eq('asaas_subscription_id', subId).maybeSingle() : { data: null };
  const { data: chk } = subId ? await admin.from('checkouts').select('*').eq('asaas_subscription_id', subId).maybeSingle() : { data: null };
  const email = chk?.email ?? (sub ? (await admin.from('profiles').select('email').eq('id', sub.user_id).maybeSingle()).data?.email : null);

  await admin.from('payments').upsert({
    asaas_payment_id: pay.id,
    user_id: sub?.user_id ?? null,
    email,
    asaas_subscription_id: subId ?? null,
    value: pay.value,
    status: pay.status,
    billing_type: pay.billingType,
    due_date: pay.dueDate,
    paid_at: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event) ? new Date().toISOString() : null,
    invoice_url: pay.invoiceUrl ?? null,
  });

  // ---- pagamento confirmado
  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    if (!email || !subId) return { ignored: 'sem checkout/assinatura conhecida' };
    let userId = sub?.user_id ?? (await findUserByEmail(admin, email));
    let created = false;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: chk?.name } });
      if (error || !data.user) {
        // e-mail já existe em auth mas sem perfil: procura
        const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
        if (!userId) throw new Error(`createUser: ${error?.message}`);
      } else { userId = data.user.id; created = true; }
      await admin.from('profiles').upsert({ id: userId, email, name: chk?.name ?? null });
      await admin.from('bot_settings').upsert({ user_id: userId }, { ignoreDuplicates: true });
    }
    const paidUntil = addMonth(pay.dueDate);
    await admin.from('subscriptions').upsert({
      user_id: userId,
      asaas_customer_id: pay.customer,
      asaas_subscription_id: subId,
      status: 'active',
      value: pay.value,
      paid_until: paidUntil,
      overdue_since: null,
    }, { onConflict: 'user_id' });
    await admin.from('payments').update({ user_id: userId }).eq('asaas_payment_id', pay.id);
    if (chk) await admin.from('checkouts').update({ status: 'paid' }).eq('id', chk.id);

    const link = await accessLink(admin, email);
    await sendEmail(email, `${APP_NAME} · pagamento confirmado`, emailLayout(created ? 'acesso liberado' : 'pagamento confirmado',
      `<p>Pagamento de <b>R$ ${Number(pay.value).toFixed(2)}</b> confirmado. ${created ? 'Sua conta foi criada.' : 'Seu acesso está ativo.'}</p>
       <p><a style="color:#39ff88;font-size:16px" href="${link}">&gt; ENTRAR NO PAINEL</a></p>
       <p style="color:#6b8f7a">Link de uso único. Depois, entre sempre pelo link mágico em ${APP_URL()}/login.</p>
       <p>Primeiro passo: conectar sua corretora, rodar o backtest e aceitar o termo de risco.</p>`));
    return { ok: true, created };
  }

  // ---- vencida
  if (event === 'PAYMENT_OVERDUE' && sub) {
    await admin.from('subscriptions').update({
      status: sub.status === 'blocked' ? 'blocked' : 'overdue',
      overdue_since: sub.overdue_since ?? new Date().toISOString(),
    }).eq('user_id', sub.user_id);
    return { ok: true };
  }
  return { ignored: event };
}

export { asaas };
