"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/components/api";
import { Alert, Spinner, toast } from "@/components/ui";
import { Scene3D } from "@/components/studio/Scene3D";
import { TiltCard } from "@/components/studio/TiltCard";
import { DemoBadge, FactBadge, ScoreMeter } from "./FactBadge";
import type { LeadView, ProviderRow, SearchRow } from "./types";
import { CityPicker } from "./CityPicker";
import { formatBrPhone, validBrPhone } from "@/lib/whatsapp";

const coverageOf = (s: SearchRow) => (s.log ?? []).find((x) => x.step === "coverage")?.detail ?? null;

const LANGS = [
  { code: "pt-BR", label: "Português (BR)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

const STEPS = ["Descobrindo empresas na fonte", "Removendo duplicadas", "Verificando sites públicos (robots.txt respeitado)", "Confirmando WhatsApp comercial em fonte pública", "Registrando fontes e oportunidades"];

const OPP_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "no_site", label: "Sem site / só rede social" },
  { key: "site_issue", label: "Site com problemas" },
  { key: "inconsistent", label: "Dados inconsistentes" },
] as const;

function matchesOpp(l: LeadView, f: (typeof OPP_FILTERS)[number]["key"]) {
  const codes = l.opportunities.map((o) => o.code);
  if (f === "all") return true;
  if (f === "no_site") return codes.includes("no_website") || codes.includes("social_only");
  if (f === "site_issue") return codes.some((c) => ["site_unreachable", "no_https", "not_mobile", "outdated", "missing_seo"].includes(c));
  return codes.includes("inconsistent_phone");
}

const STAGES = [
  { key: "all", label: "Todos" },
  { key: "new", label: "Novos" },
  { key: "review", label: "Prévia em revisão" },
  { key: "published", label: "Prévia liberada" },
  { key: "contacted", label: "Contatados" },
] as const;
const STAGE_CLASS: Record<string, string> = { new: "bg-sky-500/15 text-sky-200", review: "bg-amber-500/15 text-amber-200", published: "bg-emerald-500/15 text-emerald-200", contacted: "bg-violet-500/15 text-violet-200" };
const STAGE_TXT: Record<string, string> = { new: "Novo", review: "Prévia em revisão", published: "Prévia liberada", contacted: "Contatado" };
/** Formas de contato publicadas que o lead tem (para mostrar e filtrar). */
export function contactsOf(l: LeadView): { key: "whatsapp" | "phone" | "email" | "site" | "instagram"; label: string }[] {
  const out: { key: "whatsapp" | "phone" | "email" | "site" | "instagram"; label: string }[] = [];
  if (l.waConfirmed || (l.isDemo && l.whatsapp)) out.push({ key: "whatsapp", label: "WhatsApp" });
  if (l.phone) out.push({ key: "phone", label: "Telefone" });
  if (l.email) out.push({ key: "email", label: "E-mail" });
  if (l.website) out.push({ key: "site", label: "Site" });
  if (l.socials.some((x) => x.network === "instagram")) out.push({ key: "instagram", label: "Instagram" });
  return out;
}

export function prettyWa(n: string | null) {
  if (!n) return "";
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${n}`;
}

export function LeadsStudio({ mode, initialLeads, initialSearches, providers, premium, nicheSuggestions, initialSearchId = "" }: { mode: "search" | "list"; initialLeads: LeadView[]; initialSearches: SearchRow[]; providers: ProviderRow[]; premium: boolean; nicheSuggestions: string[]; initialSearchId?: string }) {
  const google = providers.find((p) => p.id === "google_places")!;
  const defaultProvider: ProviderRow["id"] = !premium ? "demo" : google.configured ? "google_places" : "osm";
  const [leads, setLeads] = useState(initialLeads);
  const [searches, setSearches] = useState(initialSearches);
  const [provider, setProvider] = useState<ProviderRow["id"]>(defaultProvider);
  const [form, setForm] = useState<{ niche: string; location: string; language: string; count: number; uf: string; cityIbge?: number }>({ niche: "", location: "", language: "pt-BR", count: 10, uf: "" });
  const [coverage, setCoverage] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [opp, setOpp] = useState<(typeof OPP_FILTERS)[number]["key"]>("all");
  // Leads reais por padrão; os fictícios (demonstração) só aparecem quando escolhidos.
  const [dataset, setDataset] = useState<"all" | "real" | "demo">(() => (initialLeads.some((l) => !l.isDemo) ? "real" : "all"));
  const [view, setView] = useState<"active" | "excluded">("active");
  const [searchFilter, setSearchFilter] = useState<string>(initialSearchId);
  const [stage, setStage] = useState<(typeof STAGES)[number]["key"]>("all");
  const [contact, setContact] = useState<"all" | "whatsapp" | "phone" | "email" | "none">("all");
  const [lastSearch, setLastSearch] = useState<SearchRow | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const shown = useMemo(
    () =>
      leads.filter(
        (l) =>
          matchesContact(l, contact) &&
          (stage === "all" || l.stage === stage) &&
          (view === "active" ? !l.excluded : l.excluded) &&
          (dataset === "all" || (dataset === "demo" ? l.isDemo : !l.isDemo)) &&
          (!searchFilter || l.searchId === searchFilter) &&
          matchesOpp(l, opp) &&
          `${l.name} ${l.category ?? ""} ${l.address ?? ""} ${l.city ?? ""}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [leads, view, dataset, searchFilter, opp, q, stage, contact],
  );
  const lastResults = lastSearch ? leads.filter((l) => l.searchId === lastSearch.id) : [];
  const counts = { active: leads.filter((l) => !l.excluded).length, excluded: leads.filter((l) => l.excluded).length, demo: leads.filter((l) => l.isDemo).length };

  async function reload() {
    const [{ leads }, { searches }] = await Promise.all([api<{ leads: LeadView[] }>("/api/leads?view=all"), api<{ searches: SearchRow[] }>("/api/leads/searches")]);
    setLeads(leads);
    setSearches(searches);
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRunning(true);
    setStep(0);
    timer.current = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1600);
    try {
      const r = await api<{ search: SearchRow; createdIds: string[] }>("/api/leads/searches", {
        body: { ...form, uf: form.uf || undefined, provider, csv: provider === "import" ? csv : undefined, location: form.location || (provider === "import" ? "importação" : form.location), niche: form.niche || (provider === "import" ? "importação" : form.niche) },
      });
      await reload();
      setSearchFilter(r.search.id);
      setFresh(new Set(r.createdIds));
      setView("active");
      setDataset("all");
      toast(`${r.createdIds.length} novos leads · ${r.search.duplicates} duplicados ignorados`);
      setCoverage(coverageOf(r.search));
      setLastSearch(r.search);
      if (!r.createdIds.length && r.search.found) {
        setError("Todas as empresas encontradas já estavam na sua lista. Tente outro termo ou uma cidade vizinha.");
      }
    } catch (err) {
      setError((err as Error).message);
      await reload().catch(() => {});
    } finally {
      if (timer.current) clearInterval(timer.current);
      setRunning(false);
    }
  }

  async function setExcluded(l: LeadView, excluded: boolean) {
    const { lead } = await api<{ lead: LeadView }>(`/api/leads/${l.id}`, { method: "PATCH", body: { excluded } });
    setLeads((xs) => xs.map((x) => (x.id === l.id ? lead : x)));
    toast(excluded ? "Lead excluído da lista (pode ser restaurado)" : "Lead restaurado");
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 500_000) return setError("Arquivo grande demais (máx. 500 KB).");
    setCsv(await f.text());
  }

  const canRun = provider === "import" ? csv.trim().length > 0 : form.niche.trim().length >= 2 && form.location.trim().length >= 2;
  const realBlocked = !google.configured || !premium;

  return (
    <div className="space-y-6">
      {/* ---------- Configuração da busca ---------- */}
      {mode === "search" && <section className="card relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black_10%,transparent_65%)]" />
        <div className="relative grid gap-0 xl:grid-cols-[1.15fr_1fr]">
          <form onSubmit={start} className="space-y-5 p-5 sm:p-7">
            <div role="tablist" aria-label="Fonte dos leads" className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1">
              {[
                { id: "google_places" as const, label: "Google Maps", sub: google.configured ? "busca real" : "requer chave" },
                { id: "osm" as const, label: "OpenStreetMap", sub: "busca real · sem chave" },
                { id: "import" as const, label: "Importar", sub: "CSV seu" },
                { id: "demo" as const, label: "Demonstração", sub: "dados fictícios" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={provider === t.id}
                  onClick={() => setProvider(t.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-left text-sm transition ${provider === t.id ? "bg-brand-500/20 text-white ring-1 ring-brand-500/40" : "text-slate-400 hover:text-white"}`}
                >
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-[11px] text-slate-500">{t.sub}</span>
                </button>
              ))}
            </div>

            {provider === "google_places" && realBlocked && (
              <Alert kind="warn">
                {!google.configured ? <>A busca real não está configurada. {google.setupHint} Enquanto isso, use o modo demonstração (dados fictícios, identificados) ou importe um CSV.</> : <>A busca real usa a cota do plano Premium. <Link href="/app/assinatura" className="underline">Ver assinatura</Link> ou teste com o modo demonstração.</>}
              </Alert>
            )}
            {provider === "osm" && (premium ? <Alert kind="info">Busca real em dados abertos do OpenStreetMap (© colaboradores do OSM, licença ODbL). Telefones, sites, redes e horários aparecem quando a comunidade os cadastrou; a cobertura varia por cidade. Limite de 1 consulta por segundo.</Alert> : <Alert kind="warn">A busca real exige a conta proprietária com acesso ativo.</Alert>)}
            {coverage && <Alert kind={/^Nenhum|não retornou|Atenção/.test(coverage) ? "warn" : "info"}>{coverage}</Alert>}
            {provider === "demo" && <Alert kind="info">Modo demonstração: as empresas geradas são <b>fictícias</b>, ficam marcadas como DEMO e nunca se misturam com leads reais na deduplicação.</Alert>}

            {provider !== "import" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-1">
                  <span className="label">Nicho</span>
                  <input className="input" list="niches" required minLength={2} maxLength={80} placeholder="ex.: barbearia, clínica odontológica" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
                  <datalist id="niches">{nicheSuggestions.map((n) => <option key={n} value={n} />)}</datalist>
                </label>
                <CityPicker value={form.location} uf={form.uf} cityIbge={form.cityIbge} onChange={(v) => setForm({ ...form, ...v })} />
                <label className="block">
                  <span className="label">Idioma</span>
                  <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                    {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Quantidade de empresas · {form.count}</span>
                  <input type="range" min={1} max={30} value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} className="mt-3 w-full accent-[var(--color-signal)]" />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Cole ou envie um CSV com cabeçalhos como <code className="text-slate-300">nome, categoria, endereco, cidade, telefone, email, site, fonte</code>. Use apenas dados comerciais que você tem direito de usar.</p>
                <textarea className="input min-h-32 font-mono text-xs" placeholder={"nome,categoria,cidade,telefone,site\nPadaria Central,Padaria,Recife,(81) 3333-0000,"} value={csv} onChange={(e) => setCsv(e.target.value)} maxLength={500_000} />
                <div className="flex flex-wrap items-center gap-3">
                  <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-slate-200" />
                  <select className="input max-w-44" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} aria-label="Idioma">
                    {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {error && <Alert>{error}</Alert>}
            {running && <div className="progress-line" role="progressbar" aria-label="Buscando leads" />}
            <div className="flex flex-wrap items-center gap-3">
              <button className={`btn-primary ${running ? "btn-busy" : ""}`} disabled={running || !canRun || (provider === "google_places" && realBlocked) || (provider === "osm" && !premium)}>
                {running ? <><Spinner /> Buscando e verificando WhatsApp…</> : provider === "import" ? "Importar e analisar" : "Iniciar busca"}
              </button>
              <p className="text-xs text-slate-500">{provider === "google_places" ? "Usa 1 pesquisa da cota mensal (cobrada pelo Google)." : provider === "osm" ? "Gratuita; respeita o limite de uso do OpenStreetMap." : "Não consome a cota."} Nenhuma empresa é contatada.</p>
            </div>
          </form>

          <div className="relative border-t border-white/5 p-5 xl:border-l xl:border-t-0">
            {running ? (
              <div className="flex h-full flex-col justify-center gap-4 p-4" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pipeline em execução</p>
                {STEPS.map((s, i) => (
                  <div key={s} className={`pipe-step ${i < step ? "is-done" : i === step ? "is-active" : ""}`}>
                    <span className="pipe-dot" /> <span className="text-sm">{s}</span>
                  </div>
                ))}
                <p className="text-xs text-slate-600">Etapas ilustrativas: o servidor executa tudo numa única requisição.</p>
              </div>
            ) : (
              <Scene3D compact />
            )}
          </div>
        </div>
      </section>}

      {mode === "search" && <SearchResults lastSearch={lastSearch} results={lastResults} searches={searches} />}

      {mode === "list" && <>
      {/* ---------- Histórico ---------- */}
      {searches.length > 0 && (
        <section aria-label="Buscas recentes" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button onClick={() => setSearchFilter("")} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${!searchFilter ? "border-brand-500/50 bg-brand-500/10 text-white" : "border-white/10 text-slate-400"}`}>
            <span className="block font-semibold">Todas as buscas</span>
            <span className="text-slate-500">{counts.active} leads ativos</span>
          </button>
          {searches.map((s) => (
            <button key={s.id} onClick={() => setSearchFilter(s.id === searchFilter ? "" : s.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${s.id === searchFilter ? "border-brand-500/50 bg-brand-500/10 text-white" : "border-white/10 text-slate-400 hover:border-white/20"}`}>
              <span className="flex items-center gap-1.5 font-semibold">
                {s.niche} · {s.location}
                {s.isDemo && <span className="rounded bg-amber-400/20 px-1 text-[10px] text-amber-200">DEMO</span>}
                {s.status === "FAILED" && <span className="rounded bg-red-500/20 px-1 text-[10px] text-red-200">falhou</span>}
                {s.status === "PARTIAL" && <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-200">parcial</span>}
              </span>
              <span className="text-slate-500" title={coverageOf(s) ?? undefined}>{new Date(s.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {s.found === 0 && s.status !== "FAILED" && !s.isDemo ? "0 resultados na fonte" : `${s.created} novos · ${s.duplicates} dupl.`}</span>
            </button>
          ))}
        </section>
      )}

      {/* ---------- Filtros ---------- */}
      <section className="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Status">
          {STAGES.map((f) => {
            const n = f.key === "all" ? counts.active : leads.filter((l) => !l.excluded && l.stage === f.key).length;
            return <button key={f.key} role="tab" aria-selected={stage === f.key} onClick={() => setStage(f.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${stage === f.key ? "bg-[var(--color-signal)] text-ink-950" : "border border-white/10 text-slate-300 hover:border-white/25"}`}>{f.label} <span className="opacity-70">{n}</span></button>;
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="input w-52 py-2" placeholder="Buscar por nome, cidade…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar leads" />
          <select className="input w-auto py-2" value={opp} onChange={(e) => setOpp(e.target.value as typeof opp)} aria-label="Oportunidade">
            {OPP_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.key === "all" ? "Todas as oportunidades" : f.label}</option>)}
          </select>
          <select className="input w-auto py-2" value={contact} onChange={(e) => setContact(e.target.value as typeof contact)} aria-label="Forma de contato">
            <option value="all">Qualquer contato</option>
            <option value="whatsapp">Com WhatsApp confirmado</option>
            <option value="phone">Com telefone (com ou sem WhatsApp)</option>
            <option value="email">Com e-mail</option>
            <option value="none">Sem contato publicado</option>
          </select>
          <select className="input w-auto py-2" value={dataset} onChange={(e) => setDataset(e.target.value as typeof dataset)} aria-label="Conjunto de dados">
            <option value="all">Reais + demo</option>
            <option value="real">Somente reais</option>
            <option value="demo">Somente demo ({counts.demo})</option>
          </select>
          <select className="input w-auto py-2" value={view} onChange={(e) => setView(e.target.value as typeof view)} aria-label="Situação">
            <option value="active">Ativos ({counts.active})</option>
            <option value="excluded">Excluídos ({counts.excluded})</option>
          </select>
        </div>
      </section>

      {/* ---------- Resultados ---------- */}
      {!counts.active && view === "active" ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold text-white">Nenhum lead ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">Comece na aba <Link href="/app/buscar" className="text-brand-300 underline">Buscar empresas</Link>: escolha o ramo, o estado e a cidade.</p>
        </div>
      ) : !shown.length ? (
        <div className="card p-8 text-center text-sm text-slate-400">Nenhum lead com esses filtros. <button className="text-brand-300 underline" onClick={() => { setOpp("all"); setQ(""); setDataset("all"); setSearchFilter(""); setStage("all"); setContact("all"); }}>Limpar filtros</button></div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((l, i) => (
            <li key={l.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <TiltCard as="article" className={`card flex h-full flex-col p-5 ${l.isDemo ? "ring-1 ring-amber-400/20" : ""} ${fresh.has(l.id) ? "lead-new" : ""}`}>
                <div className="lift flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">{l.name}</h3>
                    <p className="truncate text-xs text-slate-500">{l.category ?? "Categoria não informada"}{l.city ? ` · ${l.city}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`badge ${STAGE_CLASS[l.stage]}`}>{STAGE_TXT[l.stage]}</span>
                    {l.isDemo && <DemoBadge />}
                    <ScoreMeter score={l.opportunityScore} />
                  </div>
                </div>
                {l.opportunities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {l.opportunities.slice(0, 3).map((o) => (
                      <span key={o.code} className={`badge ${o.severity === "high" ? "bg-[var(--color-signal)]/15 text-[var(--color-signal)]" : "bg-white/5 text-slate-300"}`} title={o.detail}>
                        {o.label}{o.basis === "inferred" ? " *" : ""}
                      </span>
                    ))}
                  </div>
                )}
                <ContactBox l={l} />
                <dl className="mt-3 space-y-1.5 text-sm">
                  {([
                    ["Endereço", l.address, l.facts.address],
                    ["Telefone", l.phone, l.facts.phone],
                    ["E-mail", l.email, l.facts.email],
                    ["Site", l.website, l.facts.website],
                  ] as const).map(([k, v, f]) => (
                    <div key={k} className="flex items-center gap-2">
                      <dt className="w-16 shrink-0 text-xs text-slate-500">{k}</dt>
                      <dd className="min-w-0 flex-1 truncate text-slate-300">{v ?? <span className="text-slate-600">—</span>}</dd>
                      {l.facts && Object.keys(l.facts).length > 0 && <FactBadge fact={f} compact />}
                    </div>
                  ))}
                  {l.socials.length > 0 && <div className="flex gap-2"><dt className="w-16 shrink-0 text-xs text-slate-500">Social</dt><dd className="truncate text-slate-300">{l.socials.map((s) => s.network).join(", ")}</dd></div>}
                </dl>
                <p className="mt-3 text-[11px] text-slate-500">Fonte: {l.source === "google_places" ? "Google Maps" : l.source === "osm" ? "OpenStreetMap" : l.source === "demo" ? "Demonstração" : "Importação"} · coletado em {new Date(l.fetchedAt).toLocaleDateString("pt-BR")}{l.reviewedAt ? " · revisado" : ""}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/app/leads/${l.id}`} className="btn-primary px-3 py-2 text-xs">Abrir perfil</Link>
                  {l.projects[0] ? <Link href={`/app/sites/${l.projects[0].id}`} className="btn-secondary px-3 py-2 text-xs">Prévia</Link> : <Link href={`/app/leads/${l.id}#previa`} className="btn-secondary px-3 py-2 text-xs">Criar prévia</Link>}
                  <Link href={`/app/abordagens#lead-${l.id}`} className="btn-secondary px-3 py-2 text-xs">Abordagem</Link>
                  {l.excluded ? (
                    <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setExcluded(l, false)}>Restaurar</button>
                  ) : (
                    <button className="btn-ghost px-3 py-2 text-xs text-slate-400 hover:text-red-300" onClick={() => setExcluded(l, true)}>Excluir</button>
                  )}
                </div>
              </TiltCard>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-600">* Inferência: dedução que precisa ser conferida (ex.: a fonte não informa site). Passe o mouse sobre os selos para ver fonte e confiança.</p>
      </>}
    </div>
  );
}

function ContactBox({ l }: { l: LeadView }) {
  const cs = contactsOf(l);
  if (l.waConfirmed || (l.isDemo && l.whatsapp)) {
    return (
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-200">{l.isDemo ? "WhatsApp fictício (demonstração)" : prettyWa(l.whatsapp)}</p>
          <p className="truncate text-[11px] text-emerald-200/60">{l.isDemo ? "Lead de demonstração" : `WhatsApp confirmado · fonte: ${l.facts.whatsapp?.source ?? "—"}`}</p>
          {/Atenção: o DDD/.test(l.facts.whatsapp?.note ?? "") && <p className="text-[11px] text-amber-200">DDD diferente da cidade: confira</p>}
        </div>
        {!l.isDemo && l.facts.whatsapp?.sourceUrl && <a href={l.facts.whatsapp.sourceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-emerald-200/80 underline">ver fonte</a>}
      </div>
    );
  }
  const phoneOk = validBrPhone(l.phone);
  const others = cs.filter((c) => c.key !== "phone");
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      {l.phone ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{formatBrPhone(l.phone)}</p>
            <p className="truncate text-[11px] text-slate-400">Telefone{phoneOk ? "" : " (número incompleto na fonte: confira)"} · WhatsApp não informado</p>
          </div>
          {phoneOk && <a href={`tel:+${phoneOk}`} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">Ligar</a>}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">{cs.length ? "Sem telefone publicado. Outros contatos:" : "Nenhum contato publicado na fonte: só nome e endereço."}</p>
      )}
      {others.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{others.map((c) => <span key={c.key} className="badge bg-white/5 text-slate-200">{c.label}</span>)}</div>}
    </div>
  );
}

function ContactLine({ l }: { l: LeadView }) {
  if (l.waConfirmed || (l.isDemo && l.whatsapp)) return <span className="text-emerald-300">{l.isDemo ? "WhatsApp fictício" : `WhatsApp ${prettyWa(l.whatsapp)}`}</span>;
  if (l.phone) return <span className="text-slate-300">Telefone {formatBrPhone(l.phone)}</span>;
  const cs = contactsOf(l);
  return <span className="text-slate-400">{cs.length ? cs.map((c) => c.label).join(" · ") : "sem contato publicado"}</span>;
}

function matchesContact(l: LeadView, f: "all" | "whatsapp" | "phone" | "email" | "none") {
  if (f === "all") return true;
  const keys = contactsOf(l).map((c) => c.key);
  return f === "none" ? !keys.length : keys.includes(f);
}

/** Aba Buscar: resultado da última busca e buscas recentes. */
function SearchResults({ lastSearch, results, searches }: { lastSearch: SearchRow | null; results: LeadView[]; searches: SearchRow[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section className="card p-5 sm:p-6" aria-live="polite">
        <h2 className="font-semibold text-white">Resultado da busca</h2>
        {!lastSearch ? (
          <p className="mt-2 text-sm text-slate-400">Escolha o ramo, o estado e a cidade e clique em <b>Iniciar busca</b>. Entram todas as empresas reais encontradas, com ou sem WhatsApp. O telefone aparece como contato; o WhatsApp só é indicado quando a fonte informa.</p>
        ) : !results.length ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma empresa nova nesta busca. Veja o resumo acima: tente outro termo, uma cidade vizinha ou a fonte Google Maps (requer chave).</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {results.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{l.name}</p>
                  <p className="truncate text-xs text-slate-500">{l.category ?? "—"}{l.city ? ` · ${l.city}` : ""} · <ContactLine l={l} /></p>
                </div>
                <Link href={`/app/leads/${l.id}`} className="btn-secondary px-3 py-1.5 text-xs">Abrir</Link>
              </li>
            ))}
          </ul>
        )}
        {lastSearch && results.length > 0 && <Link href={`/app/leads?search=${lastSearch.id}`} className="btn-primary mt-4">Ver na aba Leads encontrados</Link>}
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold text-white">Buscas recentes</h2>
        {!searches.length ? <p className="mt-2 text-sm text-slate-400">Nenhuma busca ainda.</p> : (
          <ul className="mt-3 space-y-2">
            {searches.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link href={`/app/leads?search=${s.id}`} className="block rounded-xl border border-white/10 px-3 py-2 text-xs hover:border-white/25">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">{s.niche} · {s.location}{s.isDemo && <span className="rounded bg-amber-400/20 px-1 text-[10px] text-amber-200">DEMO</span>}{s.status === "FAILED" && <span className="rounded bg-red-500/20 px-1 text-[10px] text-red-200">falhou</span>}</span>
                  <span className="text-slate-500">{new Date(s.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {s.created} empresa(s) nova(s)</span>
                  {coverageOf(s) && <span className="mt-1 block text-slate-500">{coverageOf(s)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
