import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const d = await prisma.outreachDraft.findFirst({ where: { id, userId } });
  if (!d) throw new HttpError(404, "Rascunho não encontrado.");
  return d;
}

const Patch = z.object({ subject: z.string().trim().min(1).max(200).optional(), body: z.string().trim().min(1).max(4000).optional() });

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const d = await own(user.id, (await params).id);
  const b = await parseJson(req, Patch);
  return json({ draft: await prisma.outreachDraft.update({ where: { id: d.id }, data: b }) });
});

/** Descartar rascunho. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const d = await own(user.id, (await params).id);
  await prisma.outreachDraft.delete({ where: { id: d.id } });
  return json({ ok: true });
});
