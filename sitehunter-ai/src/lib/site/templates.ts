import { timezoneFor } from "./openHours";
import { nicheOf } from "./nicheProfile";
import { z } from "zod";
import { placePhrase, sectorCopy, usableOwnDescription } from "./copyLibrary";
import { FONTS, type Section, type SiteContent, type SiteImage, type Theme } from "./types";
import { STYLE_INFO, styleForSegment, type SiteStyle } from "./styles";
import { objectKindFor } from "./stage";
import { buildConcept } from "./immersive/concept";

export type TemplateKey = "restaurant" | "barber" | "clinic" | "mechanic" | "store" | "services";

export type Segment = {
  key: string;
  label: string;
  query: string; // termo usado na busca de empresas
  placesType?: string; // tipo da Google Places API (Tabela A)
  template: TemplateKey;
  imageQuery: string; // busca de imagens no banco autorizado (Unsplash)
  theme: Theme;
};

const t = (primary: string, accent: string, headingFont: Theme["headingFont"], bodyFont: Theme["bodyFont"], dark = false): Theme =>
  dark
    ? { primary, accent, background: "#0b0f17", surface: "#131a26", text: "#f1f5f9", muted: "#94a3b8", headingFont, bodyFont, radius: "md" }
    : { primary, accent, background: "#ffffff", surface: "#f5f7fa", text: "#0f172a", muted: "#475569", headingFont, bodyFont, radius: "lg" };

export const SEGMENTS: Segment[] = [
  { key: "barbearia", label: "Barbearias", query: "barbearia", placesType: "barber_shop", template: "barber", imageQuery: "barbershop", theme: t("#c8a464", "#e2c48a", "Bebas Neue", "Inter", true) },
  { key: "salao", label: "Salões de beleza", query: "salão de beleza", placesType: "beauty_salon", template: "barber", imageQuery: "beauty salon", theme: t("#be185d", "#f472b6", "Playfair Display", "Lato") },
  { key: "restaurante", label: "Restaurantes", query: "restaurante", placesType: "restaurant", template: "restaurant", imageQuery: "restaurant food", theme: t("#b91c1c", "#f59e0b", "Playfair Display", "Open Sans") },
  { key: "odontologia", label: "Clínicas odontológicas", query: "clínica odontológica", placesType: "dentist", template: "clinic", imageQuery: "dental clinic", theme: t("#0369a1", "#14b8a6", "Poppins", "Inter") },
  { key: "clinica", label: "Clínicas e consultórios", query: "clínica", placesType: "doctor", template: "clinic", imageQuery: "medical clinic", theme: t("#0e7490", "#22c55e", "Poppins", "Inter") },
  { key: "academia", label: "Academias", query: "academia", placesType: "gym", template: "services", imageQuery: "gym fitness", theme: t("#ea580c", "#facc15", "Oswald", "Roboto", true) },
  { key: "oficina", label: "Oficinas mecânicas", query: "oficina mecânica", placesType: "car_repair", template: "mechanic", imageQuery: "car mechanic workshop", theme: t("#2563eb", "#f97316", "Oswald", "Roboto", true) },
  { key: "roupas", label: "Lojas de roupas", query: "loja de roupas", placesType: "clothing_store", template: "store", imageQuery: "clothing store", theme: t("#111827", "#d946ef", "Montserrat", "DM Sans") },
  { key: "imobiliaria", label: "Imobiliárias", query: "imobiliária", placesType: "real_estate_agency", template: "services", imageQuery: "house real estate", theme: t("#1e3a8a", "#0ea5e9", "Montserrat", "Open Sans") },
  { key: "servicos", label: "Prestadores de serviços", query: "prestador de serviços", template: "services", imageQuery: "professional service", theme: t("#1d4ed8", "#06b6d4", "DM Sans", "Inter") },
  { key: "petshop", label: "Pet shops", query: "pet shop", placesType: "pet_store", template: "store", imageQuery: "pet shop dog", theme: t("#0d9488", "#f59e0b", "Nunito", "Nunito") },
  { key: "padaria", label: "Padarias", query: "padaria", placesType: "bakery", template: "restaurant", imageQuery: "bakery bread", theme: t("#92400e", "#f59e0b", "Lora", "Lato") },
  { key: "construcao", label: "Empresas de construção", query: "construtora", placesType: "general_contractor", template: "services", imageQuery: "construction", theme: t("#ca8a04", "#1e293b", "Oswald", "Open Sans") },
];

export function getSegment(key: string | null | undefined): Segment {
  return SEGMENTS.find((s) => s.key === key) ?? SEGMENTS.find((s) => s.key === "servicos")!;
}

/** Formato do texto gerado pela IA (ou pelo modelo padrão). Somente textos — a estrutura vem do template. */
export const SiteCopySchema = z.object({
  siteName: z.string().max(120),
  seoTitle: z.string().max(120),
  seoDescription: z.string().max(300),
  heroTitle: z.string().max(160),
  heroSubtitle: z.string().max(400),
  primaryCta: z.string().max(60),
  aboutTitle: z.string().max(120),
  aboutText: z.string().max(2000),
  servicesTitle: z.string().max(120),
  servicesIntro: z.string().max(600),
  services: z.array(z.object({ title: z.string().max(100), description: z.string().max(400) })).max(12),
  menuCategories: z.array(z.object({ name: z.string().max(80), items: z.array(z.object({ name: z.string().max(100), description: z.string().max(300) })).max(12) })).max(6),
  ctaTitle: z.string().max(160),
  ctaText: z.string().max(500),
  contactText: z.string().max(500),
  quoteTitle: z.string().max(120),
  quoteText: z.string().max(500),
  colors: z.object({ primary: z.string(), accent: z.string() }),
  headingFont: z.enum(FONTS),
  bodyFont: z.enum(FONTS),
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
  /** WhatsApp confirmado. undefined = desconhecido (usa celular como sugestão); "" = não confirmado. */
  whatsapp?: string | null;
  email?: string | null;
  instagram?: string | null;
  website?: string | null;
  /** Horários publicados e confirmados (linhas prontas). */
  hoursLines?: { label: string; value: string }[] | null;
  /** Descrição publicada no site oficial da empresa (meta description), com a fonte. */
  ownDescription?: { text: string; source: string } | null;
  hoursSource?: string | null;
  mapsUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const isHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);

/** Celular brasileiro (DDD + 9 + 8 dígitos) ou número internacional: só então o WhatsApp é oferecido. */
export function isMobilePhone(phone: string | null | undefined): boolean {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d) return false;
  return d.startsWith("55") ? /^55\d{2}9\d{8}$/.test(d) : d.length >= 11;
}

let idCounter = 0;
export const sid = (type: string) => `${type}-${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Tema completo de uma direção visual (base de cores, tipografia e cantos), mantendo as cores da marca. */
export function themeForStyle(style: SiteStyle, primary: string, accent: string): Theme {
  const info = STYLE_INFO[style];
  return {
    primary, accent,
    background: info.background, surface: info.surface, text: info.text, muted: info.muted,
    headingFont: info.heading as Theme["headingFont"], bodyFont: info.body as Theme["bodyFont"],
    radius: info.radius, style,
  };
}

/** Aviso sobre a tipologia do ramo mostrada no painel e na faixa em movimento (não são afirmações sobre a empresa). */
function nicheNote(company: CompanyInfo, segment: Segment): string | null {
  const n = nicheOf(undefined, `${company.category ?? ""} ${company.name} ${segment.key}`);
  return n.chips.length ? `Painel e faixa em movimento usam itens típicos de ${n.label} (${n.chips.slice(0, 3).join(", ")}…): confirme o que a empresa realmente oferece antes de publicar.` : null;
}

export function buildSiteContent(company: CompanyInfo, segment: Segment, copy: SiteCopy, images: SiteImage[] = [], style?: SiteStyle): SiteContent {
  // A direção visual (estrutura, tipografia, base de cores) vem do setor; a IA só sugere as cores da marca.
  const theme = themeForStyle(
    style ?? styleForSegment(segment.key),
    isHex(copy.colors.primary) ? copy.colors.primary : segment.theme.primary,
    isHex(copy.colors.accent) ? copy.colors.accent : segment.theme.accent,
  );
  const hasPhone = !!company.phone;
  // Com dados de lead, o botão de WhatsApp só aparece com número confirmado; sem essa informação, celular conta como WhatsApp provável.
  const waConfirmed = company.whatsapp ? company.whatsapp : company.whatsapp === undefined && isMobilePhone(company.phone) ? company.phone ?? "" : "";
  const mobile = !!waConfirmed;
  const mainAction = mobile ? ("whatsapp" as const) : hasPhone ? ("phone" as const) : ("section" as const);
  const [heroImg, aboutImg, ...galleryImgs] = images;

  const hero: Section = {
    id: "inicio",
    type: "hero",
    visible: true,
    title: copy.heroTitle,
    subtitle: copy.heroSubtitle,
    image: heroImg,
    buttons: [
      { label: copy.primaryCta || "Fale conosco", action: mainAction, href: hasPhone ? undefined : "contato" },
      ...(company.mapsUrl ? [{ label: "Como chegar", action: "maps" as const }] : []),
    ],
  };
  const about: Section = { id: "sobre", type: "about", visible: true, title: copy.aboutTitle, text: copy.aboutText, image: aboutImg };
  const services: Section = { id: "servicos", type: "services", visible: true, title: copy.servicesTitle, intro: copy.servicesIntro, items: copy.services };
  const hours: Section = {
    id: "horarios",
    type: "hours",
    visible: true,
    title: "Horário de funcionamento",
    // Horários nunca são inventados: só entram os publicados pela fonte (confirmados); senão o usuário preenche.
    lines: company.hoursLines?.length
      ? company.hoursLines.slice(0, 10)
      : [
          { label: "Segunda a sexta", value: "" },
          { label: "Sábado", value: "" },
          { label: "Domingo", value: "" },
        ],
    note: company.hoursLines?.length ? `Horários publicados no ${company.hoursSource ?? "perfil público"}; confirme com a empresa antes de liberar o link.` : "Confirme os horários com a empresa antes de publicar.",
    ...(timezoneFor(company.state, company.city) ? { timezone: timezoneFor(company.state, company.city)! } : {}),
  };
  const gallery: Section = { id: "galeria", type: "gallery", visible: galleryImgs.length > 0, title: "Galeria", images: galleryImgs };
  const cta: Section = { id: "chamada", type: "cta", visible: true, title: copy.ctaTitle, text: copy.ctaText, button: { label: copy.primaryCta || "Fale conosco", action: mainAction, href: hasPhone ? undefined : "contato" } };
  const quote: Section = { id: "orcamento", type: "quote", visible: true, title: copy.quoteTitle || "Solicite um orçamento", text: copy.quoteText, buttonLabel: mobile ? "Enviar pelo WhatsApp" : "Enviar por e-mail" };
  const contact: Section = { id: "contato", type: "contact", visible: true, title: "Contato e localização", text: copy.contactText, showMap: company.lat != null && company.lng != null };
  const menu: Section = {
    id: "cardapio",
    type: "menu",
    visible: true,
    title: segment.key === "padaria" ? "Nossos produtos" : "Cardápio",
    intro: "Consulte disponibilidade e valores diretamente com a gente.",
    // Preços ficam em branco: só o assinante/empresa pode informá-los.
    categories: copy.menuCategories.map((c) => ({ name: c.name, items: c.items.map((i) => ({ ...i, price: "" })) })),
  };
  const products: Section = {
    id: "produtos",
    type: "products",
    visible: true,
    title: copy.servicesTitle,
    intro: copy.servicesIntro,
    items: copy.services.map((s) => ({ name: s.title, description: s.description })),
  };

  // Números só entram quando o usuário confirma com a empresa; até lá a seção fica vazia (oculta no site).
  const stats: Section = { id: "numeros", type: "stats", visible: true, title: "Em números", items: [] };
  const byTemplate: Record<TemplateKey, Section[]> = {
    restaurant: [hero, about, menu, stats, gallery, hours, cta, contact],
    barber: [hero, services, stats, about, gallery, hours, cta, contact],
    clinic: [hero, { ...services, title: copy.servicesTitle || "Especialidades" }, about, hours, cta, contact],
    mechanic: [hero, services, stats, about, hours, quote, contact],
    store: [hero, products, about, gallery, hours, cta, contact],
    services: [hero, services, stats, about, gallery, quote, contact],
  };

  return {
    version: 1,
    libraryVersion: 1,
    siteName: copy.siteName || company.name,
    seo: { title: copy.seoTitle || company.name, description: copy.seoDescription },
    theme,
    business: {
      name: company.name,
      phone: company.phone ?? "",
      whatsapp: waConfirmed,
      email: company.email ?? "",
      address: company.address ?? "",
      instagram: company.instagram ?? "",
      mapsUrl: company.mapsUrl ?? "",
      lat: company.lat ?? null,
      lng: company.lng ?? null,
    },
    sections: byTemplate[segment.template],
    stage: { kind: objectKindFor(segment.key, `${company.category ?? ""} ${company.name}`), mode: "auto" },
    ...(theme.style === "immersive"
      ? {
          concept: buildConcept({
            name: company.name, category: company.category, segmentKey: segment.key, neighborhood: company.neighborhood, city: company.city,
            hoursLines: company.hoursLines, description: company.ownDescription?.text ?? null, instagram: company.instagram,
            hasCompanyPhotos: images.some((i) => i.origin === "company"), hasWhatsapp: !!waConfirmed, hasWidePhoto: images.length > 0,
          }),
        }
      : {}),
    reviewNotes: [
      "Os serviços/produtos listados são sugestões típicas do segmento — confirme com a empresa.",
      ...(nicheNote(company, segment) ? [nicheNote(company, segment)!] : []),
      company.hoursLines?.length ? `Horários vieram do ${company.hoursSource ?? "perfil público"}: confirme com a empresa.` : "Preencha os horários de funcionamento e os preços somente com informações confirmadas.",
      ...(company.ownDescription && usableOwnDescription(company.ownDescription.text) ? [`O texto "Sobre" usa a descrição publicada em ${company.ownDescription.source}: confira se continua atual.`] : []),
      ...(company.phone ? [] : ["A fonte de dados não informou telefone: adicione um contato em 'Dados da empresa'."]),
      ...(company.phone && !mobile ? [company.whatsapp === "" && isMobilePhone(company.phone) ? "O celular publicado não foi confirmado como WhatsApp: confirme no lead para ativar o botão de WhatsApp." : "O telefone informado é fixo: o botão principal liga para ele. Se a empresa usa WhatsApp, informe o número no lead."] : []),
    ],
  };
}

const SINGULAR: Record<string, string> = {
  barbearia: "barbearia", salao: "salão de beleza", restaurante: "restaurante", odontologia: "clínica odontológica", clinica: "clínica",
  academia: "academia", oficina: "oficina mecânica", roupas: "loja de roupas", imobiliaria: "imobiliária", servicos: "prestação de serviços",
  petshop: "pet shop", padaria: "padaria", construcao: "construtora",
};

/** Serviços típicos por segmento (sugestões genéricas, sempre sinalizadas para confirmação). */
const SEGMENT_SERVICES: Record<string, { title: string; description: string }[]> = {
  salao: [
    { title: "Corte e escova", description: "Corte e finalização de acordo com o seu estilo." },
    { title: "Coloração", description: "Tons e técnicas combinados com a profissional." },
    { title: "Unhas", description: "Manicure e pedicure." },
  ],
  odontologia: [
    { title: "Avaliação", description: "Consulta para entender o que você precisa." },
    { title: "Prevenção e limpeza", description: "Cuidados de rotina com a saúde bucal." },
    { title: "Agendamento", description: "Combine o melhor horário pelos nossos canais." },
  ],
  academia: [
    { title: "Musculação", description: "Treino com acompanhamento." },
    { title: "Aulas", description: "Consulte as modalidades disponíveis." },
    { title: "Avaliação", description: "Converse com a equipe para montar seu treino." },
  ],
  padaria: [
    { title: "Pães", description: "Fornadas ao longo do dia." },
    { title: "Confeitaria", description: "Bolos e doces." },
    { title: "Encomendas", description: "Fale com a gente para encomendar." },
  ],
  petshop: [
    { title: "Banho e tosa", description: "Cuidado com o seu pet." },
    { title: "Produtos", description: "Alimentação e acessórios." },
    { title: "Atendimento", description: "Tire suas dúvidas com a equipe." },
  ],
  imobiliaria: [
    { title: "Compra e venda", description: "Apoio em cada etapa da negociação." },
    { title: "Locação", description: "Imóveis para alugar." },
    { title: "Avaliação", description: "Converse com a equipe sobre o seu imóvel." },
  ],
  construcao: [
    { title: "Obras", description: "Execução com planejamento." },
    { title: "Reformas", description: "Projetos residenciais e comerciais." },
    { title: "Orçamento", description: "Solicite um orçamento sem compromisso." },
  ],
};

/** Texto padrão usado quando a IA não está configurada. Usa apenas dados reais da empresa. */
export function fallbackCopy(company: CompanyInfo, segment: Segment): SiteCopy {
  const where = [company.neighborhood, company.city].filter(Boolean).join(", ");
  const typical: Record<TemplateKey, { title: string; description: string }[]> = {
    restaurant: [
      { title: "Refeições", description: "Pratos preparados para o seu dia a dia." },
      { title: "Atendimento no local", description: "Venha nos visitar." },
      { title: "Pedidos", description: "Fale com a gente para saber como fazer seu pedido." },
    ],
    barber: [
      { title: "Corte", description: "Corte de cabelo com atenção aos detalhes." },
      { title: "Barba", description: "Acabamento e cuidado com a barba." },
      { title: "Atendimento com horário", description: "Fale com a gente para combinar seu horário." },
    ],
    clinic: [
      { title: "Consultas", description: "Atendimento com profissionais da área." },
      { title: "Avaliação", description: "Converse com a equipe para entender o melhor caminho." },
      { title: "Agendamento", description: "Agende seu atendimento pelos nossos canais." },
    ],
    mechanic: [
      { title: "Manutenção", description: "Cuidados com o seu veículo." },
      { title: "Diagnóstico", description: "Avaliação do problema antes do serviço." },
      { title: "Orçamento", description: "Solicite um orçamento sem compromisso." },
    ],
    store: [
      { title: "Produtos", description: "Conheça nossos produtos na loja." },
      { title: "Atendimento", description: "Tire suas dúvidas com a nossa equipe." },
      { title: "Novidades", description: "Fale com a gente para conhecer as novidades." },
    ],
    services: [
      { title: "Atendimento personalizado", description: "Entendemos a sua necessidade antes de começar." },
      { title: "Orçamento", description: "Solicite um orçamento sem compromisso." },
      { title: "Acompanhamento", description: "Estamos disponíveis para tirar dúvidas." },
    ],
  };
  const seg = SINGULAR[segment.key] ?? segment.label.replace(/s$/, "").toLowerCase();
  const services = SEGMENT_SERVICES[segment.key] ?? typical[segment.template];
  const lib = sectorCopy(segment.key, `${company.category ?? ""} ${company.name}`);
  const own = usableOwnDescription(company.ownDescription?.text);
  const hasWa = company.whatsapp ? true : company.whatsapp === undefined && isMobilePhone(company.phone);
  return {
    siteName: company.name,
    seoTitle: `${company.name}${where ? ` · ${seg} em ${where}` : ""}`.slice(0, 120),
    seoDescription: (own ?? `${company.name}${company.category ? `, ${company.category.toLowerCase()}` : ""}${where ? ` em ${where}` : ""}. Entre em contato.`).slice(0, 300),
    heroTitle: company.name,
    heroSubtitle: lib ? `${lib.tagline()}${where ? ` ${where}.` : ""}` : where ? `${seg[0]!.toUpperCase()}${seg.slice(1)} em ${where}.` : "Fale com a gente.",
    primaryCta: hasWa ? "Chamar no WhatsApp" : company.phone ? "Ligar agora" : "Entrar em contato",
    aboutTitle: "Sobre nós",
    aboutText: own ?? (lib ? lib.about(company.name, placePhrase(company.neighborhood, company.city)) : `A ${company.name} atende${where ? ` em ${where}` : ""}. Entre em contato para saber mais sobre o nosso trabalho.`),
    servicesTitle: segment.template === "store" ? "Nossos produtos" : segment.template === "clinic" ? "Especialidades" : "Serviços",
    servicesIntro: lib?.servicesIntro ?? `Conheça o que a ${company.name} oferece.`,
    services,
    menuCategories: segment.template === "restaurant" ? [{ name: "Destaques", items: [{ name: "Item do cardápio", description: "Descreva aqui um item confirmado com a empresa." }] }] : [],
    ctaTitle: lib ? lib.ctaTitle(where) : `Procurando ${seg}${where ? ` em ${where}` : ""}?`,
    ctaText: lib?.ctaText ?? "Fale com a gente e tire suas dúvidas.",
    contactText: company.hoursLines?.length ? "Confira os horários e fale com a gente pelos canais abaixo." : "Fale com a gente pelos canais abaixo.",
    quoteTitle: "Solicite um orçamento",
    quoteText: "Conte o que você precisa e responderemos pelo WhatsApp.",
    colors: { primary: segment.theme.primary, accent: segment.theme.accent },
    headingFont: segment.theme.headingFont,
    bodyFont: segment.theme.bodyFont,
  };
}

/** Seção vazia para o botão "Adicionar seção" do editor. */
export function emptySection(type: Section["type"]): Section {
  const id = sid(type);
  switch (type) {
    case "hero": return { id, type, visible: true, title: "Título", subtitle: "Subtítulo", buttons: [] };
    case "about": return { id, type, visible: true, title: "Sobre nós", text: "" };
    case "services": return { id, type, visible: true, title: "Serviços", intro: "", items: [{ title: "Serviço", description: "" }] };
    case "menu": return { id, type, visible: true, title: "Cardápio", intro: "", categories: [{ name: "Categoria", items: [{ name: "Item", description: "", price: "" }] }] };
    case "products": return { id, type, visible: true, title: "Produtos", intro: "", items: [{ name: "Produto", description: "" }] };
    case "hours": return { id, type, visible: true, title: "Horários", lines: [{ label: "Segunda a sexta", value: "" }], note: "" };
    case "gallery": return { id, type, visible: true, title: "Galeria", images: [] };
    case "cta": return { id, type, visible: true, title: "Fale com a gente", text: "", button: { label: "Entrar em contato", action: "whatsapp" } };
    case "quote": return { id, type, visible: true, title: "Solicite um orçamento", text: "", buttonLabel: "Enviar pelo WhatsApp" };
    case "contact": return { id, type, visible: true, title: "Contato", text: "", showMap: true };
    case "text": return { id, type, visible: true, title: "Título", text: "" };
    case "stats": return { id, type, visible: true, title: "Em números", items: [{ value: "", unit: "", label: "", source: "" }] };
  }
}
