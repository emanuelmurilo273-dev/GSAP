import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { formatBRL, getSettings } from "@/lib/settings";
import { computeAccess } from "@/lib/access";
import { publicUrlFor } from "@/lib/publish";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageUser({ admin: true });
  const u = await prisma.user.findUnique({
    where: { id: (await params).id },
    include: { subscription: true, usage: { orderBy: { period: "desc" }, take: 6 }, payments: { orderBy: { createdAt: "desc" }, take: 20 }, projects: { include: { publication: true }, orderBy: { updatedAt: "desc" } }, auditLogs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!u) notFound();
  const a = computeAccess(u, u.subscription, await getSettings());
  return (
    <>
      <PageHeader title={u.name} subtitle={`${u.email} · cadastrado em ${u.createdAt.toLocaleDateString("pt-BR")}`} actions={u.id !== admin.id ? <AdminUserActions userId={u.id} suspended={!!u.adminSuspendedAt} role={u.role} /> : undefined} />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5 text-sm">
          <h2 className="mb-3 font-semibold text-white">Assinatura</h2>
          <p>Status: <strong className="text-white">{u.subscription?.status ?? "NONE"}</strong></p>
          <p>Acesso: {a.premium ? "Premium" : "bloqueado"} ({a.reason})</p>
          {u.subscription?.currentPeriodEnd && <p>Período até: {u.subscription.currentPeriodEnd.toLocaleString("pt-BR")}</p>}
          {u.subscription?.providerSubscriptionId && <p className="break-all text-xs text-slate-500">Kiwify: {u.subscription.providerSubscriptionId}</p>}
          {u.subscription?.retentionUntil && <p className="text-amber-300">Retenção até {u.subscription.retentionUntil.toLocaleDateString("pt-BR")}</p>}
          {u.adminSuspendedAt && <p className="mt-2 text-red-300">Suspenso pelo admin em {u.adminSuspendedAt.toLocaleDateString("pt-BR")}{u.adminSuspendReason ? `: ${u.adminSuspendReason}` : ""}</p>}
          <h3 className="mb-2 mt-5 font-semibold text-white">Consumo</h3>
          <ul className="space-y-1 text-slate-400">{u.usage.map((x) => <li key={x.period}>{x.period}: {x.searches} pesquisas · {x.generations} gerações</li>)}</ul>
        </section>
        <section className="card p-5 text-sm lg:col-span-2">
          <h2 className="mb-3 font-semibold text-white">Sites</h2>
          <ul className="divide-y divide-white/5">
            {u.projects.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-slate-200">{p.name}</span>
                <span className="text-slate-400">{p.publication ? <>{p.publication.status} · <a className="text-brand-300" href={publicUrlFor(p.publication.slug, p.publication.customDomain, !!p.publication.customDomainVerifiedAt)} target="_blank" rel="noopener noreferrer">{p.publication.slug}</a> · {p.publication.visits} visitas</> : "rascunho"}</span>
              </li>
            ))}
            {!u.projects.length && <li className="py-2 text-slate-500">Nenhum projeto.</li>}
          </ul>
          <h2 className="mb-3 mt-6 font-semibold text-white">Pagamentos</h2>
          <ul className="divide-y divide-white/5">
            {u.payments.map((p) => <li key={p.id} className="flex justify-between py-2"><span className="font-mono text-xs text-slate-400">{p.providerOrderId}</span><span>{p.status} · {formatBRL(p.grossAmountCents)}</span></li>)}
            {!u.payments.length && <li className="py-2 text-slate-500">Nenhum pagamento.</li>}
          </ul>
          <h2 className="mb-3 mt-6 font-semibold text-white">Eventos recentes</h2>
          <ul className="space-y-1 text-xs text-slate-400">{u.auditLogs.map((l) => <li key={l.id}>{l.createdAt.toLocaleString("pt-BR")} — {l.action}</li>)}</ul>
        </section>
      </div>
    </>
  );
}
