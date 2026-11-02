import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, refundUsage } from "@/lib/usage";
import { generateSiteCopy } from "@/lib/ai";
import { buildSiteContent, getSegment } from "@/lib/site/templates";
import { searchImages, trackImageDownload } from "@/lib/images";
import { snapshotVersion } from "@/lib/projects";
import { audit } from "@/lib/logger";

export const GET = route(async () => {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, segment: true, createdAt: true, updatedAt: true, aiGenerated: true, company: { select: { id: true, name: true } }, publication: true },
  });
  return json({ projects: projects.map((p) => ({ ...p, publication: p.publication && { ...p.publication, html: undefined } })) });
});

const Body = z.object({
  companyId: z.string().min(1),
  segment: z.string().max(40),
  instructions: z.string().max(800).optional(),
  menuText: z.string().max(6000).optional(),
});

/** "Criar site com IA": gera uma versão inicial do site a partir dos dados reais da empresa. */
export const POST = route(async (req) => {
  const user = await requirePremium();
  await rateLimit(`generate:${user.id}`, 10, 60);
  const b = await parseJson(req, Body);
  const company = await prisma.company.findFirst({ where: { id: b.companyId, userId: user.id } });
  if (!company) throw new HttpError(404, "Empresa não encontrada. Salve a empresa antes de gerar o site.");
  const segment = getSegment(b.segment);

  await consumeUsage(user.id, "generations");
  try {
    const [{ copy, ai }, images] = await Promise.all([
      generateSiteCopy(company, segment, b.instructions, { menuText: b.menuText, senderName: user.name.split(" ")[0] }),
      searchImages(segment.imageQuery, 5).catch(() => []),
    ]);
    const chosen = images.slice(0, 5);
    chosen.forEach((i) => void trackImageDownload(i.downloadLocation));
    const content = buildSiteContent(company, segment, copy, chosen.map(({ url, alt, credit }) => ({ url, alt, credit })));
    const project = await prisma.project.create({
      data: { userId: user.id, companyId: company.id, name: company.name, segment: segment.key, content: content as never, aiGenerated: ai, outreachMessage: copy.outreach || null },
    });
    await snapshotVersion(project.id, content, ai ? "Versão gerada pela IA" : "Versão gerada pelo modelo padrão");
    await audit("site_generated", { userId: user.id, meta: { projectId: project.id, ai } });
    return json({ project: { id: project.id }, ai }, 201);
  } catch (e) {
    await refundUsage(user.id, "generations");
    throw e;
  }
});
