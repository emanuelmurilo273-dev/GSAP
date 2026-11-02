import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, refundUsage } from "@/lib/usage";
import { generateSiteCopy } from "@/lib/ai";
import { buildSiteContent, completeCopy, getSegment } from "@/lib/site/templates";
import { stockImages } from "@/lib/site/stock";
import { snapshotVersion } from "@/lib/projects";
import { audit } from "@/lib/logger";
import { env } from "@/lib/env";
import { photoUrl } from "@/lib/placePhotos";
import type { PlacePhoto } from "@/lib/places";
import type { SiteImage } from "@/lib/site/types";

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
    const [{ copy: rawCopy, ai }] = await Promise.all([
      generateSiteCopy(company, segment, b.instructions, { menuText: b.menuText, senderName: user.name.split(" ")[0] }),
    ]);
    const copy = completeCopy(rawCopy, company, segment);
    // Fotos reais do estabelecimento (Google) têm prioridade; sem elas, banco de imagens autorizado.
    const placePhotos = (company.photos as PlacePhoto[] | null) ?? [];
    const where = [company.neighborhood, company.city].filter(Boolean).join(", ");
    let siteImages: SiteImage[];
    if (placePhotos.length) {
      siteImages = placePhotos.slice(0, 10).map((p, i) => ({
        url: photoUrl(env.appUrl, company.id, i),
        alt: `Foto ${i + 1} de ${company.name}${company.category ? `, ${company.category.toLowerCase()}` : ""}${where ? ` em ${where}` : ""}`,
        credit: p.author ? { name: p.author, link: p.authorUri || "https://maps.google.com", source: "google" as const } : undefined,
      }));
    } else {
      // Biblioteca própria de fotos profissionais do segmento (servidas em /stock).
      siteImages = stockImages(segment.key, `${env.appUrl}/`);
    }
    const content = buildSiteContent(company, segment, copy, siteImages);
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
