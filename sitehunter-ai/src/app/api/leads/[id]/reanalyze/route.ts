import { requireUser } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { reanalyzeLead } from "@/lib/leads/pipeline";
import { leadView } from "@/lib/leads/verified";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Refaz a verificação pública do site e recalcula as oportunidades. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  await rateLimit(`reanalyze:${user.id}`, 20, 60);
  const { id } = await params;
  const c = await reanalyzeLead(user.id, id);
  if (!c) throw new HttpError(404, "Lead não encontrado.");
  const full = await prisma.company.findUniqueOrThrow({ where: { id }, include: { projects: { select: { id: true, name: true, publication: { select: { status: true } } } } } });
  return json({ lead: leadView(full) });
});
