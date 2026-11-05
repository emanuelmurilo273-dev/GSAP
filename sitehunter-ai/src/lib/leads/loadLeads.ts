import { prisma } from "../db";
import { leadView } from "./verified";

export async function loadLeadsData(userId: string) {
  const [companies, searches] = await Promise.all([
    prisma.company.findMany({ where: { userId }, orderBy: [{ opportunityScore: "desc" }, { createdAt: "desc" }], include: { projects: { select: { id: true, name: true, publication: { select: { status: true } } } } }, take: 500 }),
    prisma.leadSearch.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 20 }),
  ]);
  return {
    initialLeads: companies.map(leadView),
    initialSearches: searches.map((s) => ({ ...s, log: (s.log ?? null) as never, startedAt: s.startedAt.toISOString(), finishedAt: s.finishedAt?.toISOString() ?? null })),
  };
}

