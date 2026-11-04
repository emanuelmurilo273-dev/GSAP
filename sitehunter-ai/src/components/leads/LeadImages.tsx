"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Spinner, toast } from "@/components/ui";
import type { ImageCandidate } from "@/lib/leads/types";

type Found = { url: string; thumb: string; alt: string; credit: { name: string; link: string }; license: string; licenseUrl: string | null; source: string; sourceUrl: string };

const ORIGIN: Record<ImageCandidate["origin"], string> = { company: "Da empresa", stock: "Banco com licença", generated: "Gerada por IA" };

/** Revisão das imagens do lead: as aprovadas entram no site gerado (na ordem: empresa, depois banco). */
export function LeadImages({ leadId, initial, defaultQuery, isDemo }: { leadId: string; initial: ImageCandidate[]; defaultQuery: string; isDemo: boolean }) {
  const [images, setImages] = useState(initial);
  const [perm, setPerm] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState(defaultQuery);
  const [found, setFound] = useState<Found[] | null>(null);
  const [prov, setProv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(img: ImageCandidate, status: ImageCandidate["status"]) {
    setError(null);
    try {
      const r = await api<{ images: ImageCandidate[] }>(`/api/leads/${leadId}/images`, { method: "PATCH", body: { imageId: img.id, status, confirmPermission: perm[img.id] === true } });
      setImages(r.images);
      toast(status === "approved" ? "Imagem aprovada para o site" : status === "rejected" ? "Imagem descartada" : "Imagem voltou para revisão");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ configured: boolean; provider?: string; images: Found[] }>(`/api/images/search?q=${encodeURIComponent(q)}`);
      setProv(r.provider ?? "");
      setFound(r.images);
      if (!r.configured) setError("A busca de imagens está desativada no servidor (IMAGE_SEARCH=off).");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(f: Found) {
    try {
      const r = await api<{ images: ImageCandidate[] }>(`/api/leads/${leadId}/images`, { body: f });
      setImages(r.images);
      toast("Adicionada e aprovada, com crédito e licença");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const visible = images.filter((i) => i.status !== "rejected");
  const approved = images.filter((i) => i.status === "approved").length;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-white">Imagens para o site</h2>
        <span className="badge bg-white/5 text-slate-300">{approved} aprovada{approved === 1 ? "" : "s"}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">As aprovadas entram no site, na ordem: imagens da empresa (com autorização), depois as de banco com licença. Se faltarem, a geração completa com um banco com licença compatível, sempre com crédito.</p>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}

      {visible.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {visible.map((img) => (
            <li key={img.id} className={`overflow-hidden rounded-xl border bg-ink-900/60 transition ${img.status === "approved" ? "border-emerald-400/40" : "border-white/10"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumb ?? img.url} alt={img.alt || "Imagem candidata"} className="aspect-video w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              <div className="space-y-1.5 p-2.5 text-[11px]">
                <p className="flex flex-wrap gap-1"><span className={`badge ${img.origin === "company" ? "bg-amber-500/15 text-amber-200" : "bg-brand-500/15 text-brand-200"}`}>{ORIGIN[img.origin]}</span>{img.status === "approved" && <span className="badge bg-emerald-500/15 text-emerald-300">Aprovada</span>}</p>
                <p className="truncate text-slate-400" title={img.license ?? ""}>{img.credit ? `${img.credit.name} · ` : ""}{img.license}</p>
                {img.sourceUrl && <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-slate-500 hover:text-slate-300">Origem: {img.source}</a>}
                {img.status !== "approved" ? (
                  <>
                    {img.requiresPermission && (
                      <label className="flex items-start gap-1.5 text-amber-100/90"><input type="checkbox" className="mt-0.5" checked={!!perm[img.id]} onChange={(e) => setPerm({ ...perm, [img.id]: e.target.checked })} />Tenho autorização da empresa</label>
                    )}
                    <div className="flex gap-1.5">
                      <button className="btn-secondary flex-1 px-2 py-1.5 text-[11px]" disabled={img.requiresPermission && !perm[img.id]} onClick={() => review(img, "approved")}>Aprovar</button>
                      <button className="btn-ghost px-2 py-1.5 text-[11px]" onClick={() => review(img, "rejected")}>Descartar</button>
                    </div>
                  </>
                ) : (
                  <button className="btn-ghost w-full px-2 py-1.5 text-[11px]" onClick={() => review(img, "candidate")}>Tirar do site</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{isDemo ? "Lead fictício: nenhuma imagem da empresa." : "Nenhuma imagem encontrada nos canais públicos da empresa."}</p>
      )}

      <form onSubmit={search} className="mt-5 flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} minLength={2} maxLength={80} aria-label="Buscar imagens com licença" placeholder="Buscar em banco com licença (ex.: barbershop)" />
        <button className="btn-secondary shrink-0" disabled={busy || q.trim().length < 2}>{busy ? <Spinner /> : "Buscar"}</button>
      </form>
      {found && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">{found.length ? `${found.length} resultados no ${prov}, só licenças que permitem uso comercial e modificação.` : "Nenhum resultado."} Termos em inglês costumam trazer mais resultados.</p>
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
            {found.map((f) => (
              <button key={f.url} type="button" className="group relative overflow-hidden rounded-lg" onClick={() => add(f)} title={`${f.credit.name} · ${f.license}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.thumb} alt={f.alt} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{f.license}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Imagens geradas por IA (Google Flow, fluxo assistido) são adicionadas no editor da prévia e sempre aparecem com o aviso “ilustrativa”.</p>
    </section>
  );
}
