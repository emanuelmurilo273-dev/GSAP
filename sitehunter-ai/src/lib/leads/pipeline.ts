import { prisma } from "../db";
import { log } from "../logger";
import { buildFacts } from "./facts";
import { dedupeBatch, dedupeKeys } from "./normalize";
import { detectOpportunities } from "./opportunities";
import { checkPresence } from "./presence";
import { getProvider, type ImportRow } from "./providers";
import type { LeadCriteria, RawBusiness } from "./types";
import { companyImageCandidates } from "./leadImages";

// Pipeline: descobrir → normalizar/deduplicar → analisar presença → registrar
// proveniência e oportunidades → salvar. Executa de forma síncrona e limitada
// (no máximo MAX_LEADS_PER_SEARCH leads, 4 verificações de site em paralelo).

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    }),
  );
  return out;
}

export type RunInput = { userId: string; criteria: LeadCriteria; providerId: "google_places" | "osm" | "demo" | "import"; rows?: ImportRow[] };

export async function runLeadSearch({ userId, criteria, providerId, rows }: RunInput) {
  const provider = getProvider(providerId);
  const isDemo = provider.kind === "demo";
  const search = await prisma.leadSearch.create({
    data: { userId, provider: provider.id, niche: criteria.niche, location: criteria.location, language: criteria.language, requested: criteria.count, isDemo },
  });
  const steps: { step: string; at: string; detail?: string }[] = [];
  const step = (s: string, detail?: string) => steps.push({ step: s, at: new Date().toISOString(), detail });
  try {
    step("discover", provider.label);
    const raw = await provider.search(criteria, { rows });
    const { unique, duplicates: batchDups } = dedupeBatch(raw);

    // Deduplicação contra a lista do usuário (demo só se compara com demo).
    const keyed = unique.map((r) => ({ r, keys: dedupeKeys(r) }));
    const allKeys = [...new Set(keyed.flatMap((k) => k.keys))];
    const existing = await prisma.company.findMany({
      where: { userId, isDemo, OR: [{ dedupeKeys: { hasSome: allKeys } }, { source: provider.id, sourceId: { in: unique.map((u) => u.sourceId) } }] },
      select: { dedupeKeys: true, source: true, sourceId: true },
    });
    const existingKeys = new Set(existing.flatMap((e) => e.dedupeKeys));
    const existingIds = new Set(existing.map((e) => `${e.source}|${e.sourceId}`));
    const fresh = keyed.filter(({ r, keys }) => !existingIds.has(`${provider.id}|${r.sourceId}`) && !keys.some((k) => existingKeys.has(k)));
    const duplicates = batchDups + (keyed.length - fresh.length);
    step("dedupe", `${raw.length} encontradas, ${duplicates} duplicadas`);

    let enrichFailures = 0;
    step("enrich");
    const enriched = await mapLimit(fresh, 4, async ({ r, keys }) => {
      const presence = await checkPresence(r.website, { demo: isDemo }).catch(() => {
        enrichFailures++;
        return { checkedAt: new Date().toISOString(), url: r.website, kind: "site" as const, reachable: undefined, error: "falha na verificação" };
      });
      return { r, keys, presence };
    });

    const created: string[] = [];
    for (const { r, keys, presence } of enriched) {
      const { facts, socials, email } = buildFacts(r, presence);
      const opp = detectOpportunities(facts, presence);
      const images = companyImageCandidates(presence);
      const c = await createLead(userId, search.id, r, { keys, presence, facts, socials, email, opp, isDemo, language: criteria.language, images }).catch((e) => {
        log("warn", "lead_create_failed", { error: String(e) });
        return null;
      });
      if (c) created.push(c.id);
    }
    step("done", `${created.length} novos leads`);
    const updated = await prisma.leadSearch.update({
      where: { id: search.id },
      data: { status: enrichFailures ? "PARTIAL" : "DONE", found: raw.length, created: created.length, duplicates, finishedAt: new Date(), log: steps },
    });
    return { search: updated, createdIds: created };
  } catch (e) {
    await prisma.leadSearch.update({ where: { id: search.id }, data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 300) : "erro", finishedAt: new Date(), log: steps } });
    throw e;
  }
}

async function createLead(
  userId: string,
  searchId: string,
  r: RawBusiness,
  x: { keys: string[]; presence: object; facts: object; socials: object[]; email: string | null; opp: { list: object[]; score: number }; isDemo: boolean; language: string; images?: object[] },
) {
  return prisma.company.create({
    data: {
      userId,
      searchId,
      source: r.source.provider,
      sourceId: r.sourceId,
      name: r.name,
      category: r.category,
      address: r.address,
      neighborhood: r.neighborhood,
      city: r.city,
      state: r.state,
      phone: r.phone,
      email: x.email,
      website: r.website,
      mapsUrl: r.mapsUrl,
      lat: r.lat,
      lng: r.lng,
      isDemo: x.isDemo,
      language: x.language,
      dedupeKeys: x.keys,
      presence: x.presence as never,
      facts: x.facts as never,
      socials: x.socials as never,
      hours: (r.hours ?? null) as never,
      images: (x.images ?? []) as never,
      opportunities: x.opp.list as never,
      opportunityScore: x.opp.score,
      fetchedAt: new Date(),
    },
  });
}

/** Refaz a análise de presença e as oportunidades de um lead (mantendo correções do usuário). */
export async function reanalyzeLead(userId: string, id: string) {
  const c = await prisma.company.findFirst({ where: { id, userId } });
  if (!c) return null;
  const presence = await checkPresence(c.website, { demo: c.isDemo });
  const raw: RawBusiness = {
    sourceId: c.sourceId, name: c.name, category: c.category, address: c.address, neighborhood: c.neighborhood, city: c.city, state: c.state,
    phone: c.phone, email: c.email, website: c.website, mapsUrl: c.mapsUrl, lat: c.lat, lng: c.lng, businessStatus: null,
    source: { provider: c.source, label: c.source === "google_places" ? "Google Maps" : c.source === "osm" ? "OpenStreetMap" : c.source === "demo" ? "Demonstração (fictício)" : "Fornecido pelo usuário", url: c.mapsUrl },
    hours: (c.hours ?? null) as never,
  };
  const built = buildFacts(raw, presence);
  const prev = (c.facts ?? {}) as Record<string, { status?: string }>;
  // correções do usuário prevalecem
  const facts = { ...built.facts } as Record<string, unknown>;
  for (const [k, v] of Object.entries(prev)) if (v?.status === "user") facts[k] = v;
  const opp = detectOpportunities(facts as never, presence);
  // Mantém candidatas já revisadas e acrescenta novas imagens encontradas no site.
  const prevImgs = ((c.images ?? []) as { url: string }[]);
  const newImgs = companyImageCandidates(presence).filter((n) => !prevImgs.some((p) => p.url === n.url));
  return prisma.company.update({
    where: { id },
    data: { images: [...prevImgs, ...newImgs] as never, presence: presence as never, facts: facts as never, socials: built.socials as never, email: c.email ?? built.email, opportunities: opp.list as never, opportunityScore: opp.score, fetchedAt: new Date() },
  });
}
