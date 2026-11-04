import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, getUsage, refundUsage } from "@/lib/usage";
import { CriteriaSchema } from "@/lib/leads/types";
import { getProvider } from "@/lib/leads/providers";
import { csvToRows } from "@/lib/leads/providers/csvImport";
import { runLeadSearch } from "@/lib/leads/pipeline";
import { audit } from "@/lib/logger";

export const maxDuration = 120;

export const GET = route(async () => {
  const user = await requireUser();
  const searches = await prisma.leadSearch.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 30 });
  return json({ searches });
});

const Body = CriteriaSchema.extend({
  provider: z.enum(["google_places", "osm", "demo", "import"]).default("osm"),
  csv: z.string().max(500_000).optional(),
});

/** Inicia uma descoberta de leads. Não entra em contato com nenhuma empresa. */
export const POST = route(async (req) => {
  const b = await parseJson(req, Body);
  // Busca real exige a conta com acesso (no modo privado, só o proprietário chega aqui).
  const user = b.provider === "google_places" || b.provider === "osm" ? await requirePremium() : await requireUser();
  await rateLimit(`leadsearch:${user.id}`, 10, 60);
  const provider = getProvider(b.provider);
  if (!provider.configured()) throw new HttpError(503, `${provider.label} não está configurado. ${provider.setupHint}`, "not_configured");
  const rows = b.provider === "import" ? csvToRows(b.csv ?? "") : undefined;
  if (b.provider === "import" && !rows?.length) throw new HttpError(400, "CSV sem linhas válidas. A primeira linha precisa ter os cabeçalhos (ao menos “nome”).", "validation");

  // Só o Google Places é cobrado por requisição; o OpenStreetMap é gratuito (com limite de uso).
  const paid = provider.id === "google_places";
  if (paid) await consumeUsage(user.id, "searches");
  try {
    const criteria = { niche: b.niche, location: b.location, language: b.language, count: b.provider === "import" ? Math.min(rows!.length, 200) : b.count };
    const { search, createdIds } = await runLeadSearch({ userId: user.id, criteria, providerId: b.provider, rows });
    await audit("lead_search", { userId: user.id, meta: { searchId: search.id, provider: b.provider, created: createdIds.length } });
    return json({ search, createdIds, usage: await getUsage(user.id) }, 201);
  } catch (e) {
    if (paid) await refundUsage(user.id, "searches");
    throw e;
  }
});
