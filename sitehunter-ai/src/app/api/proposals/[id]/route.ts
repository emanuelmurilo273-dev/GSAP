import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { ProposalContentSchema, proposalToText } from "@/lib/proposal";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const p = await prisma.proposal.findFirst({ where: { id, userId } });
  if (!p) throw new HttpError(404, "Proposta não encontrada.");
  return p;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const p = await own(user.id, (await params).id);
  const content = ProposalContentSchema.parse(p.content);
  return json({ proposal: p, text: proposalToText(content) });
});

const Patch = z.object({ title: z.string().max(160).optional(), content: ProposalContentSchema });

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await own(user.id, id);
  const b = await parseJson(req, Patch);
  await prisma.proposal.update({ where: { id }, data: { content: b.content as never, priceCents: b.content.developmentPriceCents, ...(b.title ? { title: b.title } : {}) } });
  return json({ ok: true, text: proposalToText(b.content) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await own(user.id, id);
  await prisma.proposal.delete({ where: { id } });
  return json({ ok: true });
});
