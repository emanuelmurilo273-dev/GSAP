import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { leadView } from "@/lib/leads/verified";

export const GET = route(async (req) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams;
  const view = q.get("view") ?? "active"; // active | excluded | all
  const demo = q.get("demo"); // "1" só demo, "0" só reais
  const companies = await prisma.company.findMany({
    where: {
      userId: user.id,
      ...(q.get("searchId") ? { searchId: q.get("searchId")! } : {}),
      ...(view === "active" ? { excludedAt: null } : view === "excluded" ? { excludedAt: { not: null } } : {}),
      ...(demo === "1" ? { isDemo: true } : demo === "0" ? { isDemo: false } : {}),
    },
    orderBy: [{ opportunityScore: "desc" }, { createdAt: "desc" }],
    include: { projects: { select: { id: true, name: true, publication: { select: { status: true } } } } },
    take: 500,
  });
  return json({ leads: companies.map(leadView) });
});
