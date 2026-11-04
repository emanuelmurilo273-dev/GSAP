import type { Company } from "@prisma/client";
import type { CompanyInfo } from "../site/templates";
import { isSocialUrl } from "./normalize";
import { isUsable, type Facts, type Opportunity, type PresenceReport, type Social } from "./types";

/**
 * Dados da empresa que podem ir para o site/abordagem: somente fatos
 * confirmados em fonte pública ou revisados pelo usuário. Inferências e
 * valores não encontrados ficam de fora.
 */
export function verifiedCompanyInfo(c: Company): CompanyInfo {
  const facts = (c.facts ?? null) as Facts | null;
  if (!facts) return c; // empresas salvas antes do pipeline (dados da fonte)
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
    email: v("email"),
    website: v("website"),
    instagram: socials.find((s) => s.network === "instagram")?.url ?? (c.website && isSocialUrl(c.website) && /instagram/.test(c.website) ? c.website : null),
    mapsUrl: c.mapsUrl,
    lat: c.lat,
    lng: c.lng,
  };
}

export function leadView(c: Company & { projects?: { id: string; name: string }[] }) {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    address: c.address,
    city: c.city,
    state: c.state,
    phone: c.phone,
    email: c.email,
    website: c.website,
    mapsUrl: c.mapsUrl,
    notes: c.notes,
    source: c.source,
    isDemo: c.isDemo,
    excluded: !!c.excludedAt,
    language: c.language,
    socials: (c.socials ?? []) as Social[],
    facts: (c.facts ?? {}) as Facts,
    presence: (c.presence ?? null) as PresenceReport | null,
    opportunities: (c.opportunities ?? []) as Opportunity[],
    opportunityScore: c.opportunityScore,
    fetchedAt: c.fetchedAt.toISOString(),
    reviewedAt: c.reviewedAt?.toISOString() ?? null,
    searchId: c.searchId,
    projects: c.projects ?? [],
  };
}
export type LeadView = ReturnType<typeof leadView>;
