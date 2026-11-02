import { z } from "zod";
import { requirePremium } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, getUsage, refundUsage } from "@/lib/usage";
import { searchPlaces } from "@/lib/places";
import { getSegment } from "@/lib/site/templates";
import { prisma } from "@/lib/db";

const Body = z.object({
  country: z.literal("BR").default("BR"),
  state: z.string().trim().length(2).toUpperCase(),
  city: z.string().trim().min(2).max(80),
  neighborhood: z.string().trim().max(80).optional().default(""),
  segment: z.string().trim().max(40),
  name: z.string().trim().max(100).optional().default(""),
  pageToken: z.string().max(2000).optional(),
});

export const POST = route(async (req) => {
  const user = await requirePremium();
  await rateLimit(`search:${user.id}`, 30, 60);
  const body = await parseJson(req, Body);
  const seg = getSegment(body.segment);
  const textQuery = [body.name || seg.query, body.neighborhood, body.city, body.state, "Brasil"].filter(Boolean).join(", ");
  await consumeUsage(user.id, "searches");
  let data;
  try {
    // Busca por nome não restringe o tipo, para não esconder empresas cadastradas em outra categoria.
    data = await searchPlaces({ textQuery, includedType: body.name ? undefined : seg.placesType, pageToken: body.pageToken });
  } catch (e) {
    await refundUsage(user.id, "searches");
    throw e;
  }
  const saved = await prisma.company.findMany({
    where: { userId: user.id, source: "google_places", sourceId: { in: data.results.map((r) => r.sourceId) } },
    select: { id: true, sourceId: true },
  });
  const savedMap = new Map(saved.map((s) => [s.sourceId, s.id]));
  return json({
    query: textQuery,
    results: data.results.map((r) => ({ ...r, savedId: savedMap.get(r.sourceId) ?? null })),
    nextPageToken: data.nextPageToken,
    usage: await getUsage(user.id),
  });
});
