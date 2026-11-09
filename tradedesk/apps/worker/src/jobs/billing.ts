import { APP_NAME, adminAlert, asaas, emailLayout, sendEmail } from '@desk/core';
import { sb } from '../lib/env';

/** Vencido há 3 dias → pausa robô, bloqueia acesso e cobra por e-mail. */
export async function dunning() {
  const cutoff = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: subs } = await sb.from('subscriptions').select('user_id,asaas_subscription_id').eq('status', 'overdue').lte('overdue_since', cutoff);
  for (const s of subs ?? []) {
    await sb.from('subscriptions').update({ status: 'blocked' }).eq('user_id', s.user_id);
    await sb.from('bot_settings').update({ bot_enabled: false }).eq('user_id', s.user_id);
    await sb.from('bot_logs').insert({ user_id: s.user_id, agent: 'risk', level: 'warn', message: 'Assinatura vencida há 3 dias — robô pausado e acesso bloqueado.' });
    const [{ data: prof }, { data: pay }] = await Promise.all([
      sb.from('profiles').select('email').eq('id', s.user_id).maybeSingle(),
      sb.from('payments').select('invoice_url').eq('asaas_subscription_id', s.asaas_subscription_id).in('status', ['OVERDUE', 'PENDING']).order('due_date', { ascending: false }).limit(1),
    ]);
    if (prof?.email) {
      const link = pay?.[0]?.invoice_url;
      await sendEmail(prof.email, `${APP_NAME} · acesso bloqueado por falta de pagamento`, emailLayout('cobrança',
        `<p>Sua mensalidade está vencida há 3 dias. Seu robô foi <b>pausado</b> e o acesso, bloqueado.</p>
         <p>As posições abertas continuam protegidas pelo stop na corretora (Binance); acompanhe-as direto na sua conta.</p>
         ${link ? `<p><a style="color:#39ff88" href="${link}">Pagar agora (Pix ou cartão)</a></p>` : ''}
         <p>Ao pagar, o acesso é liberado automaticamente.</p>`));
    }
  }
  return subs?.length ?? 0;
}

/**
 * Repasse automático do saldo do Asaas para OWNER_PIX_KEY.
 * O Asaas pode exigir autorização da transferência (token/aprovação no app). Nesse caso a transferência fica PENDENTE:
 * registramos "pending_authorization", avisamos o dono por e-mail e mostramos um alerta no admin — sem tentar de novo
 * enquanto houver uma pendente (evita transferências duplicadas).
 */
export async function payout() {
  const key = process.env.OWNER_PIX_KEY;
  if (!key) return 'OWNER_PIX_KEY não configurada';
  const { data: pend } = await sb.from('payouts').select('id').eq('status', 'pending_authorization').limit(1);
  if (pend?.length) return 'há repasse aguardando autorização — resolva no Asaas antes de novos repasses';
  const { balance } = await asaas.balance();
  const min = Number(process.env.MIN_PAYOUT ?? 100);
  if (balance < min) return `saldo ${balance} < mínimo ${min}`;
  try {
    const t: any = await asaas.transferPix(balance, key, process.env.OWNER_PIX_KEY_TYPE ?? 'EVP');
    const waiting = t?.authorized === false || t?.status === 'PENDING';
    await sb.from('payouts').insert({ value: balance, status: waiting ? 'pending_authorization' : 'ok', asaas_transfer_id: t?.id ?? null, detail: t?.status ?? null });
    if (waiting) await adminAlert(sb, 'payout-pending', 'Repasse Pix aguardando autorização', `<p>O repasse de <b>R$ ${balance.toFixed(2)}</b> está pendente de autorização no Asaas. Aprove no app/painel do Asaas.</p>`, 720);
    return waiting ? `repasse ${balance} pendente de autorização` : `repassado ${balance}`;
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 300);
    const needsAuth = /autoriz|authoriz|token|confirma/i.test(msg);
    await sb.from('payouts').insert({ value: balance, status: needsAuth ? 'pending_authorization' : 'error', detail: msg });
    await adminAlert(sb, needsAuth ? 'payout-pending' : 'payout-error', needsAuth ? 'Repasse Pix precisa de autorização' : 'Falha no repasse Pix', `<p>Repasse de R$ ${balance.toFixed(2)}: <span style="color:#ff4fa3">${msg}</span></p>`, 720);
    if (!needsAuth) throw e;
    return `repasse ${balance} aguardando autorização`;
  }
}
