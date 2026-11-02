import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/http";

/** Portabilidade (LGPD): exporta os dados do usuário em JSON. */
export const GET = route(async () => {
  const user = await requireUser();
  const [companies, projects, proposals, payments, usage] = await Promise.all([
    prisma.company.findMany({ where: { userId: user.id } }),
    prisma.project.findMany({ where: { userId: user.id }, include: { publication: { select: { slug: true, status: true, customDomain: true, publishedAt: true } } } }),
    prisma.proposal.findMany({ where: { userId: user.id } }),
    prisma.payment.findMany({ where: { userId: user.id }, select: { providerOrderId: true, status: true, grossAmountCents: true, approvedAt: true, createdAt: true } }),
    prisma.usageCounter.findMany({ where: { userId: user.id } }),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email, createdAt: user.createdAt, emailVerifiedAt: user.emailVerifiedAt },
    subscription: user.subscription && { status: user.subscription.status, startedAt: user.subscription.startedAt, currentPeriodEnd: user.subscription.currentPeriodEnd },
    companies,
    projects,
    proposals,
    payments,
    usage,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="meus-dados-sitehunter.json"' },
  });
});
