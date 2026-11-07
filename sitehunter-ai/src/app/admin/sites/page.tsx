import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Stat } from "@/components/admin/Stat";
import { currentPeriod } from "@/lib/usage";
import { getSettings } from "@/lib/settings";
import { designDirectionFor } from "@/lib/site/direction";

export const dynamic = "force-dynamic";
const PUB: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: "No ar", cls: "bg-emerald-500/15 text-emerald-300" },
  DRAFT: { label: "Prévia privada", cls: "bg-white/10 text-slate-300" },
  UNPUBLISHED: { label: "Retirado", cls: "bg-amber-500/15 text-amber-300" },
  SUSPENDED: { label: "Suspenso", cls: "bg-red-500/15 text-red-300" },
};

export default async function AdminSites() {
  await pageUser({ admin: true });
  const [projects, total, published, usage, settings] = await Promise.all([
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 60, select: { id: true, name: true, segment: true, aiGenerated: true, createdAt: true, updatedAt: true, content: true, company: { select: { id: true, name: true, city: true, category: true } }, publication: { select: { status: true, externalUrl: true, visits: true } } } }),
    prisma.project.count(),
    prisma.publication.count({ where: { status: "PUBLISHED" } }),
    prisma.usageCounter.aggregate({ where: { period: currentPeriod() }, _sum: { generations: true } }),
    getSettings(),
  ]);
  const left = Math.max(0, settings.maxGenerationsPerMonth - (usage._sum.generations ?? 0));
  return (
    <>
      <PageHeader title="Sites gerados" subtitle="Todas as prévias criadas pelo Hunter: abra, revise e gere uma nova versão a partir da empresa." actions={<Link href="/app/leads" className="btn-primary px-3 py-2 text-sm">Escolher empresa e gerar site</Link>} />
      <AdminNav />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Prévias criadas" value={total} />
        <Stat label="No ar" value={published} tone="good" />
        <Stat label="Gerações no mês" value={usage._sum.generations ?? 0} hint={`limite ${settings.maxGenerationsPerMonth} por assinante`} />
        <Stat label="Restam neste mês" value={left} hint="para o usuário que mais gerou, no limite padrão" tone={left < 10 ? "warn" : "default"} />
      </div>
      {projects.length === 0 ? <div className="card p-8 text-center text-sm text-slate-400">Nenhum site gerado ainda. Abra uma empresa em Leads e clique em “Gerar prévia do site”.</div> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const c = p.content as { concept?: { palette?: { bg: string; bg2: string; ink: string; accent: string; accent2: string } }; theme?: { style?: string } };
            const cp = c.concept?.palette;
            const pal = cp ? [cp.bg, cp.bg2, cp.ink, cp.accent, cp.accent2] : [];
            const dir = designDirectionFor(p.segment, `${p.name} ${p.company?.category ?? ""}`);
            const st = PUB[p.publication?.status ?? "DRAFT"]!;
            return (
              <article key={p.id} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="font-display truncate text-base font-semibold text-white">{p.name}</h3><p className="truncate text-xs text-slate-500">{p.company?.category ?? p.segment}{p.company?.city ? ` · ${p.company.city}` : ""}</p></div>
                  <span className={`badge shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
                <div className="mt-3 flex gap-1" aria-hidden="true">{pal.slice(0, 6).map((h, i) => <i key={i} className="h-5 flex-1 first:rounded-l-md last:rounded-r-md" style={{ background: h }} />)}</div>
                <p className="mt-3 text-xs text-slate-400"><span className="font-semibold text-slate-300">Direção: </span>{dir.name}. {dir.why}</p>
                <p className="mt-2 text-[11px] text-slate-600">Atualizado em {p.updatedAt.toLocaleString("pt-BR")}{p.publication?.visits ? ` · ${p.publication.visits} visita(s)` : ""}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Link href={`/app/sites/${p.id}`} className="btn-primary px-3 py-1.5 text-xs">Abrir e revisar</Link>
                  {p.company && <Link href={`/app/leads/${p.company.id}#previa`} className="btn-secondary px-3 py-1.5 text-xs">Gerar nova versão</Link>}
                  {p.publication?.externalUrl && <a href={p.publication.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">Abrir link público</a>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
