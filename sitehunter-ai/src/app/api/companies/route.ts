import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";

export const GET = route(async (req) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams;
  const onlyNoSite = q.get("noSite") === "1";
  const companies = await prisma.company.findMany({
    where: { userId: user.id, ...(onlyNoSite ? { website: null } : {}) },
    orderBy: { createdAt: "desc" },
    include: { projects: { select: { id: true, name: true } } },
    take: 500,
  });
  return json({ companies });
});

const Body = z.object({
  sourceId: z.string().min(3).max(300),
  name: z.string().min(1).max(200),
  category: z.string().max(120).nullable().optional(),
  address: z.string().max(400).nullable().optional(),
  neighborhood: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(10).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  mapsUrl: z.string().url().max(1000).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  hours: z.array(z.string().max(120)).max(10).optional(),
  photos: z.array(z.object({ name: z.string().regex(/^places\/[^/]+\/photos\/[^/]+$/).max(500), widthPx: z.number().int().min(0), heightPx: z.number().int().min(0), author: z.string().max(200), authorUri: z.string().max(500) })).max(10).optional(),
});

/** Salva uma empresa vinda da busca na lista do próprio usuário. */
export const POST = route(async (req) => {
  const user = await requirePremium();
  const b = await parseJson(req, Body);
  const data = {
    name: b.name,
    category: b.category ?? null,
    address: b.address ?? null,
    neighborhood: b.neighborhood ?? null,
    city: b.city ?? null,
    state: b.state ?? null,
    phone: b.phone ?? null,
    website: b.website ?? null,
    mapsUrl: b.mapsUrl ?? null,
    lat: b.lat ?? null,
    lng: b.lng ?? null,
    hours: b.hours ?? [],
    photos: b.photos ?? undefined,
    fetchedAt: new Date(),
  };
  const company = await prisma.company.upsert({
    where: { userId_source_sourceId: { userId: user.id, source: "google_places", sourceId: b.sourceId } },
    create: { userId: user.id, source: "google_places", sourceId: b.sourceId, ...data },
    update: data,
  });
  return json({ company }, 201);
});
