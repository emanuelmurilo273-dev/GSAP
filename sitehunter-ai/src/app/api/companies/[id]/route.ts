import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const c = await prisma.company.findFirst({ where: { id, userId } });
  if (!c) throw new HttpError(404, "Empresa não encontrada.");
  return c;
}

const Patch = z.object({
  notes: z.string().max(2000).optional(),
  phone: z.string().max(40).nullable().optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await own(user.id, id);
  const b = await parseJson(req, Patch);
  const company = await prisma.company.update({ where: { id }, data: b });
  return json({ company });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await own(user.id, id);
  await prisma.company.delete({ where: { id } });
  return json({ ok: true });
});
