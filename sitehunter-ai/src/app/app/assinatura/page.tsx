import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { formatBRL, getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { Alert } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  NONE: "Sem assinatura", PENDING: "Aguardando pagamento", ACTIVE: "Ativa", CANCELED: "Renovação cancelada", PAST_DUE: "Pagamento em atraso",
  EXPIRED: "Vencida", REFUNDED: "Reembolsada", CHARGEBACK: "Contestada (chargeback)",
};
const PAY_LABEL: Record<string, string> = { WAITING_PAYMENT: "Aguardando", PAID: "Pago", REFUSED: "Recusado", REFUNDED: "Reembolsado", CHARGEDBACK: "Chargeback" };

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await pageUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const payments = await prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 24 });
  const sub = user.subscription;
  const checkoutReady = !!(settings.checkoutUrl ?? env.kiwifyCheckoutUrl);

  return (
    <>
      <PageHeader title="Assinatura" subtitle="Pagamentos processados com segurança pela Kiwify." />
      <div className="space-y-4">
        {sp.bemvindo && <Alert kind="success">Conta criada! Assine o plano Premium para liberar a busca de empresas, a geração de sites e a publicação.</Alert>}
        {sp.erro === "checkout" && <Alert>O checkout ainda não foi configurado pelo administrador da plataforma.</Alert>}
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section className="card relative overflow-hidden p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
          <span className="badge bg-brand-500/15 text-brand-300">PREMIUM</span>
          <p className="mt-3 text-4xl font-extrabold text-white">{formatBRL(settings.priceCents)}<span className="text-base font-normal text-slate-400">/mês</span></p>
          <ul className="mt-5 space-y-2 text-sm text-slate-300">
            <li>✓ Busca de empresas — até {settings.maxSearchesPerMonth} pesquisas/mês</li>
            <li>✓ Geração de sites com IA — até {settings.maxGenerationsPerMonth}/mês</li>
            <li>✓ Editor, publicação, hospedagem e SSL — até {settings.maxPublishedSites} sites no ar</li>
            <li>✓ Propostas comerciais, mensagens de abordagem e painel</li>
          </ul>
          {user.access.premium && user.access.reason !== "admin" ? (
            <p className="mt-6 text-sm text-emerald-300">Seu plano está ativo.</p>
          ) : user.access.reason === "admin" ? (
            <p className="mt-6 text-sm text-slate-400">Administradores têm acesso completo sem assinatura.</p>
          ) : (
            <a href="/api/billing/checkout" className={`btn-primary mt-6 w-full py-3.5 text-base ${checkoutReady ? "" : "pointer-events-none opacity-50"}`}>Assinar agora</a>
          )}
          <p className="mt-3 text-xs text-slate-500">Use no pagamento o mesmo e-mail da sua conta (<strong className="text-slate-300">{user.email}</strong>). A liberação acontece automaticamente quando a Kiwify confirma o pagamento — normalmente em instantes no cartão e Pix, e em até 3 dias úteis no boleto.</p>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold text-white">Situação atual</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Status</dt><dd className="font-medium text-white">{STATUS_LABEL[sub?.status ?? "NONE"]}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Acesso Premium</dt><dd className={user.access.premium ? "text-emerald-300" : "text-amber-300"}>{user.access.premium ? "Liberado" : "Bloqueado"}</dd></div>
            {sub?.currentPeriodEnd && <div className="flex justify-between"><dt className="text-slate-400">Período pago até</dt><dd className="text-white">{sub.currentPeriodEnd.toLocaleDateString("pt-BR")}</dd></div>}
            {sub?.retentionUntil && <div className="flex justify-between"><dt className="text-slate-400">Projetos preservados até</dt><dd className="text-amber-300">{sub.retentionUntil.toLocaleDateString("pt-BR")}</dd></div>}
          </dl>
          <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
            <p className="font-semibold text-slate-200">Importante sobre a hospedagem dos sites</p>
            <p className="mt-1">A hospedagem dos sites publicados depende da sua assinatura ativa. Se você cancelar a renovação, o acesso e os sites continuam até o fim do período pago. Após o vencimento, os recursos Premium são suspensos e os sites saem do ar (os visitantes verão “site temporariamente indisponível”). Os projetos ficam preservados por {settings.retentionDays} dias — exporte os arquivos dos sites de seus clientes se precisar mantê-los em outra hospedagem. Ao renovar, os sites voltam ao ar automaticamente.</p>
            <p className="mt-2">O cancelamento da renovação é feito pela Kiwify (no e-mail de compra ou na área do cliente Kiwify).</p>
          </div>
        </section>
      </div>
      <section className="card mt-5 overflow-x-auto p-0">
        <h2 className="px-5 pt-5 font-semibold text-white">Histórico de pagamentos</h2>
        {!payments.length ? (
          <p className="px-5 py-6 text-sm text-slate-500">Nenhum pagamento registrado.</p>
        ) : (
          <table className="mt-3 w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-2">Data</th><th className="px-5 py-2">Pedido</th><th className="px-5 py-2">Status</th><th className="px-5 py-2 text-right">Valor</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 text-slate-300">{(p.approvedAt ?? p.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{p.providerOrderId.slice(0, 13)}…</td>
                  <td className="px-5 py-2.5">{PAY_LABEL[p.status]}</td>
                  <td className="px-5 py-2.5 text-right text-slate-300">{formatBRL(p.grossAmountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
