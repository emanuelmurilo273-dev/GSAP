"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner, toast } from "@/components/ui";
import { GenerateSiteDialog, type SegmentOption } from "@/components/app/GenerateSite";
import { MapLegend, MapView, type MapPoint } from "@/components/maps/MapView";
import { useGeolocation } from "@/components/maps/useGeolocation";

type Result = {
  sourceId: string; name: string; category: string | null; address: string | null; neighborhood: string | null; city: string | null; state: string | null;
  phone: string | null; website: string | null; websiteKind: "none" | "social" | "site"; mapsUrl: string | null; lat: number | null; lng: number | null; hours?: string[]; savedId: string | null;
};
type RouteInfo = { placeId: string; mode: Mode; distanceText: string; durationText: string; polyline: string };
type Mode = "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT";
const MODES: [Mode, string][] = [["DRIVE", "Carro"], ["WALK", "A pé"], ["BICYCLE", "Bicicleta"], ["TRANSIT", "Transporte público"]];
const RADII = [["2000", "2 km"], ["5000", "5 km"], ["10000", "10 km"], ["25000", "25 km"]];

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
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);
  // Ponto de referência: endereço pesquisado ou localização do usuário
  const [origin, setOrigin] = useState<MapPoint | null>(null);
  const [radius, setRadius] = useState("5000");
  const [addr, setAddr] = useState("");
  const [addrState, setAddrState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const geo = useGeolocation();
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeState, setRouteState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [mode, setMode] = useState<Mode>("DRIVE");
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/geo/cities?uf=${form.state}`).then((r) => r.json()).then((d) => setCities(d.cities ?? [])).catch(() => setCities([]));
  }, [form.state]);

  useEffect(() => {
    if (geo.state.status === "ok") {
      setOrigin({ lat: geo.state.lat, lng: geo.state.lng, label: "Você está aqui", accuracy: geo.state.accuracy });
      setView("map");
      toast("Localização encontrada");
    }
  }, [geo.state]);

  async function search(pageToken?: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ results: Result[]; nextPageToken: string | null; usage: { searches: { used: number; limit: number } } }>("/api/places/search", {
        body: { ...form, country: "BR", pageToken, near: origin ? { lat: origin.lat, lng: origin.lng, radiusMeters: Number(radius) } : undefined },
      });
      setResults((prev) => (pageToken ? [...prev, ...r.results.filter((x) => !prev.some((p) => p.sourceId === x.sourceId))] : r.results));
      setNext(r.nextPageToken);
      setUsage(r.usage.searches);
      setSearched(true);
      if (!pageToken) {
        setSelected(null);
        setRoute(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function findAddress(e: React.FormEvent) {
    e.preventDefault();
    if (addr.trim().length < 3) return setAddrState({ loading: false, error: "Digite um endereço, bairro ou CEP." });
    setAddrState({ loading: true, error: null });
    try {
      const r = await api<{ results: { formattedAddress: string; lat: number; lng: number }[] }>("/api/maps/geocode", { body: { address: addr.trim() } });
      const first = r.results[0]!;
      setOrigin({ lat: first.lat, lng: first.lng, label: first.formattedAddress });
      setAddr(first.formattedAddress);
      setAddrState({ loading: false, error: null });
      setView("map");
    } catch (err) {
      setAddrState({ loading: false, error: (err as Error).message });
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

  async function traceRoute(r: Result, m: Mode = mode) {
    if (!origin || r.lat == null || r.lng == null) return;
    setMode(m);
    setRouteState({ loading: true, error: null });
    try {
      const { route: rt } = await api<{ route: { distanceText: string; durationText: string; polyline: string } }>("/api/maps/route", {
        body: { origin: { lat: origin.lat, lng: origin.lng }, destination: { lat: r.lat, lng: r.lng }, mode: m },
      });
      setRoute({ placeId: r.sourceId, mode: m, ...rt });
      setRouteState({ loading: false, error: null });
    } catch (e) {
      setRoute(null);
      setRouteState({ loading: false, error: (e as Error).message });
    }
  }

  function select(id: string) {
    setSelected(id);
    if (route && route.placeId !== id) setRoute(null);
    setRouteState({ loading: false, error: null });
    requestAnimationFrame(() => detailsRef.current?.focus());
  }

  const shown = useMemo(() => results.filter((r) => !onlyNoSite || r.websiteKind === "none" || (includeSocial && r.websiteKind === "social")), [results, onlyNoSite, includeSocial]);
  const mapPlaces = useMemo(
    () => shown.filter((r) => r.lat != null && r.lng != null).map((r) => ({ id: r.sourceId, name: r.name, lat: r.lat!, lng: r.lng!, kind: r.websiteKind, saved: !!r.savedId })),
    [shown],
  );
  const sel = shown.find((r) => r.sourceId === selected) ?? null;

  const card = (r: Result, i: number) => (
    <article key={r.sourceId} className={`card card-hover flex flex-col p-5 animate-fade-up ${selected === r.sourceId ? "ring-2 ring-brand-500/60" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-white">{r.name}</h3>
        <KindBadge kind={r.websiteKind} />
      </div>
      {r.category && <p className="mt-0.5 text-xs text-slate-500">{r.category}</p>}
      <dl className="mt-3 flex-1 space-y-1.5 text-sm">
        {r.address && <div className="text-slate-300"><dt className="sr-only">Endereço</dt><dd>📍 {r.address}</dd></div>}
        <div className="text-slate-300"><dt className="sr-only">Telefone</dt><dd>📞 {r.phone ?? <span className="text-slate-500">Telefone não informado pela fonte</span>}</dd></div>
        {r.website && <div className="truncate"><dt className="sr-only">Site</dt><dd>🌐 <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">{r.website.replace(/^https?:\/\//, "")}</a></dd></div>}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {r.lat != null && <button className="btn-secondary px-3 py-2 text-xs" onClick={() => { setView("map"); select(r.sourceId); }}>Ver no mapa</button>}
        <button className="btn-secondary px-3 py-2 text-xs" onClick={() => save(r)} disabled={!!r.savedId}>{r.savedId ? "Salva ✓" : "Salvar empresa"}</button>
        <button className="btn-primary px-3 py-2 text-xs" onClick={async () => { const id = await save(r); if (id) setGen({ id, name: r.name }); }}>Criar site com IA</button>
      </div>
    </article>
  );

  return (
    <div className="space-y-5">
      {/* Ponto de referência */}
      <section className="card grid gap-3 p-5 lg:grid-cols-[1fr_auto]" aria-labelledby="ref-title">
        <div>
          <h2 id="ref-title" className="text-sm font-semibold text-white">Ponto de referência (opcional)</h2>
          <p className="mt-0.5 text-xs text-slate-500">Pesquise um endereço ou use sua localização para priorizar empresas próximas e calcular rotas.</p>
          <form onSubmit={findAddress} className="mt-3 flex flex-col gap-2 sm:flex-row" noValidate>
            <label htmlFor="addr" className="sr-only">Endereço, bairro ou CEP</label>
            <input id="addr" className="input" placeholder="Ex.: Av. Paulista, 1000, São Paulo" value={addr} onChange={(e) => setAddr(e.target.value)} aria-invalid={!!addrState.error} aria-describedby={addrState.error ? "addr-err" : undefined} autoComplete="street-address" />
            <button className="btn-secondary shrink-0" disabled={addrState.loading}>{addrState.loading && <Spinner />}Pesquisar endereço</button>
          </form>
          {addrState.error && <p id="addr-err" className="mt-1.5 text-xs text-red-300" role="alert">{addrState.error}</p>}
        </div>
        <div className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
          <button type="button" className="btn-secondary" onClick={geo.ask} disabled={geo.state.status === "locating"}>
            {geo.state.status === "locating" ? <><Spinner /> Localizando…</> : "📍 Usar minha localização"}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-400">Raio
            <select className="input py-1.5 text-xs" value={radius} onChange={(e) => setRadius(e.target.value)} aria-label="Raio de busca ao redor do ponto">
              {RADII.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        {origin && (
          <p className="text-xs text-cyan-300 lg:col-span-2">Referência: {origin.label} <button className="ml-2 text-slate-400 underline hover:text-white" onClick={() => { setOrigin(null); setRoute(null); }}>remover</button></p>
        )}
        {geo.state.status === "error" && <div className="lg:col-span-2"><Alert kind="warn">{geo.state.message}</Alert></div>}
      </section>

      <form className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <Field label="País"><select className="input" disabled><option>Brasil</option></select></Field>
        <Field label="Estado">
          <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, city: "" })}>
            {ufs.map(([uf, n]) => <option key={uf} value={uf}>{n}</option>)}
          </select>
        </Field>
        <Field label={origin ? "Cidade (opcional)" : "Cidade"}>
          <input className="input" list="cities" required={!origin} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex.: Campinas" />
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500" aria-live="polite">{shown.length} de {results.length} resultados</span>
            <div className="flex rounded-xl border border-white/10 p-1 xl:hidden" role="tablist" aria-label="Modo de exibição">
              {(["list", "map"] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1 text-sm ${view === v ? "bg-brand-500/20 text-white" : "text-slate-400"}`}>{v === "list" ? "Lista" : "Mapa"}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {searched && onlyNoSite && (
        <Alert kind="info">“Possivelmente sem site” significa apenas que a fonte de dados não informa um site para a empresa. Ela pode ter um site que não foi cadastrado — confira antes de entrar em contato.</Alert>
      )}

      {(searched || origin) && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className={`${view === "map" ? "hidden xl:grid" : "grid"} content-start gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2`}>
            {shown.map(card)}
            {searched && results.length === 0 && !loading && (
              <div className="card p-8 text-center text-slate-400 md:col-span-2">Nenhuma empresa encontrada. Tente outro bairro, aumente o raio ou mude o segmento.</div>
            )}
            {searched && results.length > 0 && shown.length === 0 && (
              <div className="card p-8 text-center text-slate-400 md:col-span-2">Todas as empresas desta busca informam um site. Desmarque “Possivelmente sem site” para vê-las.</div>
            )}
            {!searched && <div className="card p-8 text-center text-slate-400">Faça uma busca para ver as empresas aqui e no mapa.</div>}
          </div>

          <div className={`${view === "list" ? "hidden xl:block" : "block"} space-y-3 xl:sticky xl:top-4 xl:self-start`}>
            <MapView className="h-[60vh] min-h-[360px] xl:h-[calc(100vh-220px)]" places={mapPlaces} selectedId={selected} onSelect={select} origin={origin} routePolyline={route?.polyline ?? null} ariaLabel="Mapa das empresas encontradas" />
            <MapLegend />
            {sel && (
              <div ref={detailsRef} tabIndex={-1} className="card space-y-3 p-5 outline-none" aria-live="polite" aria-label={`Detalhes de ${sel.name}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{sel.name}</h3>
                    <p className="text-xs text-slate-500">{sel.category ?? "Sem categoria"}</p>
                  </div>
                  <KindBadge kind={sel.websiteKind} />
                </div>
                <dl className="grid gap-1 text-sm text-slate-300">
                  {sel.address && <div><dt className="sr-only">Endereço</dt><dd>📍 {sel.address}</dd></div>}
                  <div><dt className="sr-only">Telefone</dt><dd>📞 {sel.phone ?? "não informado"}</dd></div>
                  {sel.hours && sel.hours.length > 0 && (
                    <div><dt className="sr-only">Horários</dt><dd><details><summary className="cursor-pointer text-slate-400">🕒 Horários de funcionamento</summary><ul className="mt-1 text-xs text-slate-400">{sel.hours.map((h) => <li key={h}>{h}</li>)}</ul></details></dd></div>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary px-3 py-2 text-xs" onClick={() => save(sel)} disabled={!!sel.savedId}>{sel.savedId ? "Salva ✓" : "Salvar"}</button>
                  <button className="btn-primary px-3 py-2 text-xs" onClick={async () => { const id = await save(sel); if (id) setGen({ id, name: sel.name }); }}>Criar site com IA</button>
                  {sel.mapsUrl && <a className="btn-secondary px-3 py-2 text-xs" href={sel.mapsUrl} target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>}
                </div>
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Rota até a empresa</p>
                  {!origin ? (
                    <p className="mt-1 text-xs text-slate-500">Defina um ponto de referência (endereço ou sua localização) para calcular a rota.</p>
                  ) : (
                    <>
                      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Meio de transporte">
                        {MODES.map(([m, l]) => (
                          <button key={m} aria-pressed={route?.mode === m} onClick={() => traceRoute(sel, m)} disabled={routeState.loading} className={`rounded-lg border px-2.5 py-1 text-xs ${route?.mode === m && route.placeId === sel.sourceId ? "border-brand-500 bg-brand-500/20 text-white" : "border-white/10 text-slate-300 hover:border-brand-500/40"}`}>{l}</button>
                        ))}
                      </div>
                      <div className="mt-2 text-sm" aria-live="polite">
                        {routeState.loading && <span className="flex items-center gap-2 text-slate-400"><Spinner /> Calculando rota…</span>}
                        {routeState.error && <span className="text-red-300" role="alert">{routeState.error}</span>}
                        {route && route.placeId === sel.sourceId && !routeState.loading && (
                          <span className="text-white"><strong>{route.durationText}</strong> · {route.distanceText} <span className="text-slate-500">a partir de {origin.label}</span></span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {next && (
        <div className="text-center">
          <button className="btn-secondary" onClick={() => search(next)} disabled={loading}>{loading && <Spinner />}Carregar mais resultados</button>
        </div>
      )}
      {searched && <p className="text-right text-xs text-slate-600">Dados de empresas e mapas: Google</p>}
      {gen && <GenerateSiteDialog companyId={gen.id} companyName={gen.name} segments={segments} defaultSegment={form.segment} onClose={() => setGen(null)} />}
      {geo.state.status === "asking" && <LocationPrompt onAllow={geo.locate} onCancel={geo.cancel} />}
    </div>
  );
}

function KindBadge({ kind }: { kind: Result["websiteKind"] }) {
  if (kind === "none") return <span className="badge shrink-0 bg-brand-500/15 text-brand-300">Possivelmente sem site</span>;
  if (kind === "social") return <span className="badge shrink-0 bg-violet-500/15 text-violet-300">Só rede social</span>;
  return <span className="badge shrink-0 bg-slate-500/15 text-slate-300">Site informado</span>;
}

/** Explica por que a localização é pedida antes de acionar o pedido do navegador. */
function LocationPrompt({ onAllow, onCancel }: { onAllow: () => void; onCancel: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-labelledby="loc-title" className="card relative w-full max-w-md space-y-4 p-6 animate-fade-up">
        <h2 id="loc-title" className="text-lg font-semibold text-white">Usar sua localização?</h2>
        <p className="text-sm text-slate-300">Vamos usar sua localização atual para mostrar empresas próximas no mapa e calcular rotas até elas.</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
          <li>Ela é usada só nesta tela e não fica salva na sua conta.</li>
          <li>Na próxima etapa o navegador vai pedir sua permissão.</li>
          <li>Você pode recusar e pesquisar um endereço no lugar.</li>
        </ul>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Agora não</button>
          <button ref={btn} className="btn-primary" onClick={onAllow}>Continuar</button>
        </div>
      </div>
    </div>
  );
}
