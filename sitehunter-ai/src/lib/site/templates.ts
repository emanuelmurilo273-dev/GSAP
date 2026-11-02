import { z } from "zod";
import { FONTS, type Section, type SiteContent, type SiteImage, type Theme } from "./types";
import { ICON_NAMES } from "./icons";
import { COPY, fill } from "./copyLibrary";

export type TemplateKey = "restaurant" | "barber" | "clinic" | "mechanic" | "store" | "services";
export type Style = SiteContent["style"];

export type Segment = {
  key: string;
  label: string;
  singular?: string;
  query: string; // termo usado na busca de empresas
  placesType?: string; // tipo da Google Places API (Tabela A)
  template: TemplateKey;
  style: Style;
  icon: string;
  imageQuery: string; // busca de imagens no banco autorizado (Unsplash)
  theme: Theme;
};

const dark = (primary: string, accent: string, headingFont: Theme["headingFont"], bodyFont: Theme["bodyFont"], bg = "#0c0d10", sf = "#15171c", tx = "#f4f1ea", mu = "#a7a39a"): Theme => ({ primary, accent, background: bg, surface: sf, text: tx, muted: mu, headingFont, bodyFont, radius: "md" });
const light = (primary: string, accent: string, headingFont: Theme["headingFont"], bodyFont: Theme["bodyFont"], bg = "#ffffff", sf = "#f4f6fa", tx = "#101828", mu = "#526075"): Theme => ({ primary, accent, background: bg, surface: sf, text: tx, muted: mu, headingFont, bodyFont, radius: "lg" });

export const SEGMENTS: Segment[] = [
  { key: "barbearia", label: "Barbearias", singular: "Barbearia", query: "barbearia", placesType: "barber_shop", template: "barber", style: "bold", icon: "scissors", imageQuery: "barbershop", theme: dark("#8a6a2f", "#d9b26a", "Bebas Neue", "DM Sans", "#0b0b0c", "#141416") },
  { key: "salao", label: "Salões de beleza", singular: "Salão de beleza", query: "salão de beleza", placesType: "beauty_salon", template: "barber", style: "editorial", icon: "sparkles", imageQuery: "beauty salon", theme: light("#9d2b5e", "#f2b8cf", "Playfair Display", "Lato", "#fdf8f6", "#f7ece8", "#2a1620", "#7a5f69") },
  { key: "restaurante", label: "Restaurantes", singular: "Restaurante", query: "restaurante", placesType: "restaurant", template: "restaurant", style: "elegant", icon: "utensils", imageQuery: "restaurant food", theme: dark("#7a2516", "#e2a857", "Playfair Display", "Lato", "#130d0a", "#1c1410", "#f4ebdd", "#bfae95") },
  { key: "odontologia", label: "Clínicas odontológicas", singular: "Clínica odontológica", query: "clínica odontológica", placesType: "dentist", template: "clinic", style: "clean", icon: "tooth", imageQuery: "dental clinic", theme: light("#0b5cad", "#5ee0c8", "Poppins", "Nunito") },
  { key: "clinica", label: "Clínicas e consultórios", singular: "Clínica", query: "clínica", placesType: "doctor", template: "clinic", style: "clean", icon: "stethoscope", imageQuery: "medical clinic", theme: light("#0f6b7a", "#7fe3a8", "Poppins", "Nunito") },
  { key: "academia", label: "Academias", singular: "Academia", query: "academia", placesType: "gym", template: "services", style: "bold", icon: "dumbbell", imageQuery: "gym fitness", theme: dark("#c2410c", "#facc15", "Oswald", "Roboto", "#0a0a0b", "#141416") },
  { key: "oficina", label: "Oficinas mecânicas", singular: "Oficina mecânica", query: "oficina mecânica", placesType: "car_repair", template: "mechanic", style: "industrial", icon: "wrench", imageQuery: "car mechanic workshop", theme: dark("#1d4ed8", "#f59e0b", "Oswald", "Roboto", "#0d1117", "#151b24", "#eef2f7", "#93a1b5") },
  { key: "roupas", label: "Lojas de roupas", singular: "Loja de roupas", query: "loja de roupas", placesType: "clothing_store", template: "store", style: "editorial", icon: "shirt", imageQuery: "clothing store", theme: light("#1c1917", "#e9c7a5", "Playfair Display", "DM Sans", "#faf7f2", "#f1ebe2", "#1c1917", "#6b625a") },
  { key: "imobiliaria", label: "Imobiliárias", singular: "Imobiliária", query: "imobiliária", placesType: "real_estate_agency", template: "services", style: "corporate", icon: "home", imageQuery: "house real estate", theme: light("#13315c", "#f2c14e", "Montserrat", "Open Sans") },
  { key: "servicos", label: "Prestadores de serviços", singular: "Prestador de serviços", query: "prestador de serviços", template: "services", style: "corporate", icon: "briefcase", imageQuery: "professional service", theme: light("#1d4ed8", "#38d9f5", "DM Sans", "Open Sans") },
  { key: "petshop", label: "Pet shops", singular: "Pet shop", query: "pet shop", placesType: "pet_store", template: "store", style: "clean", icon: "paw", imageQuery: "pet shop dog", theme: light("#0f766e", "#fbbf24", "Nunito", "Nunito") },
  { key: "padaria", label: "Padarias", singular: "Padaria", query: "padaria", placesType: "bakery", template: "restaurant", style: "elegant", icon: "bread", imageQuery: "bakery bread", theme: light("#7c3f12", "#f2b25c", "Lora", "Lato", "#fbf6ee", "#f3e9da", "#2b1d12", "#7a6450") },
  { key: "construcao", label: "Empresas de construção", singular: "Construtora", query: "construtora", placesType: "general_contractor", template: "services", style: "industrial", icon: "hammer", imageQuery: "construction", theme: dark("#a16207", "#facc15", "Oswald", "Open Sans", "#101010", "#191919", "#f2f2ef", "#a3a39a") },
];

export function getSegment(key: string | null | undefined): Segment {
  return SEGMENTS.find((s) => s.key === key) ?? SEGMENTS.find((s) => s.key === "servicos")!;
}

const s = (max: number) => z.string().max(max);
const iconName = z.string().max(30).transform((v) => (ICON_NAMES.includes(v) ? v : "star"));

/** Formato do texto gerado pela IA (ou pelo modelo padrão). Somente conteúdo — a estrutura vem do modelo do segmento. */
export const SiteCopySchema = z.object({
  siteName: s(120),
  tagline: s(140).default(""),
  seoTitle: s(120),
  seoDescription: s(300),
  heroTitle: s(160),
  heroSubtitle: s(400),
  primaryCta: s(60),
  marquee: z.array(s(60)).max(8).default([]),
  highlights: z.array(z.object({ icon: iconName, title: s(80), text: s(300) })).max(6).default([]),
  aboutTitle: s(120),
  aboutText: s(2000),
  servicesTitle: s(120),
  servicesIntro: s(600),
  services: z.array(z.object({ title: s(100), description: s(400), icon: iconName.optional(), price: s(30).optional() })).max(16),
  menuCategories: z.array(z.object({ name: s(80), items: z.array(z.object({ name: s(100), description: s(300), price: s(30).optional() })).max(20) })).max(8),
  steps: z.array(z.object({ title: s(80), text: s(300) })).max(5).default([]),
  faq: z.array(z.object({ q: s(200), a: s(800) })).max(6).default([]),
  ctaTitle: s(160),
  ctaText: s(500),
  contactText: s(500),
  quoteTitle: s(120),
  quoteText: s(500),
  colors: z.object({ primary: z.string(), accent: z.string() }),
  headingFont: z.enum(FONTS),
  bodyFont: z.enum(FONTS),
  outreach: s(1200).default(""),
});
export type SiteCopy = z.infer<typeof SiteCopySchema>;

export type CompanyInfo = {
  name: string;
  category?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Horários reais informados pela fonte (ex.: "segunda-feira: 11:00–15:00"). */
  hours?: string[] | null;
  instagram?: string | null;
};

const isHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);

let idCounter = 0;
export const sid = (type: string) => `${type}-${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Converte "segunda-feira: 11:00–15:00" em linhas de horário (apenas dados reais da fonte). */
export function hoursToLines(hours: string[] | null | undefined) {
  return (hours ?? [])
    .map((h) => {
      const i = h.indexOf(":");
      if (i < 0) return null;
      const label = h.slice(0, i).trim();
      const value = h.slice(i + 1).trim();
      return label && value ? { label: label.charAt(0).toUpperCase() + label.slice(1), value } : null;
    })
    .filter((x): x is { label: string; value: string } => !!x)
    .slice(0, 10);
}

export function buildSiteContent(company: CompanyInfo, segment: Segment, copy: SiteCopy, images: SiteImage[] = []): SiteContent {
  const theme: Theme = {
    ...segment.theme,
    // A IA pode ajustar as cores principais; fundos e textos seguem o estilo do segmento (contraste garantido).
    primary: isHex(copy.colors.primary) ? copy.colors.primary : segment.theme.primary,
    accent: isHex(copy.colors.accent) ? copy.colors.accent : segment.theme.accent,
    headingFont: copy.headingFont,
    bodyFont: copy.bodyFont,
  };
  const hasPhone = !!company.phone;
  const mainAction = hasPhone ? ("whatsapp" as const) : ("section" as const);
  // Fotos: 1ª na capa, 2ª no "sobre"; as seguintes ilustram serviços/produtos; a galeria reúne todas (menos a capa).
  const [heroImg, aboutImg] = images;
  const extra = images.slice(2);
  const galleryImgs = images.slice(1, 10);
  const imgFor = (i: number) => (extra.length ? extra[i % extra.length] : undefined);
  const realHours = hoursToLines(company.hours);

  const hero: Section = {
    id: "inicio",
    type: "hero",
    visible: true,
    title: copy.heroTitle,
    subtitle: copy.heroSubtitle,
    image: heroImg,
    buttons: [
      { label: copy.primaryCta || "Fale conosco", action: mainAction, href: hasPhone ? undefined : "contato" },
      segment.template === "restaurant" ? { label: "Ver cardápio", action: "section" as const, href: "cardapio" } : company.mapsUrl || company.address ? { label: "Como chegar", action: "maps" as const } : { label: "Saiba mais", action: "section" as const, href: "sobre" },
    ],
  };
  const highlights: Section = { id: "destaques", type: "highlights", visible: copy.highlights.length > 0, title: "", items: copy.highlights };
  const about: Section = { id: "sobre", type: "about", visible: true, title: copy.aboutTitle, text: copy.aboutText, image: aboutImg };
  const services: Section = {
    id: "servicos",
    type: "services",
    visible: true,
    title: copy.servicesTitle,
    intro: copy.servicesIntro,
    items: copy.services.map((x, i) => ({ title: x.title, description: x.description, icon: x.icon ?? segment.icon, ...(x.price ? { price: x.price } : {}), ...(extra.length >= 2 && i < extra.length ? { image: imgFor(i) } : {}) })),
  };
  const hours: Section = {
    id: "horarios",
    type: "hours",
    visible: true,
    title: "Horário de funcionamento",
    lines: realHours.length ? realHours : [{ label: "Segunda a sexta", value: "" }, { label: "Sábado", value: "" }, { label: "Domingo", value: "" }],
    note: realHours.length ? "Horários informados pela empresa no Google. Em feriados, confirme pelo WhatsApp." : "",
  };
  const gallery: Section = { id: "galeria", type: "gallery", visible: galleryImgs.length > 0, title: segment.template === "restaurant" ? "Nosso ambiente" : "Galeria de fotos", images: galleryImgs };
  const steps: Section = { id: "como-funciona", type: "steps", visible: copy.steps.length > 0, title: segment.template === "restaurant" ? "Como fazer seu pedido" : segment.template === "clinic" || segment.template === "barber" ? "Como agendar" : "Como funciona", intro: "", items: copy.steps };
  const faq: Section = { id: "duvidas", type: "faq", visible: copy.faq.length > 0, title: "Perguntas frequentes", items: copy.faq };
  const cta: Section = { id: "chamada", type: "cta", visible: true, title: copy.ctaTitle, text: copy.ctaText, button: { label: copy.primaryCta || "Fale conosco", action: mainAction, href: hasPhone ? undefined : "contato" } };
  const quote: Section = { id: "orcamento", type: "quote", visible: true, title: copy.quoteTitle || "Solicite um orçamento", text: copy.quoteText, buttonLabel: "Enviar pelo WhatsApp" };
  const contact: Section = { id: "contato", type: "contact", visible: true, title: "Contato e localização", text: copy.contactText, showMap: !!(company.mapsUrl || company.address) };
  const menu: Section = {
    id: "cardapio",
    type: "menu",
    visible: true,
    title: segment.key === "padaria" ? "Nossos produtos" : "Cardápio",
    intro: copy.servicesIntro || "Conheça nossas opções.",
    categories: copy.menuCategories.map((cat) => ({ name: cat.name, items: cat.items.map((i) => ({ name: i.name, description: i.description, price: i.price ?? "" })) })),
  };
  const products: Section = { id: "produtos", type: "products", visible: true, title: copy.servicesTitle, intro: copy.servicesIntro, items: copy.services.map((x, i) => ({ name: x.title, description: x.description, ...(extra.length ? { image: imgFor(i) } : {}) })) };

  const byTemplate: Record<TemplateKey, Section[]> = {
    restaurant: [hero, highlights, about, menu, steps, hours, gallery, faq, cta, contact],
    barber: [hero, services, highlights, about, steps, hours, gallery, faq, cta, contact],
    clinic: [hero, highlights, { ...services, title: copy.servicesTitle || "Especialidades" }, about, gallery, steps, hours, faq, cta, contact],
    mechanic: [hero, services, highlights, steps, about, gallery, quote, hours, faq, contact],
    store: [hero, products, highlights, about, hours, gallery, faq, cta, contact],
    services: [hero, services, highlights, steps, about, gallery, quote, hours, faq, contact],
  };

  const pricesMissing = segment.template === "restaurant" && copy.menuCategories.some((c) => c.items.some((i) => !i.price));
  return {
    version: 1,
    siteName: copy.siteName || company.name,
    style: segment.style,
    tagline: copy.tagline,
    icon: segment.icon,
    marquee: copy.marquee,
    seo: { title: copy.seoTitle || company.name, description: copy.seoDescription },
    theme,
    business: {
      name: company.name,
      phone: company.phone ?? "",
      whatsapp: company.phone ?? "",
      email: "",
      address: company.address ?? "",
      instagram: company.instagram ?? "",
      mapsUrl: company.mapsUrl ?? "",
      lat: company.lat ?? null,
      lng: company.lng ?? null,
    },
    sections: byTemplate[segment.template],
    reviewNotes: [
      segment.template === "restaurant" ? "Os pratos do cardápio são sugestões típicas do tipo de cozinha: confirme os itens com a empresa." : "Os serviços listados são sugestões típicas do segmento: confirme com a empresa.",
      ...(pricesMissing ? ["Preços em branco não aparecem no site. Preencha só com valores confirmados."] : []),
      ...(realHours.length ? [] : ["A fonte não informou horários: preencha em Horários (linhas vazias ficam ocultas)."]),
      ...(company.phone ? [] : ["A fonte não informou telefone: adicione um contato em 'Empresa'."]),
      ...(images.some((i) => i.credit?.source === "google") ? ["As fotos vêm do Google Maps com o crédito do autor. Para uso comercial, prefira fotos enviadas ou autorizadas pela empresa."] : []),
    ],
  };
}

/** Textos-modelo profissionais por segmento (sem IA). Usa só dados reais da empresa e nada inventado. */
export function fallbackCopy(company: CompanyInfo, segment: Segment): SiteCopy {
  const lib = COPY[segment.key] ?? COPY.servicos!;
  const onde = [company.neighborhood, company.city].filter(Boolean).join(", ");
  const vars = { nome: company.name, onde, cidade: company.city ?? "" };
  const f = (t: string) => fill(t, vars);
  const iconOk = (n: string) => (ICON_NAMES.includes(n) ? n : "star");
  return {
    siteName: company.name,
    tagline: f(lib.tagline),
    seoTitle: `${company.name}${onde ? ` | ${segment.singular ?? segment.label} em ${onde}` : ""}`.slice(0, 120),
    seoDescription: `${company.name}${onde ? `, ${(segment.singular ?? segment.label).toLowerCase()} em ${onde}` : ""}. ${f(lib.heroSubtitle)}`.slice(0, 300),
    heroTitle: f(lib.heroTitle),
    heroSubtitle: f(lib.heroSubtitle),
    primaryCta: company.phone ? lib.primaryCta : "Entrar em contato",
    marquee: lib.marquee,
    highlights: lib.highlights.map((h) => ({ ...h, icon: iconOk(h.icon), text: f(h.text) })),
    aboutTitle: f(lib.aboutTitle),
    aboutText: f(lib.aboutText),
    servicesTitle: lib.servicesTitle,
    servicesIntro: f(lib.servicesIntro),
    services: lib.services.map((x) => ({ ...x, icon: iconOk(x.icon) })),
    menuCategories: lib.menu ?? [],
    steps: lib.steps,
    faq: lib.faq,
    ctaTitle: f(lib.ctaTitle),
    ctaText: f(lib.ctaText),
    contactText: `Fale com a ${company.name} pelos canais abaixo.`,
    quoteTitle: lib.quoteTitle ?? "Solicite um orçamento",
    quoteText: lib.quoteText ?? "Conte o que você precisa e responderemos pelo WhatsApp.",
    colors: { primary: segment.theme.primary, accent: segment.theme.accent },
    headingFont: segment.theme.headingFont,
    bodyFont: segment.theme.bodyFont,
    outreach: "",
  };
}

/** Completa campos que a IA deixou vazios com os textos-modelo do segmento. */
export function completeCopy(copy: SiteCopy, company: CompanyInfo, segment: Segment): SiteCopy {
  const base = fallbackCopy(company, segment);
  const out = { ...copy } as Record<string, unknown>;
  for (const [k, v] of Object.entries(base)) {
    const cur = out[k];
    if (cur === undefined || cur === "" || (Array.isArray(cur) && cur.length === 0 && Array.isArray(v) && v.length > 0)) out[k] = v;
  }
  return out as SiteCopy;
}

/** Seção vazia para o botão "Adicionar seção" do editor. */
export function emptySection(type: Section["type"]): Section {
  const id = sid(type);
  switch (type) {
    case "hero": return { id, type, visible: true, title: "Título", subtitle: "Subtítulo", buttons: [] };
    case "about": return { id, type, visible: true, title: "Sobre nós", text: "" };
    case "services": return { id, type, visible: true, title: "Serviços", intro: "", items: [{ title: "Serviço", description: "" }] };
    case "highlights": return { id, type, visible: true, title: "", items: [{ icon: "star", title: "Destaque", text: "" }] };
    case "steps": return { id, type, visible: true, title: "Como funciona", intro: "", items: [{ title: "Primeiro passo", text: "" }] };
    case "faq": return { id, type, visible: true, title: "Perguntas frequentes", items: [{ q: "Pergunta", a: "Resposta" }] };
    case "menu": return { id, type, visible: true, title: "Cardápio", intro: "", categories: [{ name: "Categoria", items: [{ name: "Item", description: "", price: "" }] }] };
    case "products": return { id, type, visible: true, title: "Produtos", intro: "", items: [{ name: "Produto", description: "" }] };
    case "hours": return { id, type, visible: true, title: "Horários", lines: [{ label: "Segunda a sexta", value: "" }], note: "" };
    case "gallery": return { id, type, visible: true, title: "Galeria", images: [] };
    case "cta": return { id, type, visible: true, title: "Fale com a gente", text: "", button: { label: "Entrar em contato", action: "whatsapp" } };
    case "quote": return { id, type, visible: true, title: "Solicite um orçamento", text: "", buttonLabel: "Enviar pelo WhatsApp" };
    case "contact": return { id, type, visible: true, title: "Contato", text: "", showMap: true };
    case "text": return { id, type, visible: true, title: "Título", text: "" };
  }
}
