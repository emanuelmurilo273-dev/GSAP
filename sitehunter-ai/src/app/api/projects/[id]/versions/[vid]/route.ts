import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { ownProject, snapshotVersion } from "@/lib/projects";

/** Restaura uma versão anterior do projeto (recuperação). */
export const POST = route<{ params: Promise<{ id: string; vid: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id, vid } = await params;
  await ownProject(user.id, id);
  const v = await prisma.projectVersion.findFirst({ where: { id: vid, projectId: id } });
  if (!v) throw new HttpError(404, "Versão não encontrada.");
  await prisma.project.update({ where: { id }, data: { content: v.content as never } });
  await snapshotVersion(id, v.content, `Restaurada versão de ${v.createdAt.toLocaleString("pt-BR")}`);
  return json({ ok: true });
});
