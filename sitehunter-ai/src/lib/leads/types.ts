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
  location: z.string().trim().min(2, "informe a cidade ou região").max(120),
  language: LanguageSchema.default("pt-BR"),
  count: z.coerce.number().int().min(1).max(MAX_LEADS_PER_SEARCH).default(10),
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

export const FACT_FIELDS = ["name", "category", "address", "phone", "email", "website", "socials"] as const;
export type FactField = (typeof FACT_FIELDS)[number];
export type Facts = Partial<Record<FactField, Fact>>;

export const FACT_LABELS: Record<FactField, string> = {
  name: "Nome",
  category: "Categoria",
  address: "Endereço comercial",
  phone: "Telefone comercial",
  email: "E-mail comercial",
  website: "Site",
  socials: "Perfis sociais",
};

/** Um fato pode ser citado em textos (site/abordagem) somente se confirmado ou informado pelo usuário. */
export function isUsable(f: Fact | undefined | null): f is Fact & { value: string } {
  return !!f && !!f.value && (f.status === "confirmed" || f.status === "user");
}

// ---------- Resultado bruto de provedores ----------
export type SourceRef = { provider: string; label: string; url?: string | null };

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
