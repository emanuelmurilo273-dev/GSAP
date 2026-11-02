import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { ownProject } from "@/lib/projects";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await ownProject(user.id, id);
  const versions = await prisma.projectVersion.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, select: { id: true, note: true, createdAt: true } });
  return json({ versions });
});
