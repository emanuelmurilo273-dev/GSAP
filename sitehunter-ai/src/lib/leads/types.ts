import { z } from "zod";

// ---------- Idiomas ----------
export const LANGUAGES = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];
export const LanguageSchema = z.enum(["pt-BR", "en", "es"]);

// ---------- Critérios de busca ----------
export const MAX_LEADS_PER_SEARCH = 30;

export const CriteriaSchema = z.object({
  niche: z.string().trim().min(2, "informe o nicho").max(80),
  /** Texto livre ("Chapecó - SC"); pode ficar vazio quando o município vem por código IBGE. */
  location: z.string().trim().max(120).default(""),
  language: LanguageSchema.default("pt-BR"),
  count: z.coerce.number().int().min(1).max(MAX_LEADS_PER_SEARCH).default(10),
  /** Município escolhido na lista do IBGE (qualquer cidade do Brasil). */
  cityIbge: z.coerce.number().int().min(1000000).max(9999999).optional(),
  uf: z.string().trim().length(2).toUpperCase().optional(),
});
export type LeadCriteria = z.infer<typeof CriteriaSchema>;

// ---------- Proveniência ----------
/**
 * confirmed  → visto em fonte pública (com URL/fonte registrada)
 * inferred   → dedução do sistema (ex.: "sem site" porque a fonte não informa) — nunca usada como fato
 * not_found  → procurado e não encontrado
 * user       → informado/corrigido manualmente pelo usuário
 */
export type FactStatus = "confirmed" | "inferred" | "not_found" | "user";

export type Fact = {
  value: string | null;
  status: FactStatus;
  source: string; // rótulo legível, ex.: "Google Places", "Site da empresa"
  sourceUrl?: string | null;
  confidence: number; // 0..1
  collectedAt: string; // ISO
  note?: string;
};

export const FACT_FIELDS = ["name", "category", "address", "phone", "whatsapp", "email", "website", "socials", "hours"] as const;
export type FactField = (typeof FACT_FIELDS)[number];
export type Facts = Partial<Record<FactField, Fact>>;

export const FACT_LABELS: Record<FactField, string> = {
  name: "Nome",
  category: "Categoria",
  address: "Endereço comercial",
  phone: "Telefone comercial",
  whatsapp: "WhatsApp comercial",
  email: "E-mail comercial",
  website: "Site",
  socials: "Perfis sociais",
  hours: "Horário de funcionamento",
};

/** Um fato pode ser citado em textos (site/abordagem) somente se confirmado ou informado pelo usuário. */
export function isUsable(f: Fact | undefined | null): f is Fact & { value: string } {
  return !!f && !!f.value && (f.status === "confirmed" || f.status === "user");
}

// ---------- Resultado bruto de provedores ----------
export type SourceRef = { provider: string; label: string; url?: string | null };

export type HoursLine = { label: string; value: string };

/**
 * Imagem candidata para o site de um lead.
 *  company → publicada pela própria empresa (site/perfil): exige confirmação de autorização
 *  stock   → banco com licença compatível (Openverse/Unsplash), com crédito
 *  generated → gerada por IA (Google Flow, fluxo assistido)
 */
export type ImageCandidate = {
  id: string;
  url: string;
  thumb?: string | null;
  alt: string;
  origin: "company" | "stock" | "generated";
  source: string; // ex.: "Site da empresa", "Openverse (Flickr)", "Unsplash"
  sourceUrl?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  credit?: { name: string; link: string } | null;
  status: "candidate" | "approved" | "rejected";
  requiresPermission: boolean;
  approvedAt?: string | null;
  note?: string | null;
};

export type RawBusiness = {
  sourceId: string;
  name: string;
  category: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  businessStatus: string | null;
  source: SourceRef;
  /** Horários publicados pela fonte (já normalizados em linhas) e o texto original. */
  hours?: HoursLine[] | null;
  hoursRaw?: string | null;
  /** Perfis sociais publicados pela própria fonte (ex.: tags contact:instagram do OSM). */
  socialLinks?: string[] | null;
  /** WhatsApp publicado pela própria fonte (ex.: tag contact:whatsapp do OSM). */
  whatsapp?: string | null;
  /** Imagens publicadas pela própria empresa na fonte (ex.: fotos do Google enviadas pela empresa). */
  images?: { url: string; alt: string; source: string; sourceUrl: string | null; note?: string }[] | null;
};

export type Social = { network: string; url: string; source: string };

// ---------- Presença digital ----------
export type PresenceReport = {
  checkedAt: string;
  url: string | null;
  kind: "none" | "social" | "site";
  skipped?: "no_website" | "social_only" | "robots_disallowed" | "demo" | "invalid_url" | "blocked_address";
  reachable?: boolean;
  status?: number | null;
  finalUrl?: string | null;
  https?: boolean;
  responseMs?: number;
  title?: string | null;
  description?: string | null;
  hasViewport?: boolean;
  copyrightYear?: number | null;
  generator?: string | null;
  phones?: string[];
  whatsapp?: string[];
  /** true quando o número foi lido do texto do site (sem link wa.me). */
  whatsappWritten?: boolean;
  /** O site informado não parece ser da empresa (ex.: órgão público): nada lido dele é confirmado. */
  siteMismatch?: boolean;
  emails?: string[];
  socials?: Social[];
  imageCandidates?: { url: string; alt: string; sourceUrl: string }[];
  error?: string | null;
};

// ---------- Oportunidades ----------
export type OpportunityCode =
  | "no_website"
  | "social_only"
  | "site_unreachable"
  | "no_https"
  | "not_mobile"
  | "outdated"
  | "missing_seo"
  | "inconsistent_phone"
  | "missing_contact";

export type Opportunity = {
  code: OpportunityCode;
  label: string;
  detail: string;
  severity: "high" | "medium" | "low";
  /** confirmed = observação verificável; inferred = dedução que deve ser conferida */
  basis: "confirmed" | "inferred";
  evidence?: string | null;
};
