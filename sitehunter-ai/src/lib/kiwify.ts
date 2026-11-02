import type { PaymentStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db";
import { hmacSha1Hex, safeEqual } from "./crypto";
import { env } from "./env";
import { audit, log } from "./logger";
import { syncUserSites } from "./subscriptions";
import { getSettings } from "./settings";

// Integração com webhooks da Kiwify, conforme https://docs.kiwify.com.br/api-reference/webhooks/receiving
// - A Kiwify envia POST com JSON e o parâmetro de query `signature`:
//   HMAC-SHA1 (hex minúsculo) do corpo bruto, com o token do webhook como chave.
// - Não há proteção contra replay nem id de entrega: deduplicamos por evento.
// - Reenvios acontecem em caso de falha; o processamento é idempotente.

export function verifyKiwifySignature(rawBody: string, signature: string | null, tokens = env.kiwifyWebhookTokens): boolean {
  if (!signature || tokens.length === 0) return false;
  const sig = signature.trim().toLowerCase();
  return tokens.some((t) => safeEqual(hmacSha1Hex(t, rawBody), sig));
}

// Campos documentados (receiving + subscription-events). Campos de Customer,
// Commissions e TrackingParameters existem no payload, mas seus nomes internos
// não estão detalhados na documentação — por isso são lidos defensivamente.
export type KiwifyPayload = {
  order_id?: string;
  order_status?: string; // paid | refused | refunded | chargedback | waiting_payment
  webhook_event_type?: string; // order_approved | order_rejected | order_refunded | chargeback | billet_created | pix_created | subscription_canceled | subscription_late | subscription_renewed
  payment_method?: string;
  approved_date?: string; // "YYYY-MM-DD HH:mm" (horário de Brasília)
  subscription_id?: string;
  Subscription?: {
    id?: string;
    status?: string; // active | waiting_payment | canceled | ended
    start_date?: string;
    next_payment?: string;
    plan?: { id?: string; name?: string; frequency?: string };
    customer_access?: { has_access?: boolean; active_period?: boolean; access_until?: string };
  };
  Customer?: Record<string, unknown>;
  Commissions?: Record<string, unknown>;
  TrackingParameters?: Record<string, unknown>;
  [k: string]: unknown;
};

const PAYMENT_STATUS: Record<string, PaymentStatus> = {
  paid: "PAID",
  refused: "REFUSED",
  refunded: "REFUNDED",
  chargedback: "CHARGEDBACK",
  waiting_payment: "WAITING_PAYMENT",
};

function pickStr(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickInt(obj: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  }
  return undefined;
}

/** "YYYY-MM-DD HH:mm" em horário de Brasília (UTC-3) → Date. Datas ISO também são aceitas. */
export function parseKiwifyDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]! + 3, +m[5]!, +(m[6] ?? 0)));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function extractEmail(p: KiwifyPayload): string | undefined {
  const e = pickStr(p.Customer, ["email", "Email"]) ?? (typeof p.customer_email === "string" ? p.customer_email : undefined);
  return e?.toLowerCase();
}

export function extractTrackingRef(p: KiwifyPayload): string | undefined {
  return pickStr(p.TrackingParameters, ["sck", "s1", "src"]);
}

export function dedupeKey(p: KiwifyPayload): string {
  return [
    "kiwify",
    p.order_id ?? "no-order",
    p.webhook_event_type ?? p.order_status ?? "unknown",
    p.Subscription?.status ?? "",
    p.Subscription?.next_payment ?? "",
    p.Subscription?.customer_access?.access_until ?? "",
  ].join(":");
}

async function findUserForPayload(p: KiwifyPayload, tx: Prisma.TransactionClient) {
  const ref = extractTrackingRef(p);
  if (ref) {
    const u = await tx.user.findUnique({ where: { checkoutRef: ref } });
    if (u) return u;
  }
  const subId = p.subscription_id ?? p.Subscription?.id;
  if (subId) {
    const s = await tx.subscription.findUnique({ where: { providerSubscriptionId: subId }, include: { user: true } });
    if (s) return s.user;
  }
  if (p.order_id) {
    const pay = await tx.payment.findUnique({ where: { provider_providerOrderId: { provider: "kiwify", providerOrderId: p.order_id } }, include: { user: true } });
    if (pay?.user) return pay.user;
  }
  const email = extractEmail(p);
  if (email) return tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  return null;
}

/** Fim do período pago segundo a Kiwify (customer_access.access_until, senão next_payment). */
function periodEndFrom(p: KiwifyPayload): Date | null {
  return parseKiwifyDate(p.Subscription?.customer_access?.access_until) ?? parseKiwifyDate(p.Subscription?.next_payment);
}

type Outcome = { userId: string | null; subscriptionStatus?: SubscriptionStatus; note?: string };

/**
 * Aplica um evento já autenticado. Idempotente: reprocessar o mesmo evento
 * produz o mesmo estado (upsert por order_id e por subscription_id).
 */
export async function applyKiwifyEvent(p: KiwifyPayload, now = new Date()): Promise<Outcome> {
  const event = p.webhook_event_type ?? "";
  const orderStatus = p.order_status ?? "";
  if (!p.order_id) return { userId: null, note: "evento sem order_id (ex.: carrinho abandonado) — ignorado" };

  const settings = await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    const user = await findUserForPayload(p, tx);
    const subId = p.subscription_id ?? p.Subscription?.id ?? null;
    const payStatus = PAYMENT_STATUS[orderStatus];

    // 1) Pagamento (um registro por pedido/cobrança)
    if (payStatus) {
      const approvedAt = parseKiwifyDate(p.approved_date);
      const gross = pickInt(p.Commissions, ["charge_amount", "product_base_price"]);
      const fee = pickInt(p.Commissions, ["kiwify_fee", "fee"]);
      const net = pickInt(p.Commissions, ["my_commission", "net_amount"]);
      const data = {
        userId: user?.id ?? undefined,
        providerSubscriptionId: subId,
        status: payStatus,
        paymentMethod: p.payment_method ?? null,
        customerEmail: extractEmail(p) ?? null,
        ...(gross != null ? { grossAmountCents: gross } : {}),
        ...(fee != null ? { feeCents: fee } : {}),
        ...(net != null ? { netAmountCents: net } : {}),
        ...(approvedAt ? { approvedAt } : {}),
        ...(payStatus === "REFUNDED" || payStatus === "CHARGEDBACK" ? { refundedAt: now } : {}),
      };
      await tx.payment.upsert({
        where: { provider_providerOrderId: { provider: "kiwify", providerOrderId: p.order_id! } },
        create: { provider: "kiwify", providerOrderId: p.order_id!, ...data },
        update: data,
      });
    }

    if (!user) return { userId: null, note: "pagamento sem conta correspondente — aguardando vínculo" } as Outcome;

    // 2) Assinatura
    const current = await tx.subscription.findUnique({ where: { userId: user.id } });
    const periodEnd = periodEndFrom(p);
    let status: SubscriptionStatus = current?.status ?? "NONE";
    let currentPeriodEnd = current?.currentPeriodEnd ?? null;
    let canceledAt = current?.canceledAt ?? null;
    let cancelReason = current?.cancelReason ?? null;
    const hasAccess = p.Subscription?.customer_access?.has_access;

    if (orderStatus === "refunded" || event === "order_refunded") {
      status = "REFUNDED";
      currentPeriodEnd = now;
      canceledAt = now;
      cancelReason = "reembolso";
    } else if (orderStatus === "chargedback" || event === "chargeback") {
      // A Kiwify não zera customer_access no chargeback: revogamos aqui.
      status = "CHARGEBACK";
      currentPeriodEnd = now;
      canceledAt = now;
      cancelReason = "chargeback";
    } else if (event === "order_approved" || event === "subscription_renewed" || (orderStatus === "paid" && event !== "subscription_canceled" && event !== "subscription_late")) {
      status = "ACTIVE";
      const fallbackEnd = new Date((parseKiwifyDate(p.approved_date) ?? now).getTime() + 31 * 86400_000);
      const end = periodEnd ?? fallbackEnd;
      currentPeriodEnd = currentPeriodEnd && currentPeriodEnd > end && current?.status === "ACTIVE" ? currentPeriodEnd : end;
      canceledAt = null;
      cancelReason = null;
    } else if (event === "subscription_canceled") {
      status = "CANCELED";
      canceledAt = canceledAt ?? now;
      cancelReason = cancelReason ?? "renovação cancelada";
      if (hasAccess === false) currentPeriodEnd = periodEnd && periodEnd < now ? periodEnd : now;
      else if (periodEnd) currentPeriodEnd = periodEnd;
    } else if (event === "subscription_late") {
      status = "PAST_DUE";
      if (periodEnd) currentPeriodEnd = periodEnd;
    } else if (event === "billet_created" || event === "pix_created" || orderStatus === "waiting_payment") {
      if (status === "NONE") status = "PENDING";
    } else if (event === "order_rejected" || orderStatus === "refused") {
      if (status === "PENDING") status = "NONE";
    }

    const subData = {
      providerSubscriptionId: subId ?? current?.providerSubscriptionId ?? null,
      status,
      planName: p.Subscription?.plan?.name ?? current?.planName ?? null,
      startedAt: current?.startedAt ?? parseKiwifyDate(p.Subscription?.start_date) ?? (status === "ACTIVE" ? now : null),
      currentPeriodEnd,
      canceledAt,
      cancelReason,
    };
    // Se o id da assinatura já pertence a outra conta, não sobrescrevemos.
    if (subData.providerSubscriptionId) {
      const owner = await tx.subscription.findUnique({ where: { providerSubscriptionId: subData.providerSubscriptionId } });
      if (owner && owner.userId !== user.id) {
        log("warn", "kiwify_subscription_owner_conflict", { subId: subData.providerSubscriptionId, userId: user.id });
        subData.providerSubscriptionId = current?.providerSubscriptionId ?? null;
      }
    }
    await tx.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, ...subData }, update: subData });
    return { userId: user.id, subscriptionStatus: status } as Outcome;
  });

  if (result.userId) await syncUserSites(result.userId, settings, now);
  return result;
}

/** Registra e processa um webhook recebido. Retorna o status HTTP a devolver à Kiwify. */
export async function handleKiwifyWebhook(rawBody: string, signature: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  if (env.kiwifyWebhookTokens.length === 0) {
    log("error", "kiwify_token_missing", {});
    return { status: 503, body: { error: "webhook não configurado" } };
  }
  const ok = verifyKiwifySignature(rawBody, signature);
  if (!ok) {
    log("warn", "kiwify_invalid_signature", {});
    return { status: 401, body: { error: "assinatura inválida" } };
  }
  let payload: KiwifyPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "JSON inválido" } };
  }
  const key = dedupeKey(payload);
  const existing = await prisma.webhookEvent.findUnique({ where: { dedupeKey: key } });
  if (existing?.processedAt) return { status: 200, body: { ok: true, duplicate: true } };
  const ev =
    existing ??
    (await prisma.webhookEvent
      .create({ data: { provider: "kiwify", dedupeKey: key, eventType: payload.webhook_event_type ?? payload.order_status ?? "unknown", signatureOk: true, payload: payload as never } })
      .catch(async () => prisma.webhookEvent.findUniqueOrThrow({ where: { dedupeKey: key } })));
  try {
    const outcome = await applyKiwifyEvent(payload);
    await prisma.webhookEvent.update({ where: { id: ev.id }, data: { processedAt: new Date(), error: outcome.note ?? null } });
    await audit("kiwify_webhook", { userId: outcome.userId, meta: { event: payload.webhook_event_type, order: payload.order_id, status: outcome.subscriptionStatus, note: outcome.note } });
    return { status: 200, body: { ok: true } };
  } catch (e) {
    log("error", "kiwify_process_failed", { error: e instanceof Error ? e.stack : String(e) });
    await prisma.webhookEvent.update({ where: { id: ev.id }, data: { error: String(e).slice(0, 1000) } });
    // 500 faz a Kiwify reenviar mais tarde.
    return { status: 500, body: { error: "falha ao processar" } };
  }
}

/** Vincula pagamentos ainda sem conta ao usuário (cadastro posterior ou ação do admin) e reaplica os eventos. */
export async function linkPendingPayments(userId: string, opts: { email?: string; paymentId?: string } = {}) {
  const where = opts.paymentId
    ? { id: opts.paymentId, userId: null }
    : { userId: null, customerEmail: { equals: (opts.email ?? "").toLowerCase(), mode: "insensitive" as const } };
  const pending = await prisma.payment.findMany({ where });
  if (!pending.length) return 0;
  await prisma.payment.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { userId } });
  const events = await prisma.webhookEvent.findMany({ where: { provider: "kiwify" }, orderBy: { receivedAt: "asc" } });
  const orderIds = new Set(pending.map((p) => p.providerOrderId));
  for (const ev of events) {
    const p = ev.payload as KiwifyPayload;
    if (p.order_id && orderIds.has(p.order_id)) await applyKiwifyEvent(p);
  }
  await audit("payments_linked", { userId, meta: { count: pending.length } });
  return pending.length;
}

/** URL do checkout com a referência opaca do usuário como parâmetro de rastreio (sck). */
export function checkoutUrlFor(baseUrl: string, user: { email: string; checkoutRef: string }) {
  const u = new URL(baseUrl);
  u.searchParams.set("sck", user.checkoutRef);
  // Parâmetro de pré-preenchimento de e-mail: não confirmado na documentação pública;
  // se não for suportado, é simplesmente ignorado pelo checkout.
  u.searchParams.set("email", user.email);
  return u.toString();
}
