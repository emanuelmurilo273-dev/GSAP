import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, refundUsage } from "@/lib/usage";
import { generateSiteCopy } from "@/lib/ai";
import { buildSiteContent, getSegment } from "@/lib/site/templates";
import { searchLicensedImages, trackImageDownload } from "@/lib/images";
import type { ImageCandidate } from "@/lib/leads/types";
import type { SiteImage } from "@/lib/site/types";
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
    // Imagens: primeiro as aprovadas na revisão do lead (da empresa, com autorização declarada, ou de banco
    // com licença); se faltarem, completa com um banco com licença compatível (Unsplash ou Openverse).
    const approved = ((company.images ?? []) as ImageCandidate[]).filter((i) => i.status === "approved");
    const fromLead: SiteImage[] = [...approved.filter((i) => i.origin === "company"), ...approved.filter((i) => i.origin !== "company")].map((i) => ({
      url: i.url, alt: i.alt, origin: i.origin === "company" ? ("company" as const) : i.origin === "generated" ? ("generated" as const) : ("stock" as const),
      license: i.license ?? undefined, sourceUrl: i.sourceUrl ?? undefined, credit: i.credit ?? undefined,
    }));
    const need = Math.max(0, 5 - fromLead.length);
    const [{ copy, ai }, stock] = await Promise.all([
      generateSiteCopy(info, segment, b.instructions, language),
      need && !company.isDemo ? searchLicensedImages(segment.imageQuery, need + 3, { curated: true }).catch(() => []) : Promise.resolve([]),
    ]);
    const extra = stock.slice(0, need);
    extra.forEach((i) => i.downloadLocation && void trackImageDownload(i.downloadLocation));
    const content = buildSiteContent(info, segment, copy, [
      ...fromLead,
      ...extra.map((i) => ({ url: i.url, alt: i.alt, credit: i.credit, origin: "stock" as const, license: i.license, sourceUrl: i.sourceUrl })),
    ]);
    if (company.isDemo) content.reviewNotes.unshift("LEAD DE DEMONSTRAÇÃO: os dados da empresa são fictícios.");
    const used = JSON.stringify(content.sections);
    const usedExtra = extra.filter((i) => used.includes(i.url)).length;
    if (usedExtra) content.reviewNotes.push(`${usedExtra} imagem(ns) de banco com licença (${extra[0]!.source}) entraram automaticamente, com crédito: confira se combinam com a empresa e troque se preciso.`);
    if (!fromLead.length && !extra.length) content.reviewNotes.push("Nenhuma imagem com licença foi adicionada: use o banco de imagens, imagens autorizadas da empresa ou o assistente do Google Flow.");
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
