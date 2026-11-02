import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, refundUsage } from "@/lib/usage";
import { generateSiteCopy } from "@/lib/ai";
import { applyConfirmed, buildSiteContent, completeCopy, getSegment } from "@/lib/site/templates";
import type { Research } from "@/lib/research";
import type { PlaceReviews } from "@/lib/places";
import { reviewSite } from "@/lib/site/review";
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
    const research = (company.research as Research | null) ?? null;
    const reviews = (company.reviews as PlaceReviews | null) ?? null;
    // Dados confirmados na pesquisa complementam a ficha do Google (que tem prioridade).
    const info = {
      ...company,
      website: company.website || research?.contacts.website || null,
      instagram: research?.contacts.instagram || null,
      hours: company.hours.length ? company.hours : (research?.hours ?? []),
      address: company.address || research?.address || null,
    };
    const { copy: rawCopy, ai } = await generateSiteCopy(info, segment, b.instructions, { menuText: b.menuText, senderName: user.name.split(" ")[0], confirmed: research });
    const applied = applyConfirmed(completeCopy(rawCopy, info, segment), b.menuText ? null : research, segment);
    const copy = applied.copy;
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
      siteImages = [];
    }
    // Fotos publicadas pela própria empresa (site/perfis oficiais), já verificadas na pesquisa.
    for (const p of research?.officialPhotos ?? []) {
      if (siteImages.length >= 10) break;
      let host = "";
      try { host = new URL(p.pageUrl || p.url).hostname.replace(/^www\./, ""); } catch {}
      siteImages.push({ url: p.url, alt: p.description || `Foto de ${company.name}`, credit: { name: host || "site oficial", link: p.pageUrl || p.url, source: "site" } });
    }
    // Sem fotos próprias: imagens ilustrativas do segmento, sinalizadas como "Imagem ilustrativa".
    if (!siteImages.length) siteImages = stockImages(segment.key, `${env.appUrl}/`, company.id);
    const content = buildSiteContent(info, segment, copy, siteImages, {
      designKey: company.id,
      brandColors: research?.brandColors,
      email: research?.contacts.email || null,
      whatsapp: research?.contacts.whatsapp || null,
      reviews,
      sources: research?.sources,
      needsConfirmation: research?.needsConfirmation,
      suggested: research ? applied.suggested : undefined,
    });
    content.reviewNotes = [...reviewSite(content), ...content.reviewNotes].slice(0, 24);
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
