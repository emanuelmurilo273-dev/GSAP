import type { PlatformSettings, Subscription, User } from "@prisma/client";

export type AccessReason =
  | "admin"
  | "active"
  | "canceled_until_period_end"
  | "grace"
  | "no_subscription"
  | "pending_payment"
  | "expired"
  | "refunded"
  | "chargeback"
  | "admin_suspended"
  | "email_not_verified";

export type Access = {
  premium: boolean;
  reason: AccessReason;
  message: string;
  periodEnd: string | null;
};

type SettingsLike = Pick<PlatformSettings, "graceDays">;
type UserLike = Pick<User, "role" | "adminSuspendedAt" | "emailVerifiedAt">;
type SubLike = Pick<Subscription, "status" | "currentPeriodEnd"> | null | undefined;

/**
 * Regra única de acesso Premium, usada pelo painel, pelas APIs, pelo
 * servidor de sites publicados e pela rotina de suspensão.
 */
export function computeAccess(
  user: UserLike,
  sub: SubLike,
  settings: SettingsLike,
  now = new Date(),
  opts: { requireEmailVerification?: boolean } = { requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true" },
): Access {
  const periodEnd = sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null;
  const deny = (reason: AccessReason, message: string): Access => ({ premium: false, reason, message, periodEnd });

  if (user.adminSuspendedAt) return deny("admin_suspended", "Sua conta está suspensa. Entre em contato com o suporte.");
  if (user.role === "ADMIN") return { premium: true, reason: "admin", message: "Administrador", periodEnd };
  if (opts.requireEmailVerification && !user.emailVerifiedAt)
    return deny("email_not_verified", "Confirme seu e-mail para usar os recursos Premium.");

  if (!sub || sub.status === "NONE") return deny("no_subscription", "Assine o plano Premium para usar este recurso.");
  if (sub.status === "PENDING") return deny("pending_payment", "Pagamento pendente. O acesso é liberado após a confirmação.");
  if (sub.status === "REFUNDED") return deny("refunded", "Assinatura reembolsada. Assine novamente para recuperar o acesso.");
  if (sub.status === "CHARGEBACK") return deny("chargeback", "Pagamento contestado (chargeback). Entre em contato com o suporte.");

  const end = sub.currentPeriodEnd?.getTime();
  if (end && now.getTime() < end) {
    if (sub.status === "CANCELED")
      return { premium: true, reason: "canceled_until_period_end", message: "Renovação cancelada — acesso até o fim do período pago.", periodEnd };
    return { premium: true, reason: "active", message: "Assinatura ativa", periodEnd };
  }
  const graceMs = (settings.graceDays ?? 0) * 86400_000;
  if (end && graceMs > 0 && now.getTime() < end + graceMs && (sub.status === "ACTIVE" || sub.status === "PAST_DUE")) {
    return { premium: true, reason: "grace", message: "Pagamento em atraso — regularize para evitar a suspensão.", periodEnd };
  }
  return deny("expired", "Sua assinatura venceu. Renove para reativar os recursos e os sites publicados.");
}
