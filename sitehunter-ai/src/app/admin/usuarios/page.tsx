import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { currentPeriod } from "@/lib/usage";
import { computeAccess } from "@/lib/access";
import { getSettings } from "@/lib/settings";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await pageUser({ admin: true });
  const { q = "" } = await searchParams;
  const settings = await getSettings();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { subscription: true, usage: { where: { period: currentPeriod() } }, _count: { select: { projects: true } } },
  });
  const published = await prisma.publication.groupBy({ by: ["userId"], where: { status: "PUBLISHED" }, _count: true });
  const pubMap = new Map(published.map((p) => [p.userId, p._count]));
  return (
    <>
      <PageHeader title="Usuários" subtitle={`${users.length} usuário(s) exibido(s)`} />
      <form className="mb-4"><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Buscar por nome ou e-mail" /></form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Assinatura</th><th className="px-4 py-3">Acesso</th><th className="px-4 py-3">Pesquisas</th><th className="px-4 py-3">Gerações</th><th className="px-4 py-3">Sites (no ar)</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => {
              const a = computeAccess(u, u.subscription, settings);
              return (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><p className="font-medium text-white">{u.name} {u.role === "ADMIN" && <span className="badge bg-brand-500/15 text-brand-300">admin</span>}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                  <td className="px-4 py-3 text-slate-300">{u.subscription?.status ?? "NONE"}{u.subscription?.currentPeriodEnd && <span className="block text-xs text-slate-500">até {u.subscription.currentPeriodEnd.toLocaleDateString("pt-BR")}</span>}</td>
                  <td className="px-4 py-3">{u.adminSuspendedAt ? <span className="badge bg-red-500/15 text-red-300">Suspenso</span> : a.premium ? <span className="badge bg-emerald-500/15 text-emerald-300">Premium</span> : <span className="badge bg-slate-500/15 text-slate-300">Sem acesso</span>}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{u.usage[0]?.searches ?? 0}/{settings.maxSearchesPerMonth}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{u.usage[0]?.generations ?? 0}/{settings.maxGenerationsPerMonth}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{u._count.projects} ({pubMap.get(u.id) ?? 0})</td>
                  <td className="px-4 py-3 text-right"><Link href={`/admin/usuarios/${u.id}`} className="text-brand-300 hover:text-brand-200">Detalhes</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
