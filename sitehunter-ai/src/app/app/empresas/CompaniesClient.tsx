"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { toast } from "@/components/ui";
import { GenerateSiteDialog, type SegmentOption } from "@/components/app/GenerateSite";

type C = { id: string; name: string; category: string | null; address: string | null; phone: string | null; website: string | null; mapsUrl: string | null; notes: string | null; fetchedAt: string; researchedAt?: string | null; projectId: string | null };

export function CompaniesClient({ companies: initial, segments, premium }: { companies: C[]; segments: SegmentOption[]; premium: boolean }) {
  const [companies, setCompanies] = useState(initial);
  const [filter, setFilter] = useState<"all" | "nosite">("all");
  const [q, setQ] = useState("");
  const [gen, setGen] = useState<C | null>(null);
  const shown = companies.filter((c) => (filter === "all" || !c.website) && c.name.toLowerCase().includes(q.toLowerCase()));

  async function remove(c: C) {
    if (!confirm(`Remover ${c.name} da sua lista?`)) return;
    await api(`/api/companies/${c.id}`, { method: "DELETE" });
    setCompanies((x) => x.filter((y) => y.id !== c.id));
  }
  async function refresh(c: C) {
    try {
      const { company } = await api<{ company: C & { fetchedAt: string } }>(`/api/companies/${c.id}/refresh`, { method: "POST" });
      setCompanies((x) => x.map((y) => (y.id === c.id ? { ...y, ...company } : y)));
      toast("Dados atualizados pela fonte");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function saveNotes(c: C, notes: string) {
    await api(`/api/companies/${c.id}`, { method: "PATCH", body: { notes } });
    toast("Anotação salva");
  }

  if (!companies.length)
    return (
      <div className="card p-10 text-center">
        <p className="text-slate-400">Você ainda não salvou nenhuma empresa.</p>
        <Link href="/app/buscar" className="btn-primary mt-5">Buscar empresas</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input className="input sm:max-w-xs" placeholder="Filtrar por nome..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1 rounded-xl border border-white/10 p-1">
          {(["all", "nosite"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm ${filter === f ? "bg-brand-500/20 text-white" : "text-slate-400"}`}>{f === "all" ? "Todas" : "Possivelmente sem site"}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((c) => (
          <article key={c.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{c.name}</h3>
                <p className="text-xs text-slate-500">{c.category ?? "Sem categoria"} · dados de {new Date(c.fetchedAt).toLocaleDateString("pt-BR")}</p>
              </div>
              {!c.website ? <span className="badge bg-brand-500/15 text-brand-300">Possivelmente sem site</span> : <a href={c.website} target="_blank" rel="noopener noreferrer" className="badge bg-slate-500/15 text-slate-300">Site informado ↗</a>}
            </div>
            <p className="mt-3 text-sm text-slate-300">📍 {c.address ?? "—"}</p>
            <p className="text-sm text-slate-300">📞 {c.phone ?? <span className="text-slate-500">não informado</span>}</p>
            <textarea className="input mt-3 min-h-16 text-xs" placeholder="Anotações (ex.: verifiquei, não tem site; falar com o dono à tarde)" defaultValue={c.notes ?? ""} onBlur={(e) => e.target.value !== (c.notes ?? "") && saveNotes(c, e.target.value)} maxLength={2000} />
            <div className="mt-3 flex flex-wrap gap-2">
              {c.projectId ? <Link href={`/app/sites/${c.projectId}`} className="btn-secondary px-3 py-2 text-xs">Abrir site</Link> : null}
              <button className="btn-primary px-3 py-2 text-xs" disabled={!premium} onClick={() => setGen(c)}>{c.projectId ? "Gerar nova versão" : "Criar site com IA"}</button>
              {c.mapsUrl && <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3 py-2 text-xs">Mapa</a>}
              <button className="btn-ghost px-3 py-2 text-xs" disabled={!premium} onClick={() => refresh(c)}>Atualizar dados</button>
              <button className="btn-ghost px-3 py-2 text-xs text-red-300" onClick={() => remove(c)}>Remover</button>
            </div>
          </article>
        ))}
      </div>
      {gen && <GenerateSiteDialog companyId={gen.id} companyName={gen.name} segments={segments} researchedAt={gen.researchedAt} onClose={() => setGen(null)} />}
    </div>
  );
}
