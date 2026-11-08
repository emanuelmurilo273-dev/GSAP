import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { generateOutreachDraft } from "@/lib/leads/outreach";
import { LanguageSchema, type Facts, type Language, type Opportunity, type PresenceReport } from "@/lib/leads/types";
import { publicUrlFor, shareUrlFor } from "@/lib/publish";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const c = await prisma.company.findFirst({ where: { id, userId }, include: { projects: { include: { publication: true }, orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!c) throw new HttpError(404, "Lead não encontrado.");
  return c;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const c = await own(user.id, (await params).id);
  const drafts = await prisma.outreachDraft.findMany({ where: { userId: user.id, companyId: c.id }, orderBy: { createdAt: "desc" } });
  return json({ drafts });
});

const Body = z.object({ languages: z.array(LanguageSchema).min(1).max(3).optional(), senderName: z.string().trim().min(1).max(80).optional() });

/** Gera rascunhos (português + idioma do lead). Nada é enviado. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  await rateLimit(`outreach:${user.id}`, 20, 60);
  const c = await own(user.id, (await params).id);
  const b = await parseJson(req, Body);
  const leadLang = (LanguageSchema.safeParse(c.language).data ?? "pt-BR") as Language;
  const langs = b.languages ?? [...new Set<Language>(["pt-BR", leadLang])];
  const project = c.projects[0];
  const pub = project?.publication;
  const previewUrl = pub?.status === "PUBLISHED" ? shareUrlFor(pub) : null;
  const input = {
    facts: (c.facts ?? { name: { value: c.name, status: "confirmed", source: "Google Places", confidence: 0.9, collectedAt: c.fetchedAt.toISOString() } }) as Facts,
    opportunities: (c.opportunities ?? []) as Opportunity[],
    senderName: b.senderName ?? user.name,
    previewUrl,
    hasPreview: !!project,
    checkedAt: ((c.presence ?? null) as PresenceReport | null)?.checkedAt ?? null,
  };
  const drafts = [];
  for (const lang of langs) {
    const d = await generateOutreachDraft(input, lang);
    drafts.push(
      await prisma.outreachDraft.create({
        data: { userId: user.id, companyId: c.id, language: lang, subject: d.subject, body: d.body, ai: d.ai, factsUsed: d.factsUsed as never },
      }),
    );
  }
  return json({ drafts, demo: c.isDemo }, 201);
});
