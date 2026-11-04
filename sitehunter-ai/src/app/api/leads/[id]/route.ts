import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { applyUserEdit } from "@/lib/leads/facts";
import { detectOpportunities } from "@/lib/leads/opportunities";
import { dedupeKeys } from "@/lib/leads/normalize";
import { leadView } from "@/lib/leads/verified";
import { FACT_FIELDS, LanguageSchema, type Facts, type PresenceReport } from "@/lib/leads/types";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const c = await prisma.company.findFirst({ where: { id, userId }, include: { projects: { select: { id: true, name: true } } } });
  if (!c) throw new HttpError(404, "Lead não encontrado.");
  return c;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  return json({ lead: leadView(await own(user.id, (await params).id)) });
});

const nullableText = (max: number) => z.string().trim().max(max).nullable().transform((v) => (v ? v : null));
const Patch = z.object({
  fields: z
    .object({
      name: z.string().trim().min(1).max(200),
      category: nullableText(120),
      address: nullableText(400),
      phone: nullableText(40),
      email: z.string().trim().max(160).email().nullable().or(z.literal("").transform(() => null)),
      website: z.string().trim().max(500).url().nullable().or(z.literal("").transform(() => null)),
    })
    .partial()
    .optional(),
  notes: z.string().max(2000).optional(),
  excluded: z.boolean().optional(),
  reviewed: z.boolean().optional(),
  language: LanguageSchema.optional(),
});

/** Revisão do lead: correções viram fatos "revisados pelo usuário". */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const c = await own(user.id, (await params).id);
  const b = await parseJson(req, Patch);
  const data: Record<string, unknown> = {};
  let facts = (c.facts ?? {}) as Facts;
  if (b.fields) {
    for (const [k, v] of Object.entries(b.fields)) {
      if (!(FACT_FIELDS as readonly string[]).includes(k)) continue;
      const cur = (c as unknown as Record<string, string | null>)[k] ?? null;
      if (v === undefined || v === cur) continue;
      facts = applyUserEdit(facts, k as keyof Facts, v);
      data[k] = v ?? (k === "name" ? c.name : null);
    }
    data.facts = facts;
    const merged = { name: (data.name as string) ?? c.name, city: c.city, phone: (data.phone as string | null | undefined) ?? c.phone, website: (data.website as string | null | undefined) ?? c.website };
    data.dedupeKeys = dedupeKeys(merged);
    const opp = detectOpportunities(facts, ((c.presence ?? { checkedAt: new Date().toISOString(), url: null, kind: "none" }) as PresenceReport));
    data.opportunities = opp.list;
    data.opportunityScore = opp.score;
  }
  if (b.notes !== undefined) data.notes = b.notes;
  if (b.excluded !== undefined) data.excludedAt = b.excluded ? new Date() : null;
  if (b.reviewed !== undefined) data.reviewedAt = b.reviewed ? new Date() : null;
  if (b.language) data.language = b.language;
  const updated = await prisma.company.update({ where: { id: c.id }, data: data as never, include: { projects: { select: { id: true, name: true } } } });
  return json({ lead: leadView(updated) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const c = await own(user.id, (await params).id);
  await prisma.company.delete({ where: { id: c.id } });
  return json({ ok: true });
});
