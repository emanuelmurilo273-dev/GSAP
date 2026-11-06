import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { templateWhatsapp } from "@/lib/leads/outreach";
import { hasConfirmedWhatsapp, leadStage } from "@/lib/leads/verified";
import { publicUrlFor } from "@/lib/publish";
import { LanguageSchema, type Facts, type Language, type Opportunity } from "@/lib/leads/types";
import { AbordagensClient, type WaItem } from "./AbordagensClient";

export default async function AbordagensPage() {
  const user = await pageUser();
  const companies = await prisma.company.findMany({
    where: { userId: user.id, excludedAt: null, whatsapp: { not: null } },
    orderBy: [{ contactedAt: { sort: "asc", nulls: "first" } }, { opportunityScore: "desc" }],
    include: { projects: { orderBy: { updatedAt: "desc" }, select: { id: true, publication: true } } },
    take: 300,
  });
  const sender = user.name.split(" ")[0] || user.name;
  const items: WaItem[] = companies
    .filter((c) => hasConfirmedWhatsapp(c) || c.isDemo)
    .map((c) => {
      const pub = c.projects.find((p) => p.publication?.status === "PUBLISHED")?.publication;
      const previewUrl = pub ? publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt) : null;
      const facts = (c.facts ?? {}) as Facts;
      const lang = (LanguageSchema.safeParse(c.language).data ?? "pt-BR") as Language;
      const draft = templateWhatsapp({ facts, opportunities: (c.opportunities ?? []) as Opportunity[], senderName: sender, previewUrl, hasPreview: c.projects.length > 0, category: c.category, city: c.city }, lang);
      return {
        id: c.id, name: c.name, city: c.city, category: c.category, isDemo: c.isDemo,
        whatsapp: c.whatsapp!, waSource: facts.whatsapp?.source ?? "", waSourceUrl: facts.whatsapp?.sourceUrl ?? null, waWarning: facts.whatsapp?.note?.match(/Atenção:.*$/)?.[0] ?? null,
        stage: leadStage(c), suggested: draft.body, saved: c.waMessage, basis: draft.basis, needsEdit: draft.needsEdit,
        observation: draft.observation, hasPreview: c.projects.length > 0, previewUrl, projectId: c.projects[0]?.id ?? null,
      };
    });
  return (
    <>
      <PageHeader title="Abordagens" subtitle="Mensagens de WhatsApp que começam pelo problema ou oportunidade observada. Revise, edite e abra a conversa: quem envia é sempre você." />
      <AbordagensClient items={items} />
    </>
  );
}
