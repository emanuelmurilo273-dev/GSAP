import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
const STATUS: Record<string, { label: string; cls: string }> = {
  DONE: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-300" },
  PARTIAL: { label: "Parcial", cls: "bg-amber-500/15 text-amber-300" },
  FAILED: { label: "Falhou", cls: "bg-red-500/15 text-red-300" },
  RUNNING: { label: "Em andamento", cls: "bg-sky-500/15 text-sky-300" },
};
type Step = { at: string; step: string; detail?: string };
const PROVIDER: Record<string, string> = { osm: "OpenStreetMap", google_places: "Google Maps", demo: "Demonstração", import: "Importação" };

export default async function AdminSearches({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageUser({ admin: true });
  const { status = "" } = await searchParams;
  const where = { isDemo: false, ...(status && STATUS[status] ? { status: status as "DONE" } : {}) };
  const [rows, counts] = await Promise.all([
    prisma.leadSearch.findMany({ where, orderBy: { startedAt: "desc" }, take: 80, include: { user: { select: { name: true } } } }),
    prisma.leadSearch.groupBy({ by: ["status"], where: { isDemo: false }, _count: true }),
  ]);
  const cnt = new Map(counts.map((c) => [c.status as string, c._count]));
  return (
    <>
      <PageHeader title="Buscas e prospecções" subtitle="Cada busca feita, o que ela encontrou e o aviso das fontes. Use “Repetir” para refazer com os mesmos termos." />
      <AdminNav />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[["", "Todas"], ...Object.entries(STATUS).map(([k, v]) => [k, `${v.label} (${cnt.get(k) ?? 0})`])].map(([k, label]) => (
          <Link key={k} href={k ? `/admin/buscas?status=${k}` : "/admin/buscas"} className={`rounded-full border px-3 py-1 text-xs ${status === k ? "border-brand-500/60 bg-brand-500/15 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>{label}</Link>
        ))}
      </div>
      {rows.length === 0 ? <div className="card p-8 text-center text-sm text-slate-400">Nenhuma busca neste filtro.</div> : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const steps = Array.isArray(s.log) ? (s.log as Step[]) : [];
            const warn = steps.filter((x) => /indispon|falh|erro|só Nominatim|tempo esgotado/i.test(x.detail ?? "")).map((x) => x.detail!);
            const secs = s.finishedAt ? Math.max(1, Math.round((s.finishedAt.getTime() - s.startedAt.getTime()) / 1000)) : null;
            return (
              <li key={s.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-white">{s.niche} <span className="font-normal text-slate-400">· {s.location}</span></p>
                    <p className="mt-0.5 text-xs text-slate-500">{s.startedAt.toLocaleString("pt-BR")} · {PROVIDER[s.provider] ?? s.provider} · {s.user.name}{secs ? ` · ${secs}s` : ""}</p>
                  </div>
                  <span className={`badge ${STATUS[s.status]?.cls}`}>{STATUS[s.status]?.label}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[["Pedidas", s.requested], ["Encontradas", s.found], ["Novas", s.created], ["Duplicadas", s.duplicates]].map(([l, v]) => (
                    <div key={String(l)} className="rounded-lg bg-white/[0.03] px-2 py-2"><dt className="text-[10px] uppercase tracking-wider text-slate-500">{l}</dt><dd className="font-display text-lg font-bold tabular-nums text-white">{v}</dd></div>
                  ))}
                </dl>
                {(s.error || warn.length > 0) && (
                  <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${s.error ? "border-red-500/25 bg-red-500/5 text-red-200" : "border-amber-500/20 bg-amber-500/5 text-amber-200"}`}>
                    {s.error && <p>{s.error}</p>}
                    {warn.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Link className="btn-secondary px-3 py-1.5 text-xs" href={`/app/leads?search=${s.id}`}>Ver empresas desta busca</Link>
                  <Link className="btn-ghost px-3 py-1.5 text-xs" href={`/app/buscar?niche=${encodeURIComponent(s.niche)}&local=${encodeURIComponent(s.location)}`}>Repetir busca</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
