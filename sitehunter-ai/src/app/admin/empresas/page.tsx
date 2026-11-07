import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { AdminNav } from "@/components/admin/AdminNav";
import { CompanyActions } from "@/components/admin/CompanyActions";
import { CONTACT_FILTERS, SITUATIONS, companyWhere, filtersToQuery, readFilters } from "@/lib/adminCompanies";
import { formatBrPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
const PAGE = 40;

export default async function AdminCompanies({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await pageUser({ admin: true });
  const sp = await searchParams;
  const f = readFilters(sp);
  const page = Math.max(1, parseInt(String(Array.isArray(sp.p) ? sp.p[0] : sp.p ?? "1"), 10) || 1);
  const where = companyWhere(f);
  const [rows, count, cats, states] = await Promise.all([
    prisma.company.findMany({ where, orderBy: [{ createdAt: "desc" }], skip: (page - 1) * PAGE, take: PAGE, include: { projects: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.company.count({ where }),
    prisma.company.groupBy({ by: ["category"], where: { isDemo: false }, _count: true, orderBy: { category: "asc" } }),
    prisma.company.groupBy({ by: ["state"], where: { isDemo: false, state: { not: null } }, _count: true }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const ufs = [...new Set(states.map((s) => (s.state ?? "").slice(0, 2).toUpperCase()).filter((x) => x.length === 2))].sort();
  const hasFilter = !!(f.q || f.cat || f.uf || f.contato || f.situacao || f.fonte);

  return (
    <>
      <PageHeader title="Empresas e contatos" subtitle={`${count.toLocaleString("pt-BR")} empresa(s) neste filtro. Só aparecem dados publicados nas fontes; nada é enviado a ninguém.`} actions={<a className="btn-secondary px-3 py-2 text-sm" href={`/api/admin/companies/export${filtersToQuery(f)}`}>Exportar CSV</a>} />
      <AdminNav />
      <form className="card mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6" method="get">
        <label className="col-span-2 block md:col-span-3 xl:col-span-2"><span className="label">Buscar</span><input name="q" defaultValue={f.q} className="input" placeholder="Nome, cidade ou telefone" /></label>
        <label className="block"><span className="label">Segmento</span><select name="cat" defaultValue={f.cat} className="input"><option value="">Todos</option>{cats.filter((c) => c.category).map((c) => <option key={c.category} value={c.category!}>{c.category} ({c._count})</option>)}</select></label>
        <label className="block"><span className="label">UF</span><select name="uf" defaultValue={f.uf} className="input"><option value="">Todas</option>{ufs.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
        <label className="block"><span className="label">Contato</span><select name="contato" defaultValue={f.contato} className="input">{CONTACT_FILTERS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
        <label className="block"><span className="label">Situação</span><select name="situacao" defaultValue={f.situacao} className="input">{SITUATIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
        <div className="col-span-2 flex items-end gap-2 md:col-span-3 xl:col-span-6"><button className="btn-primary px-4 py-2 text-sm">Filtrar</button>{hasFilter && <Link href="/admin/empresas" className="btn-ghost px-3 py-2 text-sm">Limpar filtros</Link>}</div>
      </form>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">Nenhuma empresa neste filtro. <Link href="/app/buscar" className="text-brand-300 hover:text-brand-200">Fazer uma busca</Link></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Contatos publicados</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Prévia</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((c) => (
                <tr key={c.id} className={`align-top hover:bg-white/[0.02] ${c.excludedAt ? "opacity-60" : ""}`}>
                  <td className="max-w-[320px] px-4 py-3"><Link href={`/app/leads/${c.id}`} className="font-medium text-white hover:text-brand-300">{c.name}</Link><p className="text-xs text-slate-500">{c.category ?? "Sem categoria"} · {[c.city, c.state?.slice(0, 2)].filter(Boolean).join("/") || "local não informado"}</p>{c.address && <p className="truncate text-xs text-slate-600">{c.address}</p>}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.phone || c.email || c.website ? (
                      <ul className="space-y-0.5 text-slate-300">
                        {c.phone && <li><a href={`tel:+${c.phone.replace(/\D/g, "")}`} className="hover:text-white">{formatBrPhone(c.phone)}</a></li>}
                        {c.email && <li className="break-all">{c.email}</li>}
                        {c.website && <li className="break-all"><a href={c.website} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:text-brand-200">{c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a></li>}
                      </ul>
                    ) : <span className="text-slate-500">Só nome e endereço na fonte</span>}
                  </td>
                  <td className="px-4 py-3">{c.excludedAt ? <span className="badge bg-white/10 text-slate-300">Excluída</span> : c.contactedAt ? <span className="badge bg-emerald-500/15 text-emerald-300">Contatada</span> : <span className="badge bg-brand-500/15 text-brand-300">Nova</span>}<p className="mt-1 text-[11px] text-slate-600">{c.source === "osm" ? "OpenStreetMap" : c.source === "google_places" ? "Google Maps" : c.source} · {c.createdAt.toLocaleDateString("pt-BR")}</p></td>
                  <td className="px-4 py-3 text-xs">{c.projects[0] ? <Link href={`/app/sites/${c.projects[0].id}`} className="text-brand-300 hover:text-brand-200">Abrir prévia</Link> : <Link href={`/app/leads/${c.id}#previa`} className="text-slate-400 hover:text-white">Criar prévia</Link>}</td>
                  <td className="px-4 py-3"><CompanyActions id={c.id} excluded={!!c.excludedAt} contacted={!!c.contactedAt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm text-slate-400" aria-label="Paginação">
          {page > 1 ? <Link className="btn-secondary px-3 py-1.5" href={`/admin/empresas${filtersToQuery(f, { p: String(page - 1) })}`}>← Anterior</Link> : <span />}
          <span>Página {page} de {pages}</span>
          {page < pages ? <Link className="btn-secondary px-3 py-1.5" href={`/admin/empresas${filtersToQuery(f, { p: String(page + 1) })}`}>Próxima →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
