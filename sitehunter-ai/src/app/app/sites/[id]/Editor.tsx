"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FlowAssistant } from "@/components/studio/FlowAssistant";
import { useTiltVars } from "@/components/studio/useTiltVars";
import { api } from "@/components/api";
import { Alert, Spinner, StatusBadge, toast } from "@/components/ui";
import { renderSite } from "@/lib/site/render";
import { FONTS, IMAGE_ORIGINS, type ImageOrigin, type Section, type SiteButton, type SiteContent, type SiteImage } from "@/lib/site/types";
import { emptySection, themeForStyle } from "@/lib/site/templates";
import { ConceptPanel } from "@/components/studio/ConceptPanel";
import { ClaudeEdit } from "@/components/studio/ClaudeEdit";
import { SITE_STYLES, STYLE_INFO, contrast, type SiteStyle } from "@/lib/site/styles";
import { OBJECT_KINDS, OBJECT_LABEL, type ObjectKind } from "@/lib/site/stage";

type Pub = { status: string; slug: string; url: string; pathUrl: string; customDomain: string | null; customDomainVerified: boolean; lastDeployAt: string | null; provider?: string | null; verified?: boolean } | null;

const SECTION_LABELS: Record<Section["type"], string> = {
  hero: "Capa (topo)",
  about: "Sobre a empresa",
  services: "Serviços / especialidades",
  menu: "Cardápio",
  products: "Produtos",
  hours: "Horários",
  gallery: "Galeria de fotos",
  cta: "Chamada para ação",
  quote: "Pedido de orçamento",
  contact: "Contato e localização",
  text: "Texto livre",
  stats: "Destaques em números",
};

const ACTIONS: { v: SiteButton["action"]; l: string }[] = [
  { v: "whatsapp", l: "Abrir WhatsApp" },
  { v: "phone", l: "Ligar" },
  { v: "email", l: "Enviar e-mail" },
  { v: "maps", l: "Abrir mapa" },
  { v: "section", l: "Ir para seção" },
  { v: "link", l: "Link externo" },
];

// ---------- Campos básicos ----------
function T({ label, value, onChange, max = 160 }: { label: string; value: string; onChange: (v: string) => void; max?: number }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function TA({ label, value, onChange, max = 2000, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; max?: number; rows?: number }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="input" rows={rows} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="flex items-center gap-2">
        <code className="text-xs text-slate-500">{value}</code>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-md border-0 bg-transparent" />
      </span>
    </label>
  );
}

function ButtonEditor({ value, onChange, sections, onRemove }: { value: SiteButton; onChange: (b: SiteButton) => void; sections: Section[]; onRemove?: () => void }) {
  return (
    <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex gap-2">
        <input className="input" value={value.label} maxLength={60} onChange={(e) => onChange({ ...value, label: e.target.value })} placeholder="Texto do botão" />
        {onRemove && <button className="btn-ghost px-2 text-red-300" onClick={onRemove} aria-label="Remover botão">✕</button>}
      </div>
      <select className="input" value={value.action} onChange={(e) => onChange({ ...value, action: e.target.value as SiteButton["action"], href: undefined })}>
        {ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
      </select>
      {value.action === "link" && <input className="input" placeholder="https://..." value={value.href ?? ""} onChange={(e) => onChange({ ...value, href: e.target.value })} />}
      {value.action === "section" && (
        <select className="input" value={value.href ?? ""} onChange={(e) => onChange({ ...value, href: e.target.value })}>
          <option value="">Escolha a seção</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.title || SECTION_LABELS[s.type]}</option>)}
        </select>
      )}
    </div>
  );
}

type CompanyImage = { url: string; alt: string; sourceUrl: string };
type Assets = { openFlow: (cb: (i: SiteImage) => void) => void; companyImages: CompanyImage[] };
const AssetsCtx = createContext<Assets>({ openFlow: () => undefined, companyImages: [] });

const ORIGIN_LABEL: Record<ImageOrigin, string> = {
  stock: "Banco de imagens (licença)",
  company: "Da empresa (autorizada)",
  generated: "Gerada por IA",
  user: "Própria (tenho os direitos)",
};

function ImageEditor({ value, onChange, onSearch, label = "Imagem" }: { value?: SiteImage; onChange: (i?: SiteImage) => void; onSearch?: (cb: (i: SiteImage) => void) => void; label?: string }) {
  const { openFlow, companyImages } = useContext(AssetsCtx);
  const [showCompany, setShowCompany] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  return (
    <div className="space-y-2">
      <span className="label">{label}</span>
      {value?.url && (
        <div className="relative overflow-hidden rounded-xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url.startsWith("lib:") ? `/photos/${value.url.slice(4)}` : value.url} alt={value.alt} className="h-28 w-full object-cover" />
          {value.origin === "generated" && <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-amber-200">GERADA POR IA · ilustrativa</span>}
          <button className="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-xs text-white" onClick={() => onChange(undefined)}>Remover</button>
        </div>
      )}
      <input className="input" placeholder="URL da imagem (https://...)" value={value?.url ?? ""} onChange={(e) => onChange(e.target.value ? { url: e.target.value, alt: value?.alt ?? "", credit: undefined, origin: "user", license: "Declarado pelo usuário" } : undefined)} />
      {value?.url && (
        <>
          <input className="input" placeholder="Descrição da imagem (acessibilidade)" value={value.alt} maxLength={200} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input text-xs" aria-label="Origem da imagem" value={value.origin ?? (value.credit ? "stock" : "user")} onChange={(e) => onChange({ ...value, origin: e.target.value as ImageOrigin })}>
              {IMAGE_ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
            </select>
            <input className="input text-xs" placeholder="Licença / condição de uso" maxLength={300} value={value.license ?? ""} onChange={(e) => onChange({ ...value, license: e.target.value })} aria-label="Licença" />
          </div>
          <p className="text-xs text-slate-500">
            {value.credit ? `Crédito: ${value.credit.name} / Unsplash. ` : ""}
            {value.origin === "generated" ? "Será exibida com o aviso “imagem ilustrativa gerada por IA”." : value.origin === "company" ? "Use somente com autorização da empresa." : ""}
            {value.sourceUrl ? <> Origem: <a href={value.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">link</a></> : null}
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        {onSearch && <button className="btn-secondary py-2 text-xs" onClick={() => onSearch((i) => onChange(i))}>Banco de imagens</button>}
        <button className="btn-secondary py-2 text-xs" onClick={() => openFlow((i) => onChange(i))}>Google Flow (assistido)</button>
        {companyImages.length > 0 && <button className="btn-secondary col-span-2 py-2 text-xs" onClick={() => setShowCompany((v) => !v)}>Imagens do site da empresa ({companyImages.length})</button>}
      </div>
      {showCompany && (
        <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <label className="flex items-start gap-2 text-xs text-amber-100">
            <input type="checkbox" className="mt-0.5" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
            Tenho autorização da empresa para usar estas imagens nesta prévia.
          </label>
          <div className="grid grid-cols-3 gap-2">
            {companyImages.map((ci) => (
              <button key={ci.url} disabled={!authorized} className="overflow-hidden rounded-lg disabled:opacity-40" onClick={() => { onChange({ url: ci.url, alt: ci.alt, origin: "company", sourceUrl: ci.sourceUrl, license: "Imagem da empresa, uso autorizado (declarado pelo usuário)" }); setShowCompany(false); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ci.url} alt={ci.alt || "Imagem do site da empresa"} className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-600">Use apenas imagens próprias, da empresa (com autorização), de bancos com licença ou geradas e identificadas como tal.</p>
    </div>
  );
}

function ListEditor<T>({ items, onChange, render, make, addLabel, max = 24 }: { items: T[]; onChange: (v: T[]) => void; render: (item: T, set: (v: T) => void) => React.ReactNode; make: () => T; addLabel: string; max?: number }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="relative space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 pr-10">
          {render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <button className="text-xs text-slate-500 hover:text-white" disabled={i === 0} onClick={() => { const c = [...items]; [c[i - 1], c[i]] = [c[i]!, c[i - 1]!]; onChange(c); }} aria-label="Subir">▲</button>
            <button className="text-xs text-red-400/70 hover:text-red-300" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
          </div>
        </div>
      ))}
      {items.length < max && <button className="btn-secondary w-full py-2 text-xs" onClick={() => onChange([...items, make()])}>+ {addLabel}</button>}
    </div>
  );
}

// ---------- Editor de cada seção ----------
function SectionForm({ s, set, sections, onSearchImage }: { s: Section; set: (s: Section) => void; sections: Section[]; onSearchImage: (cb: (i: SiteImage) => void) => void }) {
  switch (s.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Subtítulo" value={s.subtitle} rows={3} max={400} onChange={(subtitle) => set({ ...s, subtitle })} />
          <ImageEditor label="Imagem de fundo" value={s.image} onChange={(image) => set({ ...s, image })} onSearch={onSearchImage} />
          <span className="label">Botões</span>
          {s.buttons.map((b, i) => (
            <ButtonEditor key={i} value={b} sections={sections} onChange={(nb) => set({ ...s, buttons: s.buttons.map((x, j) => (j === i ? nb : x)) })} onRemove={() => set({ ...s, buttons: s.buttons.filter((_, j) => j !== i) })} />
          ))}
          {s.buttons.length < 3 && <button className="btn-secondary w-full py-2 text-xs" onClick={() => set({ ...s, buttons: [...s.buttons, { label: "Fale conosco", action: "whatsapp" }] })}>+ Adicionar botão</button>}
        </div>
      );
    case "about":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Texto" value={s.text} rows={7} onChange={(text) => set({ ...s, text })} />
          <ImageEditor value={s.image} onChange={(image) => set({ ...s, image })} onSearch={onSearchImage} />
        </div>
      );
    case "services":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Introdução" value={s.intro} rows={2} max={600} onChange={(intro) => set({ ...s, intro })} />
          <ListEditor items={s.items} onChange={(items) => set({ ...s, items })} addLabel="Adicionar serviço" make={() => ({ title: "Novo serviço", description: "" })}
            render={(it, upd) => (<><input className="input" value={it.title} maxLength={100} onChange={(e) => upd({ ...it, title: e.target.value })} /><textarea className="input" rows={2} value={it.description} maxLength={400} onChange={(e) => upd({ ...it, description: e.target.value })} /></>)} />
        </div>
      );
    case "products":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Introdução" value={s.intro} rows={2} max={600} onChange={(intro) => set({ ...s, intro })} />
          <ListEditor<(typeof s.items)[number]> items={s.items} onChange={(items) => set({ ...s, items })} addLabel="Adicionar produto" make={() => ({ name: "Novo produto", description: "" })}
            render={(it, upd) => (<><input className="input" value={it.name} maxLength={100} onChange={(e) => upd({ ...it, name: e.target.value })} /><textarea className="input" rows={2} value={it.description} maxLength={300} onChange={(e) => upd({ ...it, description: e.target.value })} /><input className="input" placeholder="URL da imagem (opcional)" value={it.image?.url ?? ""} onChange={(e) => upd({ ...it, image: e.target.value ? { url: e.target.value, alt: it.name } : undefined })} /></>)} />
        </div>
      );
    case "menu":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Introdução" value={s.intro} rows={2} max={600} onChange={(intro) => set({ ...s, intro })} />
          <p className="text-xs text-amber-200/70">Informe preços somente se confirmados pela empresa. Deixe em branco para ocultar.</p>
          <ListEditor items={s.categories} max={12} onChange={(categories) => set({ ...s, categories })} addLabel="Adicionar categoria" make={() => ({ name: "Categoria", items: [] })}
            render={(cat, upd) => (
              <>
                <input className="input font-semibold" value={cat.name} maxLength={80} onChange={(e) => upd({ ...cat, name: e.target.value })} />
                <ListEditor items={cat.items} max={40} onChange={(items) => upd({ ...cat, items })} addLabel="Adicionar item" make={() => ({ name: "Item", description: "", price: "" })}
                  render={(it, u2) => (<><input className="input" value={it.name} maxLength={100} onChange={(e) => u2({ ...it, name: e.target.value })} /><input className="input" placeholder="Descrição" value={it.description} maxLength={300} onChange={(e) => u2({ ...it, description: e.target.value })} /><input className="input" placeholder="Preço (ex.: R$ 25,00)" value={it.price} maxLength={30} onChange={(e) => u2({ ...it, price: e.target.value })} /></>)} />
              </>
            )} />
        </div>
      );
    case "hours":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <p className="text-xs text-amber-200/70">Preencha apenas horários confirmados. Linhas sem horário não aparecem no site; se todas estiverem vazias, a seção fica oculta.</p>
          <ListEditor items={s.lines} max={10} onChange={(lines) => set({ ...s, lines })} addLabel="Adicionar linha" make={() => ({ label: "Dia", value: "" })}
            render={(l, upd) => (<div className="grid grid-cols-2 gap-2"><input className="input" value={l.label} maxLength={60} onChange={(e) => upd({ ...l, label: e.target.value })} /><input className="input" placeholder="08h às 18h" value={l.value} maxLength={80} onChange={(e) => upd({ ...l, value: e.target.value })} /></div>)} />
        </div>
      );
    case "gallery":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <ListEditor items={s.images} max={12} onChange={(images) => set({ ...s, images })} addLabel="Adicionar imagem por URL" make={() => ({ url: "", alt: "" })}
            render={(im, upd) => <ImageEditor label="Foto" value={im.url ? im : undefined} onChange={(v) => upd(v ?? { url: "", alt: "" })} />} />
          <button className="btn-secondary w-full py-2 text-xs" onClick={() => onSearchImage((i) => set({ ...s, images: [...s.images, i].slice(0, 12) }))}>Buscar no banco de imagens</button>
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Texto" value={s.text} rows={2} max={500} onChange={(text) => set({ ...s, text })} />
          <ButtonEditor value={s.button} sections={sections} onChange={(button) => set({ ...s, button })} />
        </div>
      );
    case "quote":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Texto" value={s.text} rows={2} max={500} onChange={(text) => set({ ...s, text })} />
          <T label="Texto do botão" value={s.buttonLabel} max={60} onChange={(buttonLabel) => set({ ...s, buttonLabel })} />
          <p className="text-xs text-slate-500">O formulário abre o WhatsApp (ou e-mail) da empresa com a mensagem do visitante. Nenhum dado é armazenado.</p>
        </div>
      );
    case "contact":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Texto" value={s.text} rows={2} max={500} onChange={(text) => set({ ...s, text })} />
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-brand-500" checked={s.showMap} onChange={(e) => set({ ...s, showMap: e.target.checked })} /> Mostrar botão “Abrir no mapa”</label>
          <p className="text-xs text-slate-500">Telefone, endereço e redes sociais são editados na aba “Empresa”.</p>
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <TA label="Texto" value={s.text} rows={8} max={3000} onChange={(text) => set({ ...s, text })} />
        </div>
      );
    case "stats":
      return (
        <div className="space-y-3">
          <Alert kind="warn">Use somente números confirmados pela empresa (ex.: anos de atuação, cadeiras, metros quadrados). Sem valor, o destaque não aparece no site.</Alert>
          <T label="Título" value={s.title} onChange={(title) => set({ ...s, title })} />
          <ListEditor
            items={s.items}
            max={6}
            addLabel="+ Adicionar número"
            make={() => ({ value: "", unit: "", label: "", source: "" })}
            onChange={(items) => set({ ...s, items })}
            render={(it, setIt) => (
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <input className="input" placeholder="Número (ex.: 12)" maxLength={12} value={it.value} onChange={(e) => setIt({ ...it, value: e.target.value })} aria-label="Número" />
                <input className="input" placeholder="Unidade" maxLength={12} value={it.unit} onChange={(e) => setIt({ ...it, unit: e.target.value })} aria-label="Unidade" />
                <input className="input col-span-2" placeholder="Frase curta (ex.: anos no mesmo endereço)" maxLength={120} value={it.label} onChange={(e) => setIt({ ...it, label: e.target.value })} aria-label="Descrição" />
                <input className="input col-span-2 text-xs" placeholder="Fonte da confirmação (só para você; não aparece no site)" maxLength={160} value={it.source} onChange={(e) => setIt({ ...it, source: e.target.value })} aria-label="Fonte" />
              </div>
            )}
          />
        </div>
      );
  }
}

// ---------- Busca de imagens ----------
type Img = SiteImage & { thumb: string; downloadLocation?: string; license?: string; sourceUrl?: string };
function ImagePicker({ onPick, onClose }: { onPick: (i: SiteImage) => void; onClose: () => void }) {
  const [prov, setProv] = useState("banco com licença");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Img[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const r = await api<{ configured: boolean; provider?: string; images: Img[] }>(`/api/images/search?q=${encodeURIComponent(q)}`);
      if (r.provider) setProv(r.provider);
      if (!r.configured) setMsg("Busca de imagens desativada no servidor (IMAGE_SEARCH=off). Cole a URL de uma imagem autorizada.");
      setItems(r.images);
      if (r.configured && !r.images.length) setMsg("Nenhuma imagem encontrada.");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="card relative flex max-h-[85vh] w-full max-w-3xl flex-col p-5">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-white">Banco de imagens · {prov}</h3><button className="btn-ghost px-2" onClick={onClose}>✕</button></div>
        <form onSubmit={search} className="mt-3 flex gap-2"><input autoFocus className="input" placeholder="Ex.: barbearia, comida, dentista (em inglês costuma ter mais resultados)" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-primary" disabled={loading || q.length < 2}>{loading ? <Spinner /> : "Buscar"}</button></form>
        {msg && <div className="mt-3"><Alert kind="info">{msg}</Alert></div>}
        <div className="mt-4 grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {items.map((i) => (
            <button key={i.url} className="group relative overflow-hidden rounded-xl" onClick={() => { void api("/api/images/search", { body: { downloadLocation: i.downloadLocation } }).catch(() => undefined); onPick({ url: i.url, alt: i.alt, credit: i.credit, origin: "stock", license: i.license ?? "Licença Unsplash", sourceUrl: i.sourceUrl ?? i.credit?.link }); onClose(); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.thumb} alt={i.alt} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[10px] text-white">{i.credit?.name}{i.license ? ` · ${i.license}` : ""}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Só imagens com licença que permite uso comercial e modificação. O crédito ao autor e a licença aparecem no site.</p>
      </div>
    </div>
  );
}

// ---------- Editor principal ----------
export function Editor(props: {
  projectId: string; projectName: string; initialContent: SiteContent; aiGenerated: boolean; premium: boolean; imagesEnabled: boolean; rootDomain: string; hosting?: { kind: "vercel" | "github"; prefix: string } | null;
  companyPhone: string | null; initialOutreach: string; initialWhatsapp: string | null; publication: Pub; updatedAt: string;
  companyImages?: CompanyImage[]; segmentLabel?: string; niche?: string | null; isDemo?: boolean; leadId?: string | null; lang?: string;
}) {
  const [content, setContent] = useState<SiteContent>(props.initialContent);
  const [saved, setSaved] = useState(JSON.stringify(props.initialContent));
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"sections" | "design" | "business" | "publish" | "sales">("sections");
  const [selected, setSelected] = useState<string | null>(content.sections[0]?.id ?? null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pub, setPub] = useState<Pub>(props.publication);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<((i: SiteImage) => void) | null>(null);
  const [showNotes, setShowNotes] = useState(true);
  const dirty = JSON.stringify(content) !== saved;
  const [flowCb, setFlowCb] = useState<((i: SiteImage) => void) | null>(null);
  const [view3d, setView3d] = useState(false);
  const unpublished = pub?.status !== "PUBLISHED";
  const tiltRef = useTiltVars<HTMLDivElement>(view3d);
  const ribbon = unpublished ? `Prévia não publicada · demonstração${props.isDemo ? " com dados fictícios" : ""}` : null;
  const html = useMemo(() => renderSite(content, { footerCredit: true, previewRibbon: ribbon, lang: props.lang }), [content, ribbon, props.lang]);
  const assets = useMemo<Assets>(() => ({ openFlow: (cb) => setFlowCb(() => cb), companyImages: props.companyImages ?? [] }), [props.companyImages]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/projects/${props.projectId}`, { method: "PATCH", body: { content } });
      setSaved(JSON.stringify(content));
      toast("Alterações salvas");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [content, props.projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (props.premium) void save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onLeave); };
  }, [save, dirty, props.premium]);

  const setSection = (id: string, s: Section) => setContent((c) => ({ ...c, sections: c.sections.map((x) => (x.id === id ? s : x)) }));
  const move = (i: number, d: -1 | 1) => setContent((c) => { const a = [...c.sections]; const j = i + d; if (j < 0 || j >= a.length) return c; [a[i], a[j]] = [a[j]!, a[i]!]; return { ...c, sections: a }; });
  const openPicker = props.imagesEnabled ? (cb: (i: SiteImage) => void) => setPicker(() => cb) : (cb: (i: SiteImage) => void) => { void cb; toast("Banco de imagens não configurado. Cole a URL de uma imagem autorizada."); };

  async function publish(slug?: string) {
    if (dirty && !(await save())) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ publication: NonNullable<Pub> & { customDomainVerifiedAt?: string } }>(`/api/projects/${props.projectId}/publish`, { body: { slug, confirmPublic: true } });
      setPub({ ...r.publication, customDomainVerified: !!r.publication.customDomainVerifiedAt, provider: (r.publication as { externalProvider?: string | null }).externalProvider ?? null, verified: !!(r.publication as { externalVerifiedAt?: string | null }).externalVerifiedAt });
      toast(pub?.status === "PUBLISHED" ? "Link público atualizado com as alterações" : "Link público liberado");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function unpublish() {
    setBusy(true);
    try {
      await api(`/api/projects/${props.projectId}/publish`, { method: "DELETE" });
      setPub((p) => (p ? { ...p, status: "UNPUBLISHED" } : p));
      toast("Acesso retirado: o link público não funciona mais");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function previewTab() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const sel = content.sections.find((s) => s.id === selected);

  return (
    <AssetsCtx.Provider value={assets}>
    <div className="-mx-4 -my-6 sm:-mx-8 sm:-my-8">
      {/* Barra superior */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-white/5 bg-ink-950/90 px-4 py-3 backdrop-blur sm:px-6 lg:top-0">
        <Link href={props.leadId ? `/app/leads/${props.leadId}` : "/app/sites"} className="btn-ghost px-2 text-sm">← {props.leadId ? "Lead" : "Sites"}</Link>
        <div className="mr-auto min-w-0">
          <p className="truncate font-semibold text-white">{props.projectName}</p>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            {pub ? <StatusBadge status={pub.status} /> : <StatusBadge status="DRAFT" />}
            {unpublished && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">Prévia não publicada</span>}
            {props.isDemo && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">DEMO</span>}
            {dirty ? <span className="text-amber-300">Alterações não salvas</span> : <span>Tudo salvo</span>}
          </p>
        </div>
        <div className="flex rounded-xl border border-white/10 p-1">
          <button className={`rounded-lg px-2.5 py-1 text-xs ${device === "desktop" ? "bg-brand-500/20 text-white" : "text-slate-400"}`} onClick={() => setDevice("desktop")}>💻 Computador</button>
          <button className={`rounded-lg px-2.5 py-1 text-xs ${device === "mobile" ? "bg-brand-500/20 text-white" : "text-slate-400"}`} onClick={() => setDevice("mobile")}>📱 Celular</button>
          <button aria-pressed={view3d} className={`rounded-lg px-2.5 py-1 text-xs ${view3d ? "bg-brand-500/20 text-white" : "text-slate-400"}`} onClick={() => setView3d((v) => !v)} title="Moldura em perspectiva (passe o mouse para endireitar)">◇ 3D</button>
        </div>
        <button className="btn-secondary py-2" onClick={previewTab}>Visualizar</button>
        <button className="btn-secondary py-2" onClick={save} disabled={!dirty || saving || !props.premium}>{saving && <Spinner />}Salvar</button>
        <button className={`btn py-2 ${pub?.status === "PUBLISHED" ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border border-white/10 bg-white/[0.04] text-slate-200"}`} onClick={() => setTab("publish")} title="Visibilidade da prévia">
          {pub?.status === "PUBLISHED" ? "● Site público" : "🔒 Prévia privada"}
        </button>
      </div>

      <div className="grid lg:grid-cols-[400px_1fr]">
        {/* Painel lateral */}
        <div className="border-b border-white/5 lg:h-[calc(100vh-65px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="space-y-3 p-4">
            {!props.premium && <Alert kind="warn">Assinatura inativa: a edição e a publicação estão bloqueadas. Você ainda pode exportar e despublicar.</Alert>}
            {error && <Alert>{error}</Alert>}
            {showNotes && content.reviewNotes.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/90">
                <div className="mb-1 flex justify-between"><strong>Revise antes de publicar</strong><button onClick={() => setShowNotes(false)}>✕</button></div>
                <ul className="list-disc space-y-1 pl-4">{content.reviewNotes.map((n) => <li key={n}>{n}</li>)}</ul>
                {!props.aiGenerated && <p className="mt-2 text-amber-200/70">Este site foi gerado pelo modelo padrão (IA não configurada).</p>}
              </div>
            )}
            <ClaudeEdit projectId={props.projectId} content={content} disabled={!props.premium} onApply={(c) => setContent(c)} />
            <div className="grid grid-cols-5 gap-1 rounded-xl border border-white/10 p-1 text-[11px]">
              {([["sections", "Seções"], ["design", "Design"], ["business", "Empresa"], ["publish", "Publicar"], ["sales", "Vendas"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-1 py-1.5 ${tab === k ? "bg-brand-500/20 text-white" : "text-slate-400 hover:text-white"}`}>{l}</button>
              ))}
            </div>

            {tab === "sections" && (
              <div className="space-y-3">
                <T label="Nome do site" value={content.siteName} max={120} onChange={(siteName) => setContent({ ...content, siteName })} />
                <ul className="space-y-1">
                  {content.sections.map((s, i) => (
                    <li key={s.id} className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 text-sm ${selected === s.id ? "border-brand-500/40 bg-brand-500/10" : "border-white/5 bg-white/[0.02]"}`}>
                      <button className="min-w-0 flex-1 truncate text-left" onClick={() => setSelected(selected === s.id ? null : s.id)}>
                        <span className={s.visible ? "text-slate-200" : "text-slate-500 line-through"}>{s.title || SECTION_LABELS[s.type]}</span>
                        <span className="ml-1.5 text-[10px] text-slate-500">{SECTION_LABELS[s.type]}</span>
                      </button>
                      <button className="px-1 text-slate-500 hover:text-white" onClick={() => move(i, -1)} aria-label="Mover para cima">▲</button>
                      <button className="px-1 text-slate-500 hover:text-white" onClick={() => move(i, 1)} aria-label="Mover para baixo">▼</button>
                      <button className="px-1 text-slate-500 hover:text-white" title={s.visible ? "Ocultar" : "Mostrar"} onClick={() => setSection(s.id, { ...s, visible: !s.visible })}>{s.visible ? "👁" : "◌"}</button>
                      <button className="px-1 text-red-400/70 hover:text-red-300" onClick={() => confirm("Remover esta seção?") && setContent({ ...content, sections: content.sections.filter((x) => x.id !== s.id) })} aria-label="Remover seção">✕</button>
                    </li>
                  ))}
                </ul>
                <select className="input" value="" onChange={(e) => { if (!e.target.value) return; const s = emptySection(e.target.value as Section["type"]); setContent({ ...content, sections: [...content.sections, s] }); setSelected(s.id); }}>
                  <option value="">+ Adicionar seção...</option>
                  {Object.entries(SECTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {sel && (
                  <div className="rounded-2xl border border-brand-500/20 bg-ink-900 p-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-300">Editando: {SECTION_LABELS[sel.type]}</p>
                    <SectionForm s={sel} set={(s) => setSection(sel.id, s)} sections={content.sections} onSearchImage={openPicker} />
                  </div>
                )}
              </div>
            )}

            {tab === "design" && (
              <div className="space-y-2">
                <div className="space-y-2">
                  <span className="label">Direção visual</span>
                  <div className="grid gap-2">
                    {SITE_STYLES.map((st) => {
                      const on = (content.theme.style ?? "studio") === st;
                      return (
                        <button key={st} type="button" aria-pressed={on} onClick={() => setContent({ ...content, theme: themeForStyle(st as SiteStyle, content.theme.primary, content.theme.accent) })}
                          className={`rounded-xl border p-3 text-left transition duration-300 ${on ? "border-brand-500/60 bg-brand-500/10" : "border-white/10 hover:border-white/25"}`}>
                          <span className="flex items-center justify-between text-sm font-semibold text-white">{STYLE_INFO[st].label}{STYLE_INFO[st].uses3d && <span className="badge bg-white/5 text-[10px] text-slate-400">{st === "immersive" ? "3D real" : "3D discreto"}</span>}</span>
                          <span className="mt-1 block text-xs text-slate-400">{STYLE_INFO[st].description}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">Trocar a direção redefine fundo, tipografia e cantos; as cores da marca e os textos são mantidos.</p>
                </div>
                {content.theme.style === "immersive" ? <ConceptPanel content={content} onChange={setContent} /> : <ContrastNote theme={content.theme} />}
                <div className={`space-y-2 rounded-xl border border-white/10 p-3 ${content.theme.style === "immersive" ? "hidden" : ""}`}>
                  <span className="label">Palco 3D (rolagem)</span>
                  <p className="text-xs text-slate-400">O objeto fica fixo e muda de posição, ângulo e escala conforme a pessoa rola; serviços e números confirmados entram em sequência.</p>
                  <select className="input" aria-label="Modo do palco" value={content.stage?.mode ?? "auto"} onChange={(e) => setContent({ ...content, stage: { kind: content.stage?.kind ?? "gear", ...content.stage, mode: e.target.value as "auto" | "photo" | "illustration" | "off" } })}>
                    <option value="auto">Automático (foto real se houver, senão ilustração)</option>
                    <option value="illustration">Sempre ilustração em relevo</option>
                    <option value="off">Desligado (seções comuns)</option>
                  </select>
                  <select className="input" aria-label="Objeto" value={content.stage?.kind ?? "gear"} onChange={(e) => setContent({ ...content, stage: { mode: "auto", ...content.stage, kind: e.target.value as ObjectKind } })}>
                    {OBJECT_KINDS.map((k) => <option key={k} value={k}>{OBJECT_LABEL[k]}</option>)}
                  </select>
                  <ImageEditor label="Foto do objeto (opcional)" value={content.stage?.image} onChange={(image) => setContent({ ...content, stage: { kind: content.stage?.kind ?? "gear", mode: content.stage?.mode ?? "auto", image } })} onSearch={openPicker} />
                </div>
                <Color label="Cor principal" value={content.theme.primary} onChange={(primary) => setContent({ ...content, theme: { ...content.theme, primary } })} />
                <Color label="Cor dos botões" value={content.theme.accent} onChange={(accent) => setContent({ ...content, theme: { ...content.theme, accent } })} />
                <Color label="Fundo" value={content.theme.background} onChange={(background) => setContent({ ...content, theme: { ...content.theme, background } })} />
                <Color label="Fundo alternativo" value={content.theme.surface} onChange={(surface) => setContent({ ...content, theme: { ...content.theme, surface } })} />
                <Color label="Texto" value={content.theme.text} onChange={(text) => setContent({ ...content, theme: { ...content.theme, text } })} />
                <Color label="Texto secundário" value={content.theme.muted} onChange={(muted) => setContent({ ...content, theme: { ...content.theme, muted } })} />
                <label className="block pt-2"><span className="label">Fonte dos títulos</span>
                  <select className="input" value={content.theme.headingFont} onChange={(e) => setContent({ ...content, theme: { ...content.theme, headingFont: e.target.value as SiteContent["theme"]["headingFont"] } })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
                </label>
                <label className="block"><span className="label">Fonte dos textos</span>
                  <select className="input" value={content.theme.bodyFont} onChange={(e) => setContent({ ...content, theme: { ...content.theme, bodyFont: e.target.value as SiteContent["theme"]["bodyFont"] } })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
                </label>
                <label className="block"><span className="label">Cantos</span>
                  <select className="input" value={content.theme.radius} onChange={(e) => setContent({ ...content, theme: { ...content.theme, radius: e.target.value as "none" | "md" | "lg" } })}><option value="none">Retos</option><option value="md">Levemente arredondados</option><option value="lg">Arredondados</option></select>
                </label>
                <T label="Título para o Google (SEO)" value={content.seo.title} max={120} onChange={(title) => setContent({ ...content, seo: { ...content.seo, title } })} />
                <TA label="Descrição para o Google (SEO)" value={content.seo.description} max={300} rows={3} onChange={(description) => setContent({ ...content, seo: { ...content.seo, description } })} />
              </div>
            )}

            {tab === "business" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Use apenas dados públicos ou confirmados com a empresa.</p>
                <T label="Nome da empresa" value={content.business.name} onChange={(name) => setContent({ ...content, business: { ...content.business, name } })} />
                <T label="Telefone" value={content.business.phone} max={40} onChange={(phone) => setContent({ ...content, business: { ...content.business, phone } })} />
                <T label="WhatsApp (com DDD)" value={content.business.whatsapp} max={40} onChange={(whatsapp) => setContent({ ...content, business: { ...content.business, whatsapp } })} />
                <T label="E-mail" value={content.business.email} onChange={(email) => setContent({ ...content, business: { ...content.business, email } })} />
                <TA label="Endereço" value={content.business.address} max={300} rows={2} onChange={(address) => setContent({ ...content, business: { ...content.business, address } })} />
                <T label="Instagram (@usuario ou link)" value={content.business.instagram} max={200} onChange={(instagram) => setContent({ ...content, business: { ...content.business, instagram } })} />
                <T label="Link do mapa" value={content.business.mapsUrl} max={2000} onChange={(mapsUrl) => setContent({ ...content, business: { ...content.business, mapsUrl } })} />
              </div>
            )}

            {tab === "publish" && <PublishPanel projectId={props.projectId} pub={pub} setPub={setPub} publish={publish} unpublish={unpublish} busy={busy} premium={props.premium} rootDomain={props.rootDomain} hosting={props.hosting ?? null} defaultSlug={content.siteName} onRestored={() => location.reload()} />}

            {tab === "sales" && <SalesPanel projectId={props.projectId} premium={props.premium} hasPhone={!!props.companyPhone} initialMessage={props.initialOutreach} initialWhatsapp={props.initialWhatsapp} />}
          </div>
        </div>

        {/* Pré-visualização */}
        <div className="grid-bg flex justify-center bg-ink-900/50 p-4 sm:p-6 lg:h-[calc(100vh-65px)]">
          <div ref={tiltRef} className={`pframe-wrap flex h-[70vh] w-full justify-center lg:h-full ${view3d ? "is-3d" : ""}`}>
            <div className={`pframe flex h-full flex-col transition-all duration-500 ${device === "mobile" ? "w-[390px] max-w-full" : "w-full"}`}>
              <div className="pframe-chrome">
                <span className="dots"><b /><b /><b /></span>
                <span className="pframe-url">{pub?.status === "PUBLISHED" ? pub.url : "prévia local · não publicada"}</span>
                {unpublished && <span className="pframe-badge">PRÉVIA</span>}
              </div>
              <iframe ref={iframeRef} title="Pré-visualização do site" srcDoc={html} sandbox="allow-scripts allow-popups" className="w-full flex-1 bg-white" />
            </div>
          </div>
        </div>
      </div>
      {picker && <ImagePicker onPick={picker} onClose={() => setPicker(null)} />}
      {flowCb && <FlowAssistant segmentLabel={props.segmentLabel ?? props.projectName} niche={props.niche} palette={{ primary: content.theme.primary, accent: content.theme.accent }} onInsert={flowCb} onClose={() => setFlowCb(null)} />}
    </div>
    </AssetsCtx.Provider>
  );
}

function PublishPanel({ projectId, pub, setPub, publish, unpublish, busy, premium, rootDomain, hosting, defaultSlug, onRestored }: {
  hosting?: { kind: "vercel" | "github"; prefix: string } | null;
  projectId: string; pub: Pub; setPub: (p: Pub) => void; publish: (slug?: string) => Promise<void>; unpublish: () => Promise<void>; busy: boolean; premium: boolean; rootDomain: string; defaultSlug: string; onRestored: () => void;
}) {
  const [slug, setSlug] = useState(pub?.slug ?? defaultSlug.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48));
  const [domain, setDomain] = useState(pub?.customDomain ?? "");
  const [domainMsg, setDomainMsg] = useState<{ kind: "info" | "error" | "success"; text: string } | null>(null);
  const [versions, setVersions] = useState<{ id: string; note: string | null; createdAt: string }[] | null>(null);

  async function setCustomDomain() {
    try {
      const r = await api<{ target: string; domain: string }>(`/api/projects/${projectId}/domain`, { method: "PUT", body: { domain } });
      setDomainMsg({ kind: "info", text: `Crie no DNS do domínio um registro CNAME de ${r.domain} apontando para ${r.target}. Depois clique em “Verificar DNS”.` });
      if (pub) setPub({ ...pub, customDomain: r.domain, customDomainVerified: false });
    } catch (e) {
      setDomainMsg({ kind: "error", text: (e as Error).message });
    }
  }
  async function verify() {
    try {
      await api(`/api/projects/${projectId}/domain`, { method: "POST" });
      setDomainMsg({ kind: "success", text: "Domínio verificado! O certificado SSL é emitido automaticamente no primeiro acesso." });
      if (pub) setPub({ ...pub, customDomainVerified: true, url: `https://${pub.customDomain}` });
    } catch (e) {
      setDomainMsg({ kind: "error", text: (e as Error).message });
    }
  }
  async function loadVersions() {
    const r = await api<{ versions: { id: string; note: string | null; createdAt: string }[] }>(`/api/projects/${projectId}/versions`);
    setVersions(r.versions);
  }
  async function restore(id: string) {
    if (!confirm("Restaurar esta versão? O conteúdo atual será substituído (ele continua no histórico).")) return;
    await api(`/api/projects/${projectId}/versions/${id}`, { method: "POST" });
    onRestored();
  }

  return (
    <div className="space-y-4">
      <VisibilityCard pub={pub} slug={slug} setSlug={setSlug} rootDomain={rootDomain} hosting={hosting ?? null} busy={busy} premium={premium} publish={publish} unpublish={unpublish} />

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <span className="label">Domínio próprio (opcional)</span>
        <div className="flex gap-2"><input className="input" placeholder="www.empresa.com.br" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={!pub} /><button className="btn-secondary shrink-0 py-2 text-xs" disabled={!pub || !premium || !domain} onClick={setCustomDomain}>Salvar</button></div>
        {pub?.customDomain && !pub.customDomainVerified && <button className="btn-secondary mt-2 w-full py-2 text-xs" onClick={verify}>Verificar DNS</button>}
        {pub?.customDomainVerified && <p className="mt-2 text-xs text-emerald-300">✓ {pub.customDomain} verificado</p>}
        {!pub && <p className="mt-2 text-xs text-slate-500">Publique o site para conectar um domínio.</p>}
        {domainMsg && <div className="mt-2"><Alert kind={domainMsg.kind}>{domainMsg.text}</Alert></div>}
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <span className="label">Arquivos e recuperação</span>
        <a href={`/api/projects/${projectId}/export`} className="btn-secondary w-full py-2 text-xs">Exportar arquivos do site (.zip)</a>
        <p className="mt-2 text-xs text-slate-500">Permite levar o site do cliente para outra hospedagem. A hospedagem na plataforma depende da sua assinatura ativa.</p>
        <button className="btn-ghost mt-2 w-full py-2 text-xs" onClick={loadVersions}>Ver histórico de versões</button>
        {versions && (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-2 py-1.5">
                <span className="text-slate-400">{new Date(v.createdAt).toLocaleString("pt-BR")} · {v.note}</span>
                <button className="text-brand-300 hover:text-brand-200" disabled={!premium} onClick={() => restore(v.id)}>Restaurar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Avisos automáticos de contraste (o renderizador já corrige o texto dos botões, mas avisa o resto). */
function ContrastNote({ theme }: { theme: SiteContent["theme"] }) {
  const issues = [
    contrast(theme.text, theme.background) < 4.5 && "Texto e fundo têm pouco contraste.",
    contrast(theme.text, theme.surface) < 4.5 && "Texto e fundo alternativo têm pouco contraste.",
    contrast(theme.accent, theme.background) < 1.4 && "Os botões quase se confundem com o fundo.",
  ].filter(Boolean) as string[];
  if (!issues.length) return <p className="text-xs text-emerald-300/80">✓ Contraste verificado: textos legíveis no fundo escolhido.</p>;
  return <Alert kind="warn">{issues.join(" ")}</Alert>;
}

/** Visibilidade: prévia privada (padrão) × site público por link. Publicar ou retirar exige confirmação. */
function VisibilityCard({ pub, slug, setSlug, rootDomain, hosting, busy, premium, publish, unpublish }: {
  hosting: { kind: "vercel" | "github"; prefix: string } | null;
  pub: Pub; slug: string; setSlug: (s: string) => void; rootDomain: string; busy: boolean; premium: boolean; publish: (slug?: string) => Promise<void>; unpublish: () => Promise<void>;
}) {
  const [step, setStep] = useState<null | "publish" | "unpublish">(null);
  const isPublic = pub?.status === "PUBLISHED";
  const suspended = pub?.status === "SUSPENDED";
  const vercel = hosting?.kind === "vercel";
  const preview = vercel ? `${hosting!.prefix}-${slug || "seu-site"}.vercel.app` : `${slug || "seu-site"}.${rootDomain}`;
  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 transition-colors duration-500 ${isPublic ? "border-emerald-400/30 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${isPublic ? "bg-emerald-500/15 text-emerald-300 vis-pulse" : "bg-white/5 text-slate-300"}`} aria-hidden>{isPublic ? "◉" : "🔒"}</span>
        <div className="min-w-0">
          <p className="font-semibold text-white">{isPublic ? "Site público" : suspended ? "Suspenso" : "Prévia privada"}</p>
          <p className="text-xs text-slate-400">
            {isPublic ? "Qualquer pessoa com o link vê somente esta página. Painel, leads, outras prévias e configurações continuam privados." : suspended ? "Fora do ar porque o acesso da conta não está ativo." : "Só você vê esta prévia, dentro do painel. Nada está na internet."}
          </p>
        </div>
      </div>

      {isPublic && pub && (
        <div className="mt-4 space-y-2 animate-fade-up">
          <a href={pub.url} target="_blank" rel="noopener noreferrer" className="block truncate rounded-lg bg-black/30 px-3 py-2 text-sm text-emerald-200 hover:underline">{pub.url}</a>
          {pub.provider === "vercel" && (
            <p className={`text-xs ${pub.verified ? "text-emerald-300" : "text-amber-300"}`} data-link-status>
              {pub.verified ? "Link na Vercel verificado: o servidor abriu esta URL pela internet e a página respondeu." : "Link na Vercel criado, mas ainda não confirmado: aguarde alguns segundos e use Atualizar, ou abra o link para conferir."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(pub.url); toast("Link copiado"); } catch { toast(pub.url); } }}>Copiar link</button>
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={busy || !premium} onClick={() => publish(slug)}>{busy ? <Spinner /> : null}Atualizar com as alterações</button>
          </div>
          <p className="text-xs text-slate-500">Alternativo: <a className="underline" href={pub.pathUrl} target="_blank" rel="noopener noreferrer">{pub.pathUrl}</a>{pub.lastDeployAt ? ` · atualizado em ${new Date(pub.lastDeployAt).toLocaleString("pt-BR")}` : ""}</p>
        </div>
      )}

      {!isPublic && (
        <label className="mt-4 block">
          <span className="label">Endereço do link (quando liberar)</span>
          <div className="flex items-center gap-1 text-sm">
            <input className="input" value={slug} maxLength={48} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} aria-label="Endereço do link" />
            <span className="shrink-0 text-slate-500">{vercel ? `.vercel.app (começa com ${hosting!.prefix}-)` : `.${rootDomain}`}</span>
          </div>
        </label>
      )}

      {step === "publish" ? (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-3 text-sm animate-fade-up" role="alertdialog" aria-label="Confirmar link público">
          <p className="font-semibold text-amber-100">Liberar link público?</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-100/90">
            <li>Fica público: <b>somente esta página</b>, em {preview}{vercel ? ", um endereço da Vercel que abre em qualquer celular" : ""}.</li>
            <li>Continuam privados: painel, leads, rascunhos, outras prévias e configurações.</li>
            <li>A página pede aos buscadores que não a indexem. Você pode retirar o acesso a qualquer momento.</li>
          </ul>
          <div className="flex gap-2">
            <button className="btn-primary px-3 py-2 text-xs" disabled={busy || !premium} onClick={async () => { await publish(slug); setStep(null); }}>{busy ? <Spinner /> : null}Confirmar e liberar</button>
            <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setStep(null)}>Cancelar</button>
          </div>
        </div>
      ) : step === "unpublish" ? (
        <div className="mt-4 space-y-3 rounded-xl border border-red-400/30 bg-red-500/[0.07] p-3 text-sm animate-fade-up" role="alertdialog" aria-label="Confirmar retirada do acesso">
          <p className="font-semibold text-red-100">Retirar o acesso público?</p>
          <p className="text-xs text-red-100/80">O link para de funcionar imediatamente. A prévia continua salva e privada no painel.</p>
          <div className="flex gap-2">
            <button className="btn-danger px-3 py-2 text-xs" disabled={busy} onClick={async () => { await unpublish(); setStep(null); }}>{busy ? <Spinner /> : null}Retirar acesso</button>
            <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setStep(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {isPublic ? (
            <button className="btn-danger w-full py-2 text-xs" disabled={busy} onClick={() => setStep("unpublish")}>Retirar acesso público</button>
          ) : (
            <button className="btn-primary w-full py-2 text-xs" disabled={busy || !premium} onClick={() => setStep("publish")}>Liberar link público…</button>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">“Salvar” guarda o rascunho privado. O link público só muda quando você confirma a publicação ou a atualização.</p>
    </div>
  );
}

function SalesPanel({ projectId, premium, hasPhone, initialMessage, initialWhatsapp }: { projectId: string; premium: boolean; hasPhone: boolean; initialMessage: string; initialWhatsapp: string | null }) {
  const [message, setMessage] = useState(initialMessage);
  const [wa, setWa] = useState<string | null>(initialWhatsapp);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ message: string; whatsapp: string | null }>(`/api/projects/${projectId}/outreach`, { method: "POST" });
      setMessage(r.message);
      setWa(r.whatsapp);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function persist() {
    const r = await api<{ whatsapp: string | null }>(`/api/projects/${projectId}/outreach`, { method: "PUT", body: { message } });
    setWa(r.whatsapp);
    return r.whatsapp;
  }
  async function proposal() {
    setCreating(true);
    setError(null);
    try {
      const r = await api<{ proposal: { id: string } }>("/api/proposals", { body: { projectId } });
      location.href = `/app/propostas/${r.proposal.id}`;
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <span className="label">Criar proposta comercial</span>
        <p className="mb-3 text-xs text-slate-500">A IA escreve resumo, benefícios e funcionalidades. Preços, prazos e condições vêm das suas configurações e podem ser editados.</p>
        <button className="btn-primary w-full py-2 text-xs" disabled={!premium || creating} onClick={proposal}>{creating && <Spinner />}Criar proposta comercial</button>
      </div>
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <span className="label">Mensagem de abordagem</span>
        <button className="btn-secondary w-full py-2 text-xs" disabled={!premium || loading} onClick={generate}>{loading && <Spinner />}Preparar mensagem de abordagem</button>
        <textarea className="input mt-3" rows={6} maxLength={1500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A mensagem aparece aqui para você revisar." />
        <div className="mt-2 flex gap-2">
          <button className="btn-secondary flex-1 py-2 text-xs" disabled={!message} onClick={() => { navigator.clipboard.writeText(message); toast("Mensagem copiada"); }}>Copiar</button>
          <button
            className="btn-primary flex-1 bg-none bg-[#1fa855] py-2 text-xs shadow-none hover:bg-[#25d366]"
            disabled={!message || !hasPhone || !premium}
            onClick={async () => { const link = await persist(); if (link) window.open(link, "_blank", "noopener"); else toast("Telefone da empresa inválido para WhatsApp."); }}
          >
            Abrir no WhatsApp
          </button>
        </div>
        {!hasPhone && <p className="mt-2 text-xs text-slate-500">A fonte de dados não informou telefone desta empresa.</p>}
        {wa === null && hasPhone && message && <p className="mt-2 text-xs text-slate-500">Confira se o número comercial é um WhatsApp antes de enviar.</p>}
        <p className="mt-2 text-xs text-slate-500">Nada é enviado automaticamente: o WhatsApp abre com o texto e você decide se envia. Respeite as regras do WhatsApp e a LGPD — não faça envios em massa e respeite quem pedir para não ser contatado.</p>
      </div>
    </div>
  );
}
