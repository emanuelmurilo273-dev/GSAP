import { prisma } from "./db";
import { HttpError } from "./http";
import { getSettings } from "./settings";

export type UsageKind = "searches" | "generations";

/** Período de contabilização no fuso de Brasília (AAAA-MM). */
export function currentPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

async function limitFor(kind: UsageKind) {
  const s = await getSettings();
  return kind === "searches" ? s.maxSearchesPerMonth : s.maxGenerationsPerMonth;
}

/**
 * Consome 1 unidade de forma atômica: o incremento só acontece se o valor
 * atual for menor que o limite (UPDATE ... WHERE count < limit), o que
 * impede ultrapassar o limite mesmo com requisições simultâneas.
 */
export async function consumeUsage(userId: string, kind: UsageKind) {
  const period = currentPeriod();
  const limit = await limitFor(kind);
  await prisma.$executeRaw`INSERT INTO "UsageCounter" ("id", "userId", "period", "searches", "generations", "updatedAt")
    VALUES (${"uc_" + userId + "_" + period}, ${userId}, ${period}, 0, 0, NOW()) ON CONFLICT ("userId", "period") DO NOTHING`;
  const res = await prisma.usageCounter.updateMany({
    where: { userId, period, [kind]: { lt: limit } },
    data: { [kind]: { increment: 1 } },
  });
  if (res.count === 0) {
    throw new HttpError(
      429,
      kind === "searches"
        ? `Você atingiu o limite de ${limit} pesquisas neste mês.`
        : `Você atingiu o limite de ${limit} gerações de sites neste mês.`,
      "usage_limit",
    );
  }
}

/** Devolve 1 unidade (quando a operação falhou por erro externo). */
export async function refundUsage(userId: string, kind: UsageKind) {
  const period = currentPeriod();
  await prisma.usageCounter.updateMany({ where: { userId, period, [kind]: { gt: 0 } }, data: { [kind]: { decrement: 1 } } });
}

export async function getUsage(userId: string) {
  const period = currentPeriod();
  const s = await getSettings();
  const row = await prisma.usageCounter.findUnique({ where: { userId_period: { userId, period } } });
  const published = await prisma.publication.count({ where: { userId, status: "PUBLISHED" } });
  const mk = (used: number, limit: number) => ({ used, limit, percent: limit ? Math.round((used / limit) * 100) : 0, warn: limit ? (used / limit) * 100 >= s.usageWarnPercent : false });
  return {
    period,
    searches: mk(row?.searches ?? 0, s.maxSearchesPerMonth),
    generations: mk(row?.generations ?? 0, s.maxGenerationsPerMonth),
    published: mk(published, s.maxPublishedSites),
  };
}
