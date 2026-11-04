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
import { verifiedCompanyInfo } from "@/lib/leads/verified";
import { guessSegmentKey } from "@/lib/leads/normalize";
import { LanguageSchema } from "@/lib/leads/types";

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
  segment: z.string().max(40).optional(),
  instructions: z.string().max(800).optional(),
  language: LanguageSchema.optional(),
});

/** "Criar site com IA": gera uma versão inicial do site a partir dos dados reais da empresa. */
export const POST = route(async (req) => {
  const user = await requirePremium();
  await rateLimit(`generate:${user.id}`, 10, 60);
  const b = await parseJson(req, Body);
  const company = await prisma.company.findFirst({ where: { id: b.companyId, userId: user.id } });
  if (!company) throw new HttpError(404, "Empresa não encontrada. Salve a empresa antes de gerar o site.");
  if (company.excludedAt) throw new HttpError(400, "Este lead foi excluído da lista. Restaure-o antes de gerar o site.");
  const segment = getSegment(b.segment ?? guessSegmentKey(company.category ?? "", company.category));
  const info = verifiedCompanyInfo(company);
  const language = b.language ?? (LanguageSchema.safeParse(company.language).data ?? "pt-BR");

  await consumeUsage(user.id, "generations");
  try {
    const [{ copy, ai }, images] = await Promise.all([
      generateSiteCopy(info, segment, b.instructions, language),
      searchImages(segment.imageQuery, 5).catch(() => []),
    ]);
    const chosen = images.slice(0, 5);
    chosen.forEach((i) => void trackImageDownload(i.downloadLocation));
    const content = buildSiteContent(
      info,
      segment,
      copy,
      chosen.map(({ url, alt, credit }) => ({ url, alt, credit, origin: "stock" as const, license: "Licença Unsplash (uso gratuito, com crédito ao fotógrafo)", sourceUrl: credit?.link })),
    );
    if (company.isDemo) content.reviewNotes.unshift("LEAD DE DEMONSTRAÇÃO: os dados da empresa são fictícios.");
    if (!chosen.length) content.reviewNotes.push("Nenhuma imagem com licença foi adicionada: use o banco de imagens, imagens autorizadas da empresa ou o assistente do Google Flow.");
    const project = await prisma.project.create({
      data: { userId: user.id, companyId: company.id, name: info.name, segment: segment.key, content: content as never, aiGenerated: ai },
    });
    await snapshotVersion(project.id, content, ai ? "Versão gerada pela IA" : "Versão gerada pelo modelo padrão");
    await audit("site_generated", { userId: user.id, meta: { projectId: project.id, ai } });
    return json({ project: { id: project.id }, ai }, 201);
  } catch (e) {
    await refundUsage(user.id, "generations");
    throw e;
  }
});
