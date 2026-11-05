"use client";
import type { Concept, SiteContent } from "@/lib/site/types";
import { MATERIALS, MATERIAL_LABEL, MODEL_KINDS, MODEL_LABEL, type Material, type ModelKind } from "@/lib/site/immersive/kinds";
import { buildConcept, relabelModel, varyConcept } from "@/lib/site/immersive/concept";

/** Conceito da Vitrine 3D: o que foi escolhido para esta empresa e por quê. */
export function ConceptPanel({ content, onChange }: { content: SiteContent; onChange: (c: SiteContent) => void }) {
  const k: Concept = content.concept ?? buildConcept({ name: content.business.name || content.siteName, segmentKey: "", instagram: content.business.instagram, hasWhatsapp: !!content.business.whatsapp });
  const set = (concept: Concept) => onChange({ ...content, concept });
  return (
    <div className="space-y-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="label">Conceito desta empresa</span>
          <p className="text-sm font-semibold text-white">{k.name}</p>
          <p className="mt-1 text-xs text-slate-400">{k.summary}</p>
        </div>
        <div className="flex shrink-0 gap-1" aria-hidden="true">{Object.values(k.palette).map((c, i) => <span key={i} className="h-5 w-5 rounded-full border border-white/20" style={{ background: c }} />)}</div>
      </div>
      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300">Por que este conceito</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">{k.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </details>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Objeto 3D</span>
          <select className="input" value={k.model} onChange={(e) => set(relabelModel(k, e.target.value as ModelKind))}>{MODEL_KINDS.map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}</select>
        </label>
        <label className="block"><span className="label">Material</span>
          <select className="input" value={k.material} onChange={(e) => set({ ...k, material: e.target.value as Material })}>{MATERIALS.map((m) => <option key={m} value={m}>{MATERIAL_LABEL[m]}</option>)}</select>
        </label>
        <label className="block"><span className="label">Cor de destaque</span>
          <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" value={k.palette.accent} onChange={(e) => set({ ...k, palette: { ...k.palette, accent: e.target.value } })} />
        </label>
        <label className="block"><span className="label">Palavra ao fundo</span>
          <input className="input" maxLength={14} value={k.heroWord} onChange={(e) => set({ ...k, heroWord: e.target.value.toUpperCase() })} />
        </label>
      </div>
      <button type="button" className="btn-secondary w-full py-2 text-sm" onClick={() => set(varyConcept(k))}>Outra variação (paleta, fontes, movimento)</button>
      <p className="text-[11px] text-slate-500">O objeto 3D é ilustrativo e o site informa isso no rodapé. Fotos reais da empresa entram na galeria e no “Sobre”.</p>
    </div>
  );
}
