"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FlowAssistant } from "@/components/studio/FlowAssistant";
import { api } from "@/components/api";
import { Alert, Spinner, StatusBadge, toast } from "@/components/ui";
import { renderSite } from "@/lib/site/render";
import { FONTS, IMAGE_ORIGINS, type ImageOrigin, type Section, type SiteButton, type SiteContent, type SiteImage } from "@/lib/site/types";
import { emptySection } from "@/lib/site/templates";

type Pub = { status: string; slug: string; url: string; pathUrl: string; customDomain: string | null; customDomainVerified: boolean; lastDeployAt: string | null } | null;

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
          <img src={value.url} alt={value.alt} className="h-28 w-full object-cover" />
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
  }
}

// ---------- Busca de imagens ----------
type Img = SiteImage & { thumb: string; downloadLocation: string };
function ImagePicker({ onPick, onClose }: { onPick: (i: SiteImage) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Img[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const r = await api<{ configured: boolean; images: Img[] }>(`/api/images/search?q=${encodeURIComponent(q)}`);
      if (!r.configured) setMsg("Banco de imagens não configurado (UNSPLASH_ACCESS_KEY). Cole a URL de uma imagem autorizada.");
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
        <div className="flex items-center justify-between"><h3 className="font-semibold text-white">Banco de imagens (Unsplash)</h3><button className="btn-ghost px-2" onClick={onClose}>✕</button></div>
        <form onSubmit={search} className="mt-3 flex gap-2"><input autoFocus className="input" placeholder="Ex.: barbearia, comida, dentista (em inglês costuma ter mais resultados)" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-primary" disabled={loading || q.length < 2}>{loading ? <Spinner /> : "Buscar"}</button></form>
        {msg && <div className="mt-3"><Alert kind="info">{msg}</Alert></div>}
        <div className="mt-4 grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {items.map((i) => (
            <button key={i.url} className="group relative overflow-hidden rounded-xl" onClick={() => { void api("/api/images/search", { body: { downloadLocation: i.downloadLocation } }).catch(() => undefined); onPick({ url: i.url, alt: i.alt, credit: i.credit, origin: "stock", license: "Licença Unsplash (uso gratuito, com crédito ao fotógrafo)", sourceUrl: i.credit?.link }); onClose(); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.thumb} alt={i.alt} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[10px] text-white">{i.credit?.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Fotos do Unsplash, com crédito ao fotógrafo exibido no site.</p>
      </div>
    </div>
  );
}

// ---------- Editor principal ----------
export function Editor(props: {
  projectId: string; projectName: string; initialContent: SiteContent; aiGenerated: boolean; premium: boolean; imagesEnabled: boolean; rootDomain: string;
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
      const r = await api<{ publication: NonNullable<Pub> & { customDomainVerifiedAt?: string } }>(`/api/projects/${props.projectId}/publish`, { body: { slug } });
      setPub({ ...r.publication, customDomainVerified: !!r.publication.customDomainVerifiedAt });
      toast(pub?.status === "PUBLISHED" ? "Site atualizado na internet" : "Site publicado!");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function unpublish() {
    if (!confirm("Retirar o site do ar? O endereço ficará indisponível até você publicar novamente.")) return;
    setBusy(true);
    try {
      await api(`/api/projects/${props.projectId}/publish`, { method: "DELETE" });
      setPub((p) => (p ? { ...p, status: "UNPUBLISHED" } : p));
      toast("Site despublicado");
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
        {pub?.status === "PUBLISHED" ? (
          <button className="btn-primary py-2" onClick={() => publish()} disabled={busy || !props.premium}>{busy && <Spinner />}Atualizar site</button>
        ) : (
          <button className="btn-primary py-2" onClick={() => publish()} disabled={busy || !props.premium}>{busy && <Spinner />}Publicar site</button>
        )}
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

            {tab === "publish" && <PublishPanel projectId={props.projectId} pub={pub} setPub={setPub} publish={publish} unpublish={unpublish} busy={busy} premium={props.premium} rootDomain={props.rootDomain} defaultSlug={content.siteName} onRestored={() => location.reload()} />}

            {tab === "sales" && <SalesPanel projectId={props.projectId} premium={props.premium} hasPhone={!!props.companyPhone} initialMessage={props.initialOutreach} initialWhatsapp={props.initialWhatsapp} />}
          </div>
        </div>

        {/* Pré-visualização */}
        <div className="grid-bg flex justify-center bg-ink-900/50 p-4 sm:p-6 lg:h-[calc(100vh-65px)]">
          <div className={`pframe-wrap flex h-[70vh] w-full justify-center lg:h-full ${view3d ? "is-3d" : ""}`}>
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

function PublishPanel({ projectId, pub, setPub, publish, unpublish, busy, premium, rootDomain, defaultSlug, onRestored }: {
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
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <span className="label">Endereço público</span>
        <div className="flex items-center gap-1 text-sm">
          <input className="input" value={slug} maxLength={48} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
          <span className="shrink-0 text-slate-500">.{rootDomain}</span>
        </div>
        {pub && (
          <div className="mt-3 space-y-1 text-sm">
            <p className="flex items-center gap-2">Status: <StatusBadge status={pub.status} /></p>
            {pub.status === "PUBLISHED" && (
              <>
                <a href={pub.url} target="_blank" rel="noopener noreferrer" className="block truncate text-brand-300 hover:underline">{pub.url}</a>
                <button className="text-xs text-slate-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(pub.url); toast("Endereço copiado"); }}>Copiar endereço</button>
                <p className="text-xs text-slate-500">Endereço alternativo: <a className="underline" href={pub.pathUrl} target="_blank" rel="noopener noreferrer">{pub.pathUrl}</a></p>
              </>
            )}
            {pub.status === "SUSPENDED" && <p className="text-xs text-amber-300">Suspenso porque a assinatura não está ativa. Volta ao ar automaticamente após a renovação.</p>}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary py-2 text-xs" disabled={busy || !premium} onClick={() => publish(slug)}>{pub?.status === "PUBLISHED" ? "Atualizar site" : "Publicar site"}</button>
          {pub?.status === "PUBLISHED" && <button className="btn-secondary py-2 text-xs" disabled={busy} onClick={unpublish}>Despublicar</button>}
        </div>
        <p className="mt-3 text-xs text-slate-500">“Salvar” guarda o rascunho. O site na internet só muda quando você clica em “Publicar/Atualizar site”.</p>
      </div>

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
