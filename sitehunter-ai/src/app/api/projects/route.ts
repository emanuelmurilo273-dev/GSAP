import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, refundUsage } from "@/lib/usage";
import { generateSiteCopy } from "@/lib/ai";
import { buildSiteContent, getSegment } from "@/lib/site/templates";
import { searchLicensedImages, trackImageDownload } from "@/lib/images";
import { libraryImages, libraryKey } from "@/lib/site/photoLibrary";
import { nicheOf } from "@/lib/site/nicheProfile";
import { env } from "@/lib/env";
import { probeImage } from "@/lib/site/imageProbe";
import type { ImageCandidate } from "@/lib/leads/types";
import type { SiteImage } from "@/lib/site/types";
import { OBJECT_QUERY } from "@/lib/site/stage";
import { buildConcept, varyConcept } from "@/lib/site/immersive/concept";
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
    // Fotos da empresa precisam abrir e ter tamanho suficiente; as que não servem ficam só no lead.
    const checked = await Promise.all(fromLead.map(async (i) => ({ i, probe: i.origin === "company" ? await probeImage(i.url) : { ok: true as const, width: null } })));
    const usable = checked.filter((x) => x.probe.ok && (x.probe.width == null || x.probe.width >= 700)).map((x) => x.i);
    const rejected = checked.length - usable.length;
    // Completa com a biblioteca de fotos do app: escolhidas à mão por ramo, domínio público, sempre carregam.
    const draftConcept = buildConcept({ name: info.name, category: info.category, segmentKey: segment.key, description: info.ownDescription?.text ?? null });
    const need = Math.max(0, 7 - usable.length);
    // Capas já usadas nas outras prévias deste usuário: a nova empresa abre com outra foto do ramo.
    const usedCovers = new Set<string>();
    for (const o of await prisma.project.findMany({ where: { userId: user.id, companyId: { not: company.id } }, select: { content: true }, take: 300 })) {
      const h = (o.content as { sections?: { type: string; image?: { url?: string } }[] } | null)?.sections?.find((x) => x.type === "hero");
      if (h?.image?.url) usedCovers.add(h.image.url);
    }
    const extra = need && !company.isDemo ? libraryImages(libraryKey(draftConcept.model, segment.key), draftConcept.seed, need, usedCovers) : [];
    const { copy, ai } = await generateSiteCopy(info, segment, b.instructions, language);
    const content = buildSiteContent(info, segment, copy, [...usable, ...extra]);
    content.libraryVersion = 1;
    // Cena do Spline configurada para o ramo (SPLINE_SCENES): só entra se o ramo tiver uma cena válida.
    if (content.concept) {
      const sceneUrl = env.splineScenes[nicheOf(content.concept.model, `${info.name} ${info.category ?? ""} ${segment.key}`).key];
      if (sceneUrl) content.concept = { ...content.concept, spline: { url: sceneUrl } };
    }
    if (rejected) content.reviewNotes.push(`${rejected} foto(s) aprovada(s) da empresa não abriram ou são pequenas demais para o site (menos de 700 px): continuam no lead, mas ficaram fora da página.`);
    // Nunca repetir a mesma combinação (objeto + paleta + composição) de outra prévia do usuário.
    if (content.concept) {
      const others = await prisma.project.findMany({ where: { userId: user.id, companyId: { not: company.id } }, select: { content: true }, take: 200 });
      const sig = (k: { model: string; palette: { accent: string }; layout: string }) => `${k.model}|${k.palette.accent}|${k.layout}`;
      const used = new Set(others.map((o) => (o.content as { concept?: Parameters<typeof sig>[0] } | null)?.concept).filter((k): k is Parameters<typeof sig>[0] => !!k).map(sig));
      const usedPal = new Set(others.map((o) => (o.content as { concept?: { model: string; palette: { accent: string } } } | null)?.concept).filter(Boolean).map((k) => `${k!.model}|${k!.palette.accent}`));
      for (let n = 0; n < 6 && (used.has(sig(content.concept)) || usedPal.has(`${content.concept.model}|${content.concept.palette.accent}`)); n++) content.concept = varyConcept(content.concept);
    }
    // Objeto do palco 3D: foto aprovada da empresa (produto real) ou foto do objeto do setor num banco com licença.
    if (content.stage && content.theme.style !== "immersive") {
      const companyPhoto = fromLead.find((i) => i.origin === "company");
      if (companyPhoto) content.stage.image = companyPhoto;
      else if (!company.isDemo) {
        const objs = await searchLicensedImages(OBJECT_QUERY[content.stage.kind], 4, { curated: true }).catch(() => []);
        const pick = objs.find((o) => !JSON.stringify(content.sections).includes(o.url));
        if (pick) {
          content.stage.image = { url: pick.url, alt: pick.alt, credit: pick.credit, origin: "stock", license: pick.license, sourceUrl: pick.sourceUrl };
          if (pick.downloadLocation) void trackImageDownload(pick.downloadLocation);
        }
      }
      content.reviewNotes.push(content.stage.image ? "Palco 3D: confira se a foto do objeto representa bem a empresa (aba Design permite trocar por ilustração)." : "Palco 3D usando ilustração em relevo; aprove uma foto real do produto no lead para usá-la no lugar.");
    }
    if (company.isDemo) content.reviewNotes.unshift("LEAD DE DEMONSTRAÇÃO: os dados da empresa são fictícios.");
    const used = JSON.stringify(content.sections);
    const usedExtra = extra.filter((i) => used.includes(i.url)).length;
    if (usedExtra) content.reviewNotes.push(`${usedExtra} foto(s) ilustrativa(s) da biblioteca do app (domínio público, escolhidas para o ramo) entraram com crédito. Se a empresa tiver fotos próprias autorizadas, aprove-as no lead e gere de novo.`);
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
