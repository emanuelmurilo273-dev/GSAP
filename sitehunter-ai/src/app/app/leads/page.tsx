import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { providerStatus } from "@/lib/leads/providers";
import { leadView } from "@/lib/leads/verified";
import { SEGMENTS } from "@/lib/site/templates";
import { LeadsStudio } from "@/components/leads/LeadsStudio";

export default async function LeadsPage() {
  const user = await pageUser();
  const [companies, searches] = await Promise.all([
    prisma.company.findMany({ where: { userId: user.id }, orderBy: [{ opportunityScore: "desc" }, { createdAt: "desc" }], include: { projects: { select: { id: true, name: true } } }, take: 500 }),
    prisma.leadSearch.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 20 }),
  ]);
  return (
    <>
      <PageHeader title="Estúdio de leads" subtitle="Descubra empresas com presença digital fraca, confira cada fato com sua fonte e transforme em prévia de site." />
      <LeadsStudio
        premium={user.access.premium}
        providers={providerStatus()}
        nicheSuggestions={SEGMENTS.map((s) => s.query)}
        initialLeads={companies.map(leadView)}
        initialSearches={searches.map((s) => ({ ...s, log: (s.log ?? null) as never, startedAt: s.startedAt.toISOString(), finishedAt: s.finishedAt?.toISOString() ?? null }))}
      />
    </>
  );
}
