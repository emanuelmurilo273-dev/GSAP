import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { leadView } from "@/lib/leads/verified";
import { guessSegmentKey } from "@/lib/leads/normalize";
import { SEGMENTS } from "@/lib/site/templates";
import { aiConfigured } from "@/lib/ai";
import { LeadProfile } from "@/components/leads/LeadProfile";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const { id } = await params;
  const c = await prisma.company.findFirst({ where: { id, userId: user.id }, include: { projects: { select: { id: true, name: true }, orderBy: { updatedAt: "desc" } } } });
  if (!c) notFound();
  const drafts = await prisma.outreachDraft.findMany({ where: { userId: user.id, companyId: c.id }, orderBy: { createdAt: "desc" } });
  return (
    <LeadProfile
      initialLead={leadView(c)}
      segments={SEGMENTS.map((s) => ({ key: s.key, label: s.label }))}
      guessedSegment={guessSegmentKey(c.category ?? "", c.category)}
      initialDrafts={drafts.map((d) => ({ id: d.id, language: d.language, subject: d.subject, body: d.body, ai: d.ai, factsUsed: (d.factsUsed ?? []) as never, createdAt: d.createdAt.toISOString() }))}
      ai={aiConfigured()}
      premium={user.access.premium}
      senderName={user.name}
    />
  );
}
