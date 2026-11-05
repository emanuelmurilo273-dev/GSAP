import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { leadView } from "@/lib/leads/verified";
import { guessSegmentKey } from "@/lib/leads/normalize";
import { SEGMENTS, getSegment } from "@/lib/site/templates";
import { aiConfigured } from "@/lib/ai";
import { LeadProfile } from "@/components/leads/LeadProfile";
import { templateWhatsapp } from "@/lib/leads/outreach";
import { publicUrlFor } from "@/lib/publish";
import { LanguageSchema, type Facts, type Language, type Opportunity } from "@/lib/leads/types";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const { id } = await params;
  const c = await prisma.company.findFirst({ where: { id, userId: user.id }, include: { projects: { select: { id: true, name: true, publication: true }, orderBy: { updatedAt: "desc" } } } });
  if (!c) notFound();
  const drafts = await prisma.outreachDraft.findMany({ where: { userId: user.id, companyId: c.id }, orderBy: { createdAt: "desc" } });
  const pub = c.projects[0]?.publication;
  const previewUrl = pub?.status === "PUBLISHED" ? publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt) : null;
  const lang = (LanguageSchema.safeParse(c.language).data ?? "pt-BR") as Language;
  const wa = templateWhatsapp(
    { facts: (c.facts ?? {}) as Facts, opportunities: (c.opportunities ?? []) as Opportunity[], senderName: user.name.split(" ")[0] || user.name, previewUrl, hasPreview: c.projects.length > 0, category: c.category, city: c.city },
    lang,
  );
  return (
    <LeadProfile
      waText={c.waMessage ?? wa.body}
      previewUrl={previewUrl}
      initialLead={leadView(c)}
      segments={SEGMENTS.map((s) => ({ key: s.key, label: s.label }))}
      guessedSegment={guessSegmentKey(c.category ?? "", c.category)}
      initialDrafts={drafts.map((d) => ({ id: d.id, language: d.language, subject: d.subject, body: d.body, ai: d.ai, factsUsed: (d.factsUsed ?? []) as never, createdAt: d.createdAt.toISOString() }))}
      ai={aiConfigured()}
      premium={user.access.premium}
      senderName={user.name}
      imageQuery={getSegment(guessSegmentKey(c.category ?? "", c.category)).imageQuery}
    />
  );
}
