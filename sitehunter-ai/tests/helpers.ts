import { prisma } from "@/lib/db";

/** Limpa as tabelas do banco de TESTE entre os casos. */
export async function cleanDb() {
  if (!/_test\b/.test(process.env.DATABASE_URL ?? "")) throw new Error("cleanDb só roda em banco de teste");
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AuditLog","RateLimit","UsageCounter","Proposal","Publication","ProjectVersion","Project","Company","WebhookEvent","Payment","Subscription","AuthToken","Session","User","PlatformSettings" RESTART IDENTITY CASCADE`,
  );
}

export async function makeUser(email: string, opts: { premiumUntil?: Date; role?: "ADMIN" | "SUBSCRIBER" } = {}) {
  return prisma.user.create({
    data: {
      name: email.split("@")[0]!,
      email,
      passwordHash: "x",
      role: opts.role ?? "SUBSCRIBER",
      subscription: { create: opts.premiumUntil ? { status: "ACTIVE", currentPeriodEnd: opts.premiumUntil } : { status: "NONE" } },
    },
  });
}
