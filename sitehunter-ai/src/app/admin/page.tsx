import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { RevenueChart } from "@/components/app/Charts";
import { formatBRL, getSettings } from "@/lib/settings";
import { computeAccess } from "@/lib/access";

export default async function AdminHome() {
  await pageUser({ admin: true });
  const settings = await getSettings();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [users, subs, paid, pending, refunds, paidThisMonth, unlinked, published, recentPaid] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.findMany({ include: { user: { select: { role: true, adminSuspendedAt: true, emailVerifiedAt: true } } } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { grossAmountCents: true, feeCents: true, netAmountCents: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "WAITING_PAYMENT" }, _sum: { grossAmountCents: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: { in: ["REFUNDED", "CHARGEDBACK"] } }, _sum: { grossAmountCents: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "PAID", approvedAt: { gte: monthStart } }, _sum: { grossAmountCents: true, netAmountCents: true }, _count: true }),
    prisma.payment.count({ where: { userId: null } }),
    prisma.publication.count({ where: { status: "PUBLISHED" } }),
    prisma.payment.findMany({ where: { status: "PAID", approvedAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } }, select: { approvedAt: true, grossAmountCents: true, netAmountCents: true } }),
  ]);
  const unknownAmounts = await prisma.payment.count({ where: { status: "PAID", grossAmountCents: null } });
  const active = subs.filter((s) => s.user.role !== "ADMIN" && computeAccess(s.user, s, settings, now, { requireEmailVerification: false }).premium);
  const renewing = active.filter((s) => s.status === "ACTIVE").length;
  const canceled = subs.filter((s) => s.status === "CANCELED" || s.status === "EXPIRED").length;

  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const chart = months.map((m) => {
    const inMonth = recentPaid.filter((p) => p.approvedAt && p.approvedAt.getFullYear() === m.getFullYear() && p.approvedAt.getMonth() === m.getMonth());
    return {
      label: m.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      bruto: inMonth.reduce((a, p) => a + (p.grossAmountCents ?? 0), 0) / 100,
      liquido: inMonth.reduce((a, p) => a + (p.netAmountCents ?? 0), 0) / 100,
    };
  });

  const cards = [
    { label: "Assinantes com acesso", value: String(active.length), hint: `${renewing} com renovação ativa` },
    { label: "Receita recorrente mensal (MRR)", value: formatBRL(renewing * settings.priceCents), hint: "assinaturas com renovação ativa × preço atual" },
    { label: "Recebido no mês (bruto)", value: formatBRL(paidThisMonth._sum.grossAmountCents ?? 0), hint: `${paidThisMonth._count} pagamento(s) · líquido ${formatBRL(paidThisMonth._sum.netAmountCents ?? 0)}` },
    { label: "Faturamento recebido (total)", value: formatBRL(paid._sum.grossAmountCents ?? 0), hint: `taxas ${formatBRL(paid._sum.feeCents ?? 0)} · líquido ${formatBRL(paid._sum.netAmountCents ?? 0)}` },
    { label: "Pagamentos pendentes", value: String(pending._count), hint: `${formatBRL(pending._sum.grossAmountCents ?? 0)} — não contam como receita` },
    { label: "Assinaturas canceladas/vencidas", value: String(canceled), hint: "" },
    { label: "Reembolsos e chargebacks", value: String(refunds._count), hint: formatBRL(refunds._sum.grossAmountCents ?? 0) },
    { label: "Usuários / sites no ar", value: `${users} / ${published}`, hint: unlinked ? `${unlinked} pagamento(s) sem conta vinculada` : "" },
  ];

  return (
    <>
      <PageHeader title="Painel administrativo" subtitle="Indicadores financeiros calculados a partir das notificações da Kiwify." />
      {unknownAmounts > 0 && <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-200">{unknownAmounts} pagamento(s) aprovados não trouxeram valores no webhook — os totais em R$ não os incluem. Configure as credenciais da API da Kiwify para conciliação ou confira no painel da Kiwify.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">{c.value}</p>
            {c.hint && <p className="mt-1 text-xs text-slate-500">{c.hint}</p>}
          </div>
        ))}
      </div>
      <section className="card mt-5 p-5">
        <h2 className="font-semibold text-white">Recebimentos nos últimos 6 meses</h2>
        <div className="mt-4"><RevenueChart data={chart} /></div>
      </section>
    </>
  );
}
