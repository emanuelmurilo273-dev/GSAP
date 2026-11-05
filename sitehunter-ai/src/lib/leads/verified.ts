import type { Company } from "@prisma/client";
import type { CompanyInfo } from "../site/templates";
import { isSocialUrl } from "./normalize";
import { isUsable, type Facts, type ImageCandidate, type Opportunity, type PresenceReport, type Social } from "./types";

/**
 * Dados da empresa que podem ir para o site/abordagem: somente fatos
 * confirmados em fonte pública ou revisados pelo usuário. Inferências e
 * valores não encontrados ficam de fora.
 */
export function verifiedCompanyInfo(c: Company): CompanyInfo {
  const facts = (c.facts ?? null) as Facts | null;
  if (!facts) return { ...c, hoursLines: null }; // empresas salvas antes do pipeline (dados da fonte)
  const v = (k: keyof Facts) => (isUsable(facts[k]) ? facts[k]!.value : null);
  const socials = ((c.socials ?? []) as Social[]).filter(() => isUsable(facts.socials));
  return {
    name: v("name") ?? c.name,
    category: v("category"),
    address: v("address"),
    neighborhood: c.neighborhood,
    city: c.city,
    state: c.state,
    phone: v("phone"),
    // WhatsApp só quando confirmado (publicado como WhatsApp ou confirmado por você); "" = não confirmado.
    whatsapp: isUsable(facts.whatsapp) ? facts.whatsapp.value : "",
    email: v("email"),
    website: v("website"),
    hoursLines: isUsable(facts.hours) && Array.isArray(c.hours) ? (c.hours as { label: string; value: string }[]) : null,
    hoursSource: facts.hours?.source ?? null,
    ownDescription: ownDescription(c),
    instagram: igProfile(socials.find((s) => s.network === "instagram")?.url ?? (c.website && isSocialUrl(c.website) && /instagram/.test(c.website) ? c.website : null)),
    mapsUrl: c.mapsUrl,
    lat: c.lat,
    lng: c.lng,
  };
}

/** Links de "stories" expiram: guarda só o perfil. */
function igProfile(u: string | null): string | null {
  return u ? u.replace(/instagram\.com\/stories\/([^/?#]+).*/i, "instagram.com/$1/") : null;
}

/** Descrição do próprio site da empresa (página inicial lida após o robots.txt). */
function ownDescription(c: Company): { text: string; source: string } | null {
  const p = (c.presence ?? null) as PresenceReport | null;
  if (!p || p.kind !== "site" || !p.reachable || !p.description || p.siteMismatch) return null;
  const host = (() => { try { return new URL(p.finalUrl ?? p.url ?? "").hostname.replace(/^www\./, ""); } catch { return "site oficial"; } })();
  return { text: p.description, source: host };
}

export type LeadStage = "new" | "review" | "published" | "contacted";
export const STAGE_LABEL: Record<LeadStage, string> = { new: "Novo", review: "Prévia em revisão", published: "Prévia liberada", contacted: "Contatado" };

/** Status do lead no fluxo: novo → prévia em revisão → prévia liberada → contatado (marcado por você). */
export function leadStage(c: Pick<Company, "contactedAt"> & { projects?: { publication?: { status: string } | null }[] }): LeadStage {
  if (c.contactedAt) return "contacted";
  const ps = c.projects ?? [];
  if (ps.some((p) => p.publication?.status === "PUBLISHED")) return "published";
  return ps.length ? "review" : "new";
}

/** Só conta como WhatsApp comercial o número confirmado por fonte pública (OSM, link wa.me ou site da empresa). */
export function hasConfirmedWhatsapp(c: Pick<Company, "whatsapp" | "facts">): boolean {
  const f = (c.facts ?? {}) as Facts;
  return !!c.whatsapp && f.whatsapp?.status === "confirmed";
}

export function leadView(c: Company & { projects?: { id: string; name: string; publication?: { status: string } | null }[] }) {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    address: c.address,
    city: c.city,
    state: c.state,
    phone: c.phone,
    email: c.email,
    whatsapp: c.whatsapp,
    website: c.website,
    mapsUrl: c.mapsUrl,
    notes: c.notes,
    source: c.source,
    isDemo: c.isDemo,
    excluded: !!c.excludedAt,
    language: c.language,
    socials: (c.socials ?? []) as Social[],
    hours: (c.hours ?? null) as { label: string; value: string }[] | null,
    images: (c.images ?? []) as ImageCandidate[],
    facts: (c.facts ?? {}) as Facts,
    presence: (c.presence ?? null) as PresenceReport | null,
    opportunities: (c.opportunities ?? []) as Opportunity[],
    opportunityScore: c.opportunityScore,
    fetchedAt: c.fetchedAt.toISOString(),
    reviewedAt: c.reviewedAt?.toISOString() ?? null,
    searchId: c.searchId,
    projects: (c.projects ?? []).map((p) => ({ id: p.id, name: p.name, published: p.publication?.status === "PUBLISHED" })),
    contactedAt: c.contactedAt?.toISOString() ?? null,
    waMessage: c.waMessage,
    stage: leadStage(c),
    waConfirmed: hasConfirmedWhatsapp(c),
  };
}
export type LeadView = ReturnType<typeof leadView>;
