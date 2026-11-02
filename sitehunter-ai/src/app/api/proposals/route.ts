import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium, requireUser } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { ownProject } from "@/lib/projects";
import { generateProposalText } from "@/lib/ai";
import { getSegment } from "@/lib/site/templates";
import { ProposalDefaultsSchema, type ProposalContent } from "@/lib/proposal";
import { SiteContentSchema } from "@/lib/site/types";
import { publicUrlFor } from "@/lib/publish";

export const GET = route(async () => {
  const user = await requireUser();
  const proposals = await prisma.proposal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, priceCents: true, createdAt: true, updatedAt: true, projectId: true, company: { select: { name: true } } },
  });
  return json({ proposals });
});

const Body = z.object({ projectId: z.string().min(1) });

/** "Criar proposta comercial": a IA escreve os textos; preços vêm das configurações do usuário. */
export const POST = route(async (req) => {
  const user = await requirePremium();
  await rateLimit(`proposal:${user.id}`, 10, 60);
  const { projectId } = await parseJson(req, Body);
  const project = await ownProject(user.id, projectId);
  const content = SiteContentSchema.parse(project.content);
  const defaults = ProposalDefaultsSchema.parse(user.proposalDefaults ?? {});
  const company = project.company ?? { name: content.business.name, address: content.business.address };
  const titles = content.sections.filter((s) => s.visible && s.type !== "hero").map((s) => s.title);
  const { text, ai } = await generateProposalText(company, getSegment(project.segment), titles);
  const pub = project.publication;
  const proposal: ProposalContent = {
    companyName: company.name,
    summary: text.summary,
    benefits: text.benefits,
    features: text.features,
    developmentPriceCents: defaults.developmentPriceCents,
    deliveryDays: defaults.deliveryDays,
    paymentTerms: defaults.paymentTerms,
    domainYearlyCents: defaults.domainYearlyCents,
    hostingMonthlyCents: defaults.hostingMonthlyCents,
    maintenanceMonthlyCents: defaults.maintenanceMonthlyCents,
    includeMaintenance: true,
    validityDays: defaults.validityDays,
    extraTerms: "Alterações fora do escopo descrito serão orçadas à parte. Textos, fotos e informações da empresa devem ser fornecidos ou aprovados pelo cliente.",
    closing: text.closing,
    senderName: defaults.senderName || user.name,
    senderContact: defaults.senderContact || user.email,
    siteUrl: pub?.status === "PUBLISHED" ? publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt) : undefined,
  };
  const created = await prisma.proposal.create({
    data: { userId: user.id, projectId: project.id, companyId: project.companyId, title: `Proposta — ${company.name}`, content: proposal as never, priceCents: proposal.developmentPriceCents },
  });
  return json({ proposal: { id: created.id }, ai }, 201);
});
