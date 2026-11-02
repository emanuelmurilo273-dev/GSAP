import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/logger";

export const GET = route(async () => {
  await requireAdmin();
  return json({ settings: await getSettings() });
});

const Body = z.object({
  priceCents: z.number().int().min(100).max(10_000_000),
  checkoutUrl: z.string().url().startsWith("https://").max(500).nullable(),
  maxSearchesPerMonth: z.number().int().min(0).max(100_000),
  maxGenerationsPerMonth: z.number().int().min(0).max(100_000),
  maxPublishedSites: z.number().int().min(0).max(10_000),
  graceDays: z.number().int().min(0).max(30),
  retentionDays: z.number().int().min(1).max(365),
  usageWarnPercent: z.number().int().min(10).max(100),
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, Body);
  const settings = await prisma.platformSettings.upsert({ where: { id: "global" }, create: { id: "global", ...b }, update: b });
  await audit("settings_updated", { actorId: admin.id, meta: b });
  return json({ settings });
});
