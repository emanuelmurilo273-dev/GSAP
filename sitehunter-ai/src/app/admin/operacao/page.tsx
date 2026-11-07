import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Bar, Stat } from "@/components/admin/Stat";
import { currentPeriod } from "@/lib/usage";
import { getSettings } from "@/lib/settings";
import { filtersToQuery } from "@/lib/adminCompanies";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  DONE: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-300" },
  PARTIAL: { label: "Parcial", cls: "bg-amber-500/15 text-amber-300" },
  FAILED: { label: "Falhou", cls: "bg-red-500/15 text-red-300" },
  RUNNING: { label: "Em andamento", cls: "bg-sky-500/15 text-sky-300" },
};

export default async function OperationsHome() {
  await pageUser({ admin: true });
  const since = new Date(Date.now() - 7 * 86400e3);
  const real = { isDemo: false };
  const [total, active, withPhone, withEmail, withSite, contacted, excluded, withPreview, byCat, byCatPhone, searches7, failed7, lastSearches, projects, published, projects7, usage, settings, lastFail] = await Promise.all([
    prisma.company.count({ where: real }),
    prisma.company.count({ where: { ...real, excludedAt: null } }),
    prisma.company.count({ where: { ...real, excludedAt: null, phone: { not: null } } }),
    prisma.company.count({ where: { ...real, excludedAt: null, email: { not: null } } }),
    prisma.company.count({ where: { ...real, excludedAt: null, website: { not: null } } }),
    prisma.company.count({ where: { ...real, contactedAt: { not: null } } }),
    prisma.company.count({ where: { ...real, excludedAt: { not: null } } }),
    prisma.company.count({ where: { ...real, excludedAt: null, projects: { some: {} } } }),
    prisma.company.groupBy({ by: ["category"], where: { ...real, excludedAt: null }, _count: true, orderBy: { _count: { category: "desc" } }, take: 10 }),
    prisma.company.groupBy({ by: ["category"], where: { ...real, excludedAt: null, phone: { not: null } }, _count: true }),
    prisma.leadSearch.count({ where: { startedAt: { gte: since }, isDemo: false } }),
    prisma.leadSearch.count({ where: { startedAt: { gte: since }, status: "FAILED" } }),
    prisma.leadSearch.findMany({ where: { isDemo: false }, orderBy: { startedAt: "desc" }, take: 6 }),
    prisma.project.count(),
    prisma.publication.count({ where: { status: "PUBLISHED" } }),
    prisma.project.count({ where: { createdAt: { gte: since } } }),
    prisma.usageCounter.aggregate({ where: { period: currentPeriod() }, _sum: { searches: true, generations: true } }),
    getSettings(),
    prisma.leadSearch.findFirst({ where: { status: "FAILED" }, orderBy: { startedAt: "desc" } }),
  ]);
  const phoneBy = new Map(byCatPhone.map((r) => [r.category, r._count]));
  const max = Math.max(1, ...byCat.map((r) => r._count));
  const pct = (n: number) => (active ? `${Math.round((n / active) * 100)}% das ativas` : "");

  return (
    <>
      <PageHeader title="Central operacional" subtitle="Empresas encontradas, buscas, sites e saúde do sistema num só lugar." />
      <AdminNav />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Empresas ativas" value={active} hint={`${total} no total · ${excluded} excluídas`} href="/admin/empresas" />
        <Stat label="Com telefone" value={withPhone} hint={pct(withPhone)} href={`/admin/empresas${filtersToQuery({ contato: "phone" })}`} tone="good" />
        <Stat label="Com e-mail" value={withEmail} hint={pct(withEmail)} href={`/admin/empresas${filtersToQuery({ contato: "email" })}`} />
        <Stat label="Com site próprio" value={withSite} hint={pct(withSite)} href={`/admin/empresas${filtersToQuery({ contato: "site" })}`} />
        <Stat label="Contatadas por você" value={contacted} hint="marcadas manualmente" href={`/admin/empresas${filtersToQuery({ situacao: "contacted" })}`} />
        <Stat label="Com prévia de site" value={withPreview} hint={`${projects} prévias no total · ${projects7} nos últimos 7 dias`} href="/admin/sites" />
        <Stat label="Buscas (7 dias)" value={searches7} hint={failed7 ? `${failed7} falharam` : "nenhuma falha"} tone={failed7 ? "warn" : "default"} href="/admin/buscas" />
        <Stat label="Sites no ar" value={published} hint="publicados e acessíveis" href="/admin/sites" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Empresas por segmento</h2>
          <p className="mb-3 text-xs text-slate-500">Quantidade ativa e quantas têm telefone publicado.</p>
          <div className="space-y-1.5">
            {byCat.length === 0 && <p className="text-sm text-slate-500">Nenhuma empresa ainda. Faça uma busca para começar.</p>}
            {byCat.map((r) => <Bar key={r.category ?? "—"} label={r.category ?? "Sem categoria"} value={r._count} max={max} extra={`${phoneBy.get(r.category) ?? 0} com telefone`} href={r.category ? `/admin/empresas${filtersToQuery({ cat: r.category })}` : undefined} />)}
          </div>
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold text-white">Últimas buscas</h2><Link href="/admin/buscas" className="text-sm text-brand-300 hover:text-brand-200">Ver todas</Link></div>
          <ul className="divide-y divide-white/5">
            {lastSearches.length === 0 && <li className="py-3 text-sm text-slate-500">Nenhuma busca feita.</li>}
            {lastSearches.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{s.niche} · {s.location}</p><p className="text-xs text-slate-500">{s.startedAt.toLocaleString("pt-BR")} · {s.created} novas de {s.found}</p></div>
                <span className={`badge shrink-0 ${STATUS[s.status]?.cls}`}>{STATUS[s.status]?.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-white">Uso do mês</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Usage label="Buscas de empresas" used={usage._sum.searches ?? 0} limit={settings.maxSearchesPerMonth} />
            <Usage label="Gerações de sites" used={usage._sum.generations ?? 0} limit={settings.maxGenerationsPerMonth} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Somatório de todos os usuários. Os limites são por assinante e podem ser ajustados em Configurações.</p>
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Atenção</h2>
          {lastFail ? (
            <div className="mt-3 text-sm"><p className="text-red-300">Última busca com falha</p><p className="mt-1 text-slate-300">{lastFail.niche} · {lastFail.location}</p><p className="mt-1 line-clamp-3 text-xs text-slate-500">{lastFail.error ?? "Sem detalhe registrado."}</p><Link href="/admin/erros" className="mt-2 inline-block text-brand-300 hover:text-brand-200">Ver erros e saúde</Link></div>
          ) : <p className="mt-3 text-sm text-emerald-300">Nenhuma busca falhou. Tudo certo.</p>}
        </section>
      </div>
    </>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between"><p className="text-sm text-slate-300">{label}</p><p className="text-sm tabular-nums text-slate-400">{used} / {limit} por assinante</p></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.max(2, pct)}%` }} /></div>
    </div>
  );
}
