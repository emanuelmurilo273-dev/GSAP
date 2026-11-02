import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { SiteContentSchema } from "@/lib/site/types";
import { ownProject, snapshotVersion } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const p = await ownProject(user.id, (await params).id);
  return json({ project: { ...p, publication: p.publication && { ...p.publication, html: undefined } } });
});

const Patch = z.object({ name: z.string().trim().min(1).max(120).optional(), content: SiteContentSchema.optional(), note: z.string().max(120).optional() });

/** Salvar alterações (não altera o site publicado até "Atualizar site"). */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requirePremium();
  const { id } = await params;
  await ownProject(user.id, id);
  const b = await parseJson(req, Patch);
  const project = await prisma.project.update({ where: { id }, data: { ...(b.name ? { name: b.name } : {}), ...(b.content ? { content: b.content as never } : {}) } });
  if (b.content) await snapshotVersion(id, b.content, b.note ?? "Alterações salvas");
  return json({ ok: true, updatedAt: project.updatedAt });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await ownProject(user.id, id);
  await prisma.project.delete({ where: { id } });
  return json({ ok: true });
});
