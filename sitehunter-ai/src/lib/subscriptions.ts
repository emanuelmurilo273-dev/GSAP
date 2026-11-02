import type { PlatformSettings } from "@prisma/client";
import { prisma } from "./db";
import { computeAccess } from "./access";
import { audit, log } from "./logger";
import { getSettings } from "./settings";
import { sendEmail } from "./email";
import { env } from "./env";

/**
 * Sincroniza os sites de um usuário com o estado da assinatura:
 * - sem acesso → sites PUBLISHED passam a SUSPENDED e é definido o prazo de retenção;
 * - com acesso → sites SUSPENDED voltam ao ar (respeitando o limite do plano).
 */
export async function syncUserSites(userId: string, settings?: PlatformSettings, now = new Date()) {
  const s = settings ?? (await getSettings());
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { subscription: true } });
  if (!user) return;
  const access = computeAccess(user, user.subscription, s, now);

  if (!access.premium) {
    const res = await prisma.publication.updateMany({ where: { userId, status: "PUBLISHED" }, data: { status: "SUSPENDED", suspendedAt: now } });
    if (user.subscription && !user.subscription.suspendedAt) {
      const base = user.subscription.currentPeriodEnd && user.subscription.currentPeriodEnd < now ? user.subscription.currentPeriodEnd : now;
      // Retenção contada a partir do vencimento, com no mínimo 7 dias de aviso após a suspensão.
      const retentionUntil = new Date(Math.max(base.getTime() + s.retentionDays * 86400_000, now.getTime() + 7 * 86400_000));
      await prisma.subscription.update({
        where: { userId },
        data: { suspendedAt: now, retentionUntil, ...(user.subscription.status === "ACTIVE" || user.subscription.status === "PAST_DUE" || user.subscription.status === "CANCELED" ? { status: "EXPIRED" } : {}) },
      });
      await audit("subscription_suspended", { userId, meta: { reason: access.reason, sitesSuspended: res.count, retentionUntil } });
      if (!user.adminSuspendedAt) {
        await sendEmail(
          user.email,
          "SiteHunter AI — recursos Premium suspensos",
          `Olá, ${user.name}.\n\nSua assinatura do SiteHunter AI não está ativa (${access.message}). Os recursos Premium foram suspensos e ${res.count} site(s) publicado(s) foram retirados do ar temporariamente.\n\nSeus projetos ficarão preservados até ${retentionUntil.toLocaleDateString("pt-BR")}. Após essa data eles poderão ser excluídos, conforme os Termos de Uso. Você pode exportar os arquivos dos sites a qualquer momento nesse período.\n\nPara reativar, renove a assinatura: ${env.appUrl}/app/assinatura\n`,
        ).catch((e) => log("error", "email_failed", { error: String(e) }));
      }
    } else if (res.count > 0) {
      await audit("sites_suspended", { userId, meta: { count: res.count } });
    }
    return { premium: false, changed: res.count };
  }

  // Com acesso: limpa marcação de suspensão e reativa sites elegíveis.
  if (user.subscription?.suspendedAt || user.subscription?.retentionUntil) {
    await prisma.subscription.update({ where: { userId }, data: { suspendedAt: null, retentionUntil: null } });
  }
  const live = await prisma.publication.count({ where: { userId, status: "PUBLISHED" } });
  const room = Math.max(0, s.maxPublishedSites - live);
  if (room === 0) return { premium: true, changed: 0 };
  const suspended = await prisma.publication.findMany({
    where: { userId, status: "SUSPENDED", html: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: room,
    select: { id: true },
  });
  if (suspended.length) {
    await prisma.publication.updateMany({ where: { id: { in: suspended.map((p) => p.id) } }, data: { status: "PUBLISHED", suspendedAt: null } });
    await audit("sites_reactivated", { userId, meta: { count: suspended.length } });
  }
  return { premium: true, changed: suspended.length };
}

/**
 * Rotina periódica (cron): suspende assinaturas vencidas e aplica a política
 * de retenção (exclusão de projetos após o prazo informado ao usuário).
 */
export async function runSubscriptionSweep(now = new Date()) {
  const s = await getSettings();
  const graceMs = s.graceDays * 86400_000;
  // 1) Vencidas: período terminou (+ carência) e ainda não foram suspensas.
  const due = await prisma.subscription.findMany({
    where: { suspendedAt: null, OR: [{ currentPeriodEnd: { lt: new Date(now.getTime() - graceMs) } }, { status: { in: ["REFUNDED", "CHARGEBACK", "EXPIRED"] } }] },
    select: { userId: true },
  });
  let suspendedUsers = 0;
  for (const d of due) {
    const r = await syncUserSites(d.userId, s, now);
    if (r && !r.premium) suspendedUsers++;
  }
  // 2) Retenção: projetos de contas suspensas há mais de retentionDays.
  const expired = await prisma.subscription.findMany({ where: { retentionUntil: { lt: now }, suspendedAt: { not: null } }, include: { user: true } });
  let purgedProjects = 0;
  for (const sub of expired) {
    const access = computeAccess(sub.user, sub, s, now);
    if (access.premium) continue;
    const del = await prisma.project.deleteMany({ where: { userId: sub.userId } });
    purgedProjects += del.count;
    await prisma.subscription.update({ where: { userId: sub.userId }, data: { retentionUntil: null } });
    await audit("retention_purge", { userId: sub.userId, meta: { projectsDeleted: del.count } });
  }
  // 3) Sessões e tokens expirados; limitação de requisições antiga.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400_000) } } });
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86400_000) } } });
  log("info", "subscription_sweep", { checked: due.length, suspendedUsers, purgedProjects });
  return { checked: due.length, suspendedUsers, purgedProjects };
}
