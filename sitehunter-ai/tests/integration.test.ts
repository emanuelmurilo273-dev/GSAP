import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { cleanDb, makeUser } from "./helpers";
import { handleKiwifyWebhook, linkPendingPayments, type KiwifyPayload } from "@/lib/kiwify";
import { hmacSha1Hex } from "@/lib/crypto";
import { consumeUsage } from "@/lib/usage";
import { publishProject, unpublishProject } from "@/lib/publish";
import { runSubscriptionSweep } from "@/lib/subscriptions";
import { serveSite } from "@/lib/serveSite";
import { ownProject } from "@/lib/projects";
import { buildSiteContent, fallbackCopy, getSegment } from "@/lib/site/templates";
import { HttpError } from "@/lib/http";

const TOKEN = "kiwify-token-de-teste";
const day = 86400_000;

function send(p: KiwifyPayload, token = TOKEN) {
  const raw = JSON.stringify(p);
  return handleKiwifyWebhook(raw, hmacSha1Hex(token, raw));
}

function approved(email: string, order: string, accessUntil: Date, extra: Partial<KiwifyPayload> = {}): KiwifyPayload {
  return {
    order_id: order,
    order_status: "paid",
    webhook_event_type: "order_approved",
    payment_method: "credit_card",
    approved_date: "2026-11-02 09:00",
    subscription_id: "sub-1",
    Customer: { email, full_name: "Cliente" },
    Subscription: { id: "sub-1", status: "active", next_payment: accessUntil.toISOString(), customer_access: { has_access: true, access_until: accessUntil.toISOString() }, plan: { name: "Premium", frequency: "monthly" } },
    ...extra,
  };
}

async function projectFor(userId: string, name = "Barbearia Teste") {
  const seg = getSegment("barbearia");
  const company = { name, phone: "(11) 98765-4321", city: "São Paulo" };
  return prisma.project.create({ data: { userId, name, segment: seg.key, content: buildSiteContent(company, seg, fallbackCopy(company, seg)) as never } });
}

beforeEach(cleanDb);

describe("Webhook Kiwify → assinatura", () => {
  it("rejeita assinatura inválida sem alterar nada", async () => {
    const u = await makeUser("a@x.com");
    const r = await send(approved("a@x.com", "o1", new Date(Date.now() + 30 * day)), "token-errado");
    expect(r.status).toBe(401);
    expect((await prisma.subscription.findUnique({ where: { userId: u.id } }))?.status).toBe("NONE");
    expect(await prisma.payment.count()).toBe(0);
  });

  it("pagamento aprovado libera acesso e é idempotente", async () => {
    const u = await makeUser("a@x.com");
    const p = approved("A@X.com", "o1", new Date(Date.now() + 30 * day));
    expect((await send(p)).status).toBe(200);
    const dup = await send(p);
    expect(dup.body.duplicate).toBe(true);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.providerSubscriptionId).toBe("sub-1");
    expect(await prisma.payment.count()).toBe(1);
  });

  it("vincula pela referência de checkout (sck) mesmo com e-mail diferente", async () => {
    const u = await makeUser("conta@x.com");
    await send(approved("outro-email@x.com", "o1", new Date(Date.now() + 30 * day), { TrackingParameters: { sck: u.checkoutRef } }));
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } })).status).toBe("ACTIVE");
  });

  it("pagamento sem conta fica pendente e é vinculado no cadastro", async () => {
    await send(approved("novo@x.com", "o9", new Date(Date.now() + 30 * day)));
    const pay = await prisma.payment.findFirstOrThrow();
    expect(pay.userId).toBeNull();
    const u = await makeUser("novo@x.com");
    expect(await linkPendingPayments(u.id, { email: u.email })).toBe(1);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } })).status).toBe("ACTIVE");
  });

  it("cancelamento mantém o acesso até o fim do período; reembolso revoga e suspende os sites", async () => {
    const u = await makeUser("a@x.com");
    const until = new Date(Date.now() + 20 * day);
    await send(approved("a@x.com", "o1", until));
    const proj = await projectFor(u.id);
    await publishProject(proj, u.id);

    await send({ ...approved("a@x.com", "o1", until), webhook_event_type: "subscription_canceled", Subscription: { id: "sub-1", status: "canceled", customer_access: { has_access: true, access_until: until.toISOString() } } });
    let sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } });
    expect(sub.status).toBe("CANCELED");
    expect((await prisma.publication.findFirstOrThrow()).status).toBe("PUBLISHED");

    await send({ ...approved("a@x.com", "o1", until), order_status: "refunded", webhook_event_type: "order_refunded" });
    sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } });
    expect(sub.status).toBe("REFUNDED");
    expect(sub.retentionUntil).not.toBeNull();
    expect((await prisma.publication.findFirstOrThrow()).status).toBe("SUSPENDED");
    expect((await prisma.payment.findFirstOrThrow()).status).toBe("REFUNDED");
  });

  it("vencimento suspende; pagamento posterior reativa os sites automaticamente", async () => {
    const u = await makeUser("a@x.com", { premiumUntil: new Date(Date.now() + day) });
    const proj = await projectFor(u.id);
    await publishProject(proj, u.id);
    await prisma.subscription.update({ where: { userId: u.id }, data: { currentPeriodEnd: new Date(Date.now() - day) } });

    const r = await runSubscriptionSweep();
    expect(r.suspendedUsers).toBe(1);
    expect((await prisma.publication.findFirstOrThrow()).status).toBe("SUSPENDED");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } });
    expect(sub.status).toBe("EXPIRED");
    // Projetos preservados (não apagados imediatamente)
    expect(await prisma.project.count({ where: { userId: u.id } })).toBe(1);

    await send({ ...approved("a@x.com", "o2", new Date(Date.now() + 30 * day)), webhook_event_type: "subscription_renewed" });
    expect((await prisma.publication.findFirstOrThrow()).status).toBe("PUBLISHED");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } })).retentionUntil).toBeNull();
  });

  it("após o prazo de retenção os projetos são excluídos, mas a conta e os pagamentos ficam", async () => {
    const u = await makeUser("a@x.com", { premiumUntil: new Date(Date.now() - 40 * day) });
    await projectFor(u.id);
    await runSubscriptionSweep(); // suspende e define o prazo de retenção (mínimo de 7 dias de aviso)
    expect(await prisma.project.count()).toBe(1);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: u.id } });
    expect(sub.retentionUntil!.getTime()).toBeGreaterThan(Date.now() + 6 * day);
    await prisma.subscription.update({ where: { userId: u.id }, data: { retentionUntil: new Date(Date.now() - 1000) } });
    await runSubscriptionSweep();
    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("Limites e isolamento", () => {
  it("limite mensal não é ultrapassado nem com requisições simultâneas", async () => {
    const u = await makeUser("a@x.com", { premiumUntil: new Date(Date.now() + 30 * day) });
    await prisma.platformSettings.create({ data: { id: "global", maxSearchesPerMonth: 5 } });
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => consumeUsage(u.id, "searches")));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(5);
    for (const r of results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]) expect((r.reason as HttpError).status).toBe(429);
  });

  it("limite de sites publicados simultaneamente", async () => {
    const u = await makeUser("a@x.com", { premiumUntil: new Date(Date.now() + 30 * day) });
    await prisma.platformSettings.create({ data: { id: "global", maxPublishedSites: 2 } });
    const ps = await Promise.all([projectFor(u.id, "Site Um"), projectFor(u.id, "Site Dois"), projectFor(u.id, "Site Tres")]);
    await publishProject(ps[0]!, u.id);
    await publishProject(ps[1]!, u.id);
    await expect(publishProject(ps[2]!, u.id)).rejects.toMatchObject({ status: 409 });
    // Atualizar um site já publicado não conta como novo
    await publishProject(ps[0]!, u.id);
    await unpublishProject(ps[1]!.id, u.id);
    await publishProject(ps[2]!, u.id);
    expect(await prisma.publication.count({ where: { status: "PUBLISHED" } })).toBe(2);
  });

  it("um usuário não acessa nem despublica projetos de outro", async () => {
    const a = await makeUser("a@x.com", { premiumUntil: new Date(Date.now() + 30 * day) });
    const b = await makeUser("b@x.com", { premiumUntil: new Date(Date.now() + 30 * day) });
    const pa = await projectFor(a.id);
    await publishProject(pa, a.id);
    await expect(ownProject(b.id, pa.id)).rejects.toMatchObject({ status: 404 });
    await expect(unpublishProject(pa.id, b.id)).rejects.toMatchObject({ status: 404 });
    expect((await ownProject(a.id, pa.id)).id).toBe(pa.id);
  });
});

describe("Servidor de sites publicados", () => {
  it("serve o snapshot publicado e bloqueia quando a assinatura vence", async () => {
    const u = await makeUser("a@x.com", { premiumUntil: new Date(Date.now() + 30 * day) });
    const p = await projectFor(u.id, "Barbearia do Zé");
    const pub = await publishProject(p, u.id);
    let res = await serveSite({ slug: pub.slug });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Barbearia do Zé");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");

    // Edição salva não altera o site até "Atualizar site"
    await prisma.project.update({ where: { id: p.id }, data: { content: { ...(p.content as object), siteName: "Nome Novo" } as never } });
    expect(await (await serveSite({ slug: pub.slug })).text()).not.toContain("Nome Novo");

    await prisma.subscription.update({ where: { userId: u.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    res = await serveSite({ slug: pub.slug });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("temporariamente indisponível");
    expect((await serveSite({ slug: "nao-existe" })).status).toBe(404);
  });
});
