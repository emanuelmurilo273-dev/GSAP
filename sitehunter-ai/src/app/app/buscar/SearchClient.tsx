"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner, toast } from "@/components/ui";
import { GenerateSiteDialog, type SegmentOption } from "@/components/app/GenerateSite";

type Result = {
  sourceId: string; name: string; category: string | null; address: string | null; neighborhood: string | null; city: string | null; state: string | null;
  phone: string | null; website: string | null; websiteKind: "none" | "social" | "site"; mapsUrl: string | null; lat: number | null; lng: number | null; savedId: string | null;
};

export function SearchClient({ segments, ufs }: { segments: SegmentOption[]; ufs: [string, string][] }) {
  const [form, setForm] = useState({ state: "SP", city: "", neighborhood: "", segment: segments[0]!.key, name: "" });
  const [cities, setCities] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [onlyNoSite, setOnlyNoSite] = useState(true);
  const [includeSocial, setIncludeSocial] = useState(true);
  const [gen, setGen] = useState<{ id: string; name: string } | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    fetch(`/api/geo/cities?uf=${form.state}`).then((r) => r.json()).then((d) => setCities(d.cities ?? [])).catch(() => setCities([]));
  }, [form.state]);

  async function search(pageToken?: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ results: Result[]; nextPageToken: string | null; usage: { searches: { used: number; limit: number } } }>("/api/places/search", { body: { ...form, country: "BR", pageToken } });
      setResults((prev) => (pageToken ? [...prev, ...r.results.filter((x) => !prev.some((p) => p.sourceId === x.sourceId))] : r.results));
      setNext(r.nextPageToken);
      setUsage(r.usage.searches);
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save(r: Result): Promise<string | null> {
    if (r.savedId) return r.savedId;
    try {
      const { company } = await api<{ company: { id: string } }>("/api/companies", { body: { ...r, websiteKind: undefined, savedId: undefined } });
      setResults((prev) => prev.map((p) => (p.sourceId === r.sourceId ? { ...p, savedId: company.id } : p)));
      toast("Empresa salva na sua lista");
      return company.id;
    } catch (e) {
      toast((e as Error).message);
      return null;
    }
  }

  const shown = useMemo(() => results.filter((r) => !onlyNoSite || r.websiteKind === "none" || (includeSocial && r.websiteKind === "social")), [results, onlyNoSite, includeSocial]);

  return (
    <div className="space-y-5">
      <form className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <Field label="País"><select className="input" disabled><option>Brasil</option></select></Field>
        <Field label="Estado">
          <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, city: "" })}>
            {ufs.map(([uf, n]) => <option key={uf} value={uf}>{n}</option>)}
          </select>
        </Field>
        <Field label="Cidade">
          <input className="input" list="cities" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex.: Campinas" />
          <datalist id="cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Bairro (opcional)"><input className="input" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></Field>
        <Field label="Segmento">
          <select className="input" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
            {segments.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Nome (opcional)"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center lg:col-span-6">
          <button className="btn-primary" disabled={loading}>{loading && !next ? <Spinner /> : null}Buscar empresas</button>
          <span className="text-xs text-slate-500">Cada busca (e cada “carregar mais”) usa 1 pesquisa do seu limite mensal{usage ? ` · ${usage.used}/${usage.limit} usadas` : ""}.</span>
        </div>
      </form>

      {error && <Alert>{error}</Alert>}

      {searched && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" className="accent-brand-500" checked={onlyNoSite} onChange={(e) => setOnlyNoSite(e.target.checked)} /> Possivelmente sem site</label>
            {onlyNoSite && <label className="flex items-center gap-2 text-slate-400"><input type="checkbox" className="accent-brand-500" checked={includeSocial} onChange={(e) => setIncludeSocial(e.target.checked)} /> incluir quem informa só rede social</label>}
          </div>
          <span className="text-sm text-slate-500">{shown.length} de {results.length} resultados</span>
        </div>
      )}

      {searched && onlyNoSite && (
        <Alert kind="info">“Possivelmente sem site” significa apenas que a fonte de dados não informa um site para a empresa. Ela pode ter um site que não foi cadastrado — confira antes de entrar em contato.</Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((r, i) => (
          <article key={r.sourceId} className="card card-hover flex flex-col p-5 animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-white">{r.name}</h3>
              {r.websiteKind === "none" && <span className="badge shrink-0 bg-brand-500/15 text-brand-300">Possivelmente sem site</span>}
              {r.websiteKind === "social" && <span className="badge shrink-0 bg-violet-500/15 text-violet-300">Só rede social</span>}
              {r.websiteKind === "site" && <span className="badge shrink-0 bg-slate-500/15 text-slate-300">Site informado</span>}
            </div>
            {r.category && <p className="mt-0.5 text-xs text-slate-500">{r.category}</p>}
            <dl className="mt-3 flex-1 space-y-1.5 text-sm">
              {r.address && <div className="text-slate-300"><dt className="sr-only">Endereço</dt><dd>📍 {r.address}</dd></div>}
              <div className="text-slate-300"><dt className="sr-only">Telefone</dt><dd>📞 {r.phone ?? <span className="text-slate-500">Telefone não informado pela fonte</span>}</dd></div>
              {r.website && <div className="truncate"><dt className="sr-only">Site</dt><dd>🌐 <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">{r.website.replace(/^https?:\/\//, "")}</a></dd></div>}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.mapsUrl && <a className="btn-secondary px-3 py-2 text-xs" href={r.mapsUrl} target="_blank" rel="noopener noreferrer">Abrir no mapa</a>}
              <button className="btn-secondary px-3 py-2 text-xs" onClick={() => save(r)} disabled={!!r.savedId}>{r.savedId ? "Salva ✓" : "Salvar empresa"}</button>
              <button className="btn-primary px-3 py-2 text-xs" onClick={async () => { const id = await save(r); if (id) setGen({ id, name: r.name }); }}>Criar site com IA</button>
            </div>
          </article>
        ))}
      </div>

      {searched && results.length === 0 && !loading && <p className="py-10 text-center text-slate-500">Nenhuma empresa encontrada. Tente outro bairro, cidade ou segmento.</p>}
      {next && (
        <div className="text-center">
          <button className="btn-secondary" onClick={() => search(next)} disabled={loading}>{loading && <Spinner />}Carregar mais resultados</button>
        </div>
      )}
      {searched && <p className="text-right text-xs text-slate-600">Dados de empresas: Google</p>}
      {gen && <GenerateSiteDialog companyId={gen.id} companyName={gen.name} segments={segments} defaultSegment={form.segment} onClose={() => setGen(null)} />}
    </div>
  );
}
