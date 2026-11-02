import { prisma } from "./db";
import { HttpError } from "./http";

/** Busca um projeto garantindo que pertence ao usuário (isolamento entre contas). */
export async function ownProject(userId: string, id: string) {
  const p = await prisma.project.findFirst({ where: { id, userId }, include: { company: true, publication: true } });
  if (!p) throw new HttpError(404, "Projeto não encontrado.");
  return p;
}

export const MAX_VERSIONS = 30;

export async function snapshotVersion(projectId: string, content: unknown, note?: string) {
  await prisma.projectVersion.create({ data: { projectId, content: content as never, note } });
  const old = await prisma.projectVersion.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, skip: MAX_VERSIONS, select: { id: true } });
  if (old.length) await prisma.projectVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}
