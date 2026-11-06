import { prisma } from "../db";
import { log } from "../logger";
import { cityById, cityLabel, resolveCity } from "../br/cities";
import { commonsCandidates } from "./commons";
import { siteMatchesBusiness } from "./presence";
import { buildFacts } from "./facts";
import { dedupeBatch, dedupeKeys } from "./normalize";
import { detectOpportunities } from "./opportunities";
import { checkPresence } from "./presence";
import { getProvider, type ImportRow } from "./providers";
import type { ImageCandidate, LeadCriteria, PresenceReport, RawBusiness } from "./types";
import { companyImageCandidates, sourceImageCandidates } from "./leadImages";

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

/** Explica a cobertura real da fonte usada; avisa quando a cidade não retornou nada. */
export function coverageNote(providerId: string, found: number, location: string, niche: string, cityMatched: boolean, wa?: { verified: number; noWhatsapp: number; kept: number }): string {
  const waTxt = wa && providerId !== "demo" ? ` Destas, ${wa.kept} têm WhatsApp comercial confirmado em fonte pública e entraram na lista; ${wa.noWhatsapp} ficaram de fora por não terem WhatsApp confirmado.` : "";
  return baseCoverage(providerId, found, location, niche, cityMatched) + (found ? waTxt : "");
}

function baseCoverage(providerId: string, found: number, location: string, niche: string, cityMatched: boolean): string {
  if (providerId === "demo") return "Demonstração: empresas fictícias, nenhuma busca real foi feita.";
  if (providerId === "import") return "Dados importados por você (CSV).";
  const where = cityMatched ? location : `"${location}" (não reconhecido na lista de municípios do IBGE; busca por texto)`;
  if (providerId === "osm") {
    return found
      ? `OpenStreetMap: ${found} resultado(s) em ${where}. A fonte cobre todo o Brasil, mas o cadastro depende de voluntários: cidades menores costumam ter poucos comércios e muitos sem telefone ou horário.`
      : `Nenhum resultado no OpenStreetMap para "${niche}" em ${where}. Isso não quer dizer que não existam empresas: o OSM pode não ter esse ramo cadastrado na cidade. Tente outro termo ou o Google Maps (requer chave).`;
  }
  return found
    ? `Google Maps: ${found} resultado(s) em ${where}. Cobertura nacional ampla.`
    : `O Google Maps não retornou resultados para "${niche}" em ${where}.`;
}

export type RunInput = { userId: string; criteria: LeadCriteria; providerId: "google_places" | "osm" | "demo" | "import"; rows?: ImportRow[] };

export async function runLeadSearch({ userId, criteria, providerId, rows }: RunInput) {
  const provider = getProvider(providerId);
  const isDemo = provider.kind === "demo";
  // Município do IBGE: grava o nome canônico ("Chapecó - SC") e usa o código na busca.
  const city = providerId === "import" ? null : cityById(criteria.cityIbge) ?? resolveCity(criteria.location, criteria.uf).city;
  if (city) criteria = { ...criteria, cityIbge: city.ibge, uf: city.uf, location: cityLabel(city) };
  const search = await prisma.leadSearch.create({
    data: { userId, provider: provider.id, niche: criteria.niche, location: criteria.location, language: criteria.language, requested: criteria.count, isDemo },
  });
  const steps: { step: string; at: string; detail?: string }[] = [];
  const step = (s: string, detail?: string) => steps.push({ step: s, at: new Date().toISOString(), detail });
  try {
    step("discover", provider.label);
    // Só entram empresas com WhatsApp comercial confirmado: busca um conjunto maior e filtra depois da verificação.
    const pool = providerId === "import" || isDemo ? criteria.count : Math.min(80, Math.max(criteria.count * 6, 40));
    const raw = await provider.search({ ...criteria, count: pool }, { rows });
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
      const presence: PresenceReport = await checkPresence(r.website, { demo: isDemo }).catch(() => {
        enrichFailures++;
        return { checkedAt: new Date().toISOString(), url: r.website, kind: "site" as const, reachable: undefined, error: "falha na verificação" };
      });
      if (presence.reachable && !siteMatchesBusiness(r.name, presence.finalUrl ?? r.website, presence.title)) presence.siteMismatch = true;
      return { r, keys, presence };
    });

    const created: string[] = [];
    let noWhatsapp = 0;
    for (const { r, keys, presence } of enriched) {
      if (created.length >= criteria.count) break;
      const { facts, socials, email } = buildFacts(r, presence);
      // Regra: WhatsApp comercial confirmado por fonte pública (tag no OSM, link wa.me ou indicação no site da empresa).
      // Telefone fixo, celular sem indicação ou número de site que não é da empresa ficam de fora.
      const wa = facts.whatsapp;
      const whatsapp = wa?.value && wa.status === "confirmed" ? wa.value : null;
      if (!whatsapp && !isDemo) { noWhatsapp++; continue; }
      const opp = detectOpportunities(facts, presence);
      const commons = isDemo || process.env.IMAGE_SEARCH === "off" || process.env.COMMONS_SEARCH === "off" ? [] : await commonsCandidates(r.name, r.city, r.lat, r.lng);
      const images = [...sourceImageCandidates(r), ...companyImageCandidates(presence), ...commons];
      const c = await createLead(userId, search.id, r, { keys, presence, facts, socials, email, opp, isDemo, language: criteria.language, images, whatsapp }).catch((e) => {
        log("warn", "lead_create_failed", { error: String(e) });
        return null;
      });
      if (c) created.push(c.id);
    }
    step("whatsapp", `${enriched.length} verificadas · ${noWhatsapp} sem WhatsApp comercial confirmado (excluídas)`);
    step("coverage", coverageNote(providerId, raw.length, criteria.location, criteria.niche, !!city, { verified: enriched.length, noWhatsapp, kept: created.length }));
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
  x: { keys: string[]; presence: object; facts: object; socials: object[]; email: string | null; opp: { list: object[]; score: number }; isDemo: boolean; language: string; images?: object[]; whatsapp?: string | null },
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
      whatsapp: x.whatsapp ?? null,
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
  const presence: PresenceReport = await checkPresence(c.website, { demo: c.isDemo });
  if (presence.reachable && !siteMatchesBusiness(c.name, presence.finalUrl ?? c.website, presence.title)) presence.siteMismatch = true;
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
  const prevImgs = ((c.images ?? []) as ImageCandidate[]);
  const commons = c.isDemo || process.env.IMAGE_SEARCH === "off" || process.env.COMMONS_SEARCH === "off" ? [] : await commonsCandidates(c.name, c.city, c.lat, c.lng);
  // Candidatas antigas de sites que não são da empresa ou de fotos sem relação saem; aprovadas ficam.
  const kept = prevImgs.filter((p) => p.status === "approved" || !(presence.siteMismatch && p.source === "Site da empresa") && !(p.source === "Wikimedia Commons" && !commons.some((n) => n.sourceUrl === p.sourceUrl)));
  const newImgs = [...companyImageCandidates(presence), ...commons].filter((n) => !kept.some((p) => p.url === n.url || (p.sourceUrl && p.sourceUrl === n.sourceUrl)));
  return prisma.company.update({
    where: { id },
    data: { images: [...kept, ...newImgs] as never, presence: presence as never, facts: facts as never, socials: built.socials as never, email: c.email ?? built.email, opportunities: opp.list as never, opportunityScore: opp.score, fetchedAt: new Date() },
  });
}
