import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { formatBRL } from "@/lib/settings";
import { LinkPayment } from "@/components/admin/LinkPayment";

export default async function AdminPayments() {
  await pageUser({ admin: true });
  const [payments, events] = await Promise.all([
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true } } } }),
    prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 30, select: { id: true, eventType: true, receivedAt: true, processedAt: true, error: true } }),
  ]);
  return (
    <>
      <PageHeader title="Pagamentos" subtitle="Registros recebidos via webhook da Kiwify. Pendentes não contam como receita." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Conta</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Método</th><th className="px-4 py-3 text-right">Bruto</th><th className="px-4 py-3 text-right">Taxa</th><th className="px-4 py-3 text-right">Líquido</th></tr></thead>
          <tbody className="divide-y divide-white/5">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 text-slate-300">{(p.approvedAt ?? p.createdAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.providerOrderId}</td>
                <td className="px-4 py-2.5">{p.user?.email ?? <LinkPayment paymentId={p.id} hint={p.customerEmail} />}</td>
                <td className="px-4 py-2.5">{p.status}</td>
                <td className="px-4 py-2.5 text-slate-400">{p.paymentMethod ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">{formatBRL(p.grossAmountCents)}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{formatBRL(p.feeCents)}</td>
                <td className="px-4 py-2.5 text-right">{formatBRL(p.netAmountCents)}</td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum pagamento recebido ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      <section className="card mt-5 p-5">
        <h2 className="font-semibold text-white">Últimas notificações (webhooks)</h2>
        <ul className="mt-3 space-y-1 text-xs">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2">
              <span className="text-slate-300">{e.receivedAt.toLocaleString("pt-BR")} · {e.eventType}</span>
              <span className={e.processedAt ? (e.error ? "text-amber-300" : "text-emerald-300") : "text-red-300"}>{e.processedAt ? (e.error ?? "processado") : `falhou: ${e.error ?? "pendente"}`}</span>
            </li>
          ))}
          {!events.length && <li className="text-slate-500">Nenhuma notificação recebida.</li>}
        </ul>
      </section>
    </>
  );
}
