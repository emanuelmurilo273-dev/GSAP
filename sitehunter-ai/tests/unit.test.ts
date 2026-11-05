import { classicStyleForSegment } from "@/lib/site/styles";
import { describe, expect, it } from "vitest";
import { verifyKiwifySignature, parseKiwifyDate, dedupeKey } from "@/lib/kiwify";
import { hmacSha1Hex } from "@/lib/crypto";
import { computeAccess } from "@/lib/access";
import { esc, renderSite, safeUrl } from "@/lib/site/render";
import { buildSiteContent, fallbackCopy, getSegment, SEGMENTS } from "@/lib/site/templates";
import { SiteContentSchema } from "@/lib/site/types";
import { toWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";
import { classifyWebsite } from "@/lib/places";
import { isValidSlug, slugify } from "@/lib/slug";
import { currentPeriod } from "@/lib/usage";
import { proposalToText } from "@/lib/proposal";

describe("Kiwify: assinatura do webhook", () => {
  // Vetor de teste publicado na documentação oficial da Kiwify.
  const body = '{"order_id":"9b1c2d3e-0000-4000-8000-000000000001","order_status":"paid","webhook_event_type":"order_approved"}';
  it("confere com o vetor oficial", () => {
    expect(hmacSha1Hex("kiwify-token-de-teste", body)).toBe("bf18f352a4f981b91dfa3f6d8742a81080ab8c86");
    expect(verifyKiwifySignature(body, "bf18f352a4f981b91dfa3f6d8742a81080ab8c86", ["kiwify-token-de-teste"])).toBe(true);
  });
  it("rejeita assinatura errada, ausente, corpo alterado ou sem token", () => {
    expect(verifyKiwifySignature(body, "0".repeat(40), ["kiwify-token-de-teste"])).toBe(false);
    expect(verifyKiwifySignature(body, null, ["kiwify-token-de-teste"])).toBe(false);
    expect(verifyKiwifySignature(body.replace("paid", "PAID"), "bf18f352a4f981b91dfa3f6d8742a81080ab8c86", ["kiwify-token-de-teste"])).toBe(false);
    expect(verifyKiwifySignature(body, "bf18f352a4f981b91dfa3f6d8742a81080ab8c86", [])).toBe(false);
  });
  it("aceita o token anterior durante a rotação", () => {
    expect(verifyKiwifySignature(body, "bf18f352a4f981b91dfa3f6d8742a81080ab8c86", ["token-novo", "kiwify-token-de-teste"])).toBe(true);
  });
  it("interpreta datas no horário de Brasília e ISO", () => {
    expect(parseKiwifyDate("2026-11-02 10:30")?.toISOString()).toBe("2026-11-02T13:30:00.000Z");
    expect(parseKiwifyDate("2026-12-02T13:00:00.000Z")?.toISOString()).toBe("2026-12-02T13:00:00.000Z");
    expect(parseKiwifyDate("lixo")).toBeNull();
  });
  it("chave de deduplicação distingue renovações", () => {
    const a = dedupeKey({ order_id: "1", webhook_event_type: "order_approved" });
    const b = dedupeKey({ order_id: "2", webhook_event_type: "subscription_renewed" });
    expect(a).not.toBe(b);
    expect(dedupeKey({ order_id: "1", webhook_event_type: "order_approved" })).toBe(a);
  });
});

describe("Regras de acesso Premium", () => {
  const user = { role: "SUBSCRIBER" as const, adminSuspendedAt: null, emailVerifiedAt: null };
  const s = { graceDays: 0 };
  const now = new Date("2026-11-02T12:00:00Z");
  const future = new Date("2026-12-02T12:00:00Z");
  const past = new Date("2026-11-01T12:00:00Z");
  it("ativo dentro do período", () => expect(computeAccess(user, { status: "ACTIVE", currentPeriodEnd: future }, s, now).premium).toBe(true));
  it("cancelado mantém acesso até o fim do período", () => {
    const a = computeAccess(user, { status: "CANCELED", currentPeriodEnd: future }, s, now);
    expect(a.premium).toBe(true);
    expect(a.reason).toBe("canceled_until_period_end");
  });
  it("vencido sem renovação perde acesso", () => expect(computeAccess(user, { status: "ACTIVE", currentPeriodEnd: past }, s, now).reason).toBe("expired"));
  it("carência configurável", () => expect(computeAccess(user, { status: "PAST_DUE", currentPeriodEnd: past }, { graceDays: 3 }, now).reason).toBe("grace"));
  it("reembolso/chargeback/pendente/sem assinatura bloqueiam", () => {
    expect(computeAccess(user, { status: "REFUNDED", currentPeriodEnd: future }, s, now).premium).toBe(false);
    expect(computeAccess(user, { status: "CHARGEBACK", currentPeriodEnd: future }, s, now).premium).toBe(false);
    expect(computeAccess(user, { status: "PENDING", currentPeriodEnd: null }, s, now).premium).toBe(false);
    expect(computeAccess(user, null, s, now).premium).toBe(false);
  });
  it("suspensão administrativa prevalece", () => expect(computeAccess({ ...user, adminSuspendedAt: now }, { status: "ACTIVE", currentPeriodEnd: future }, s, now).premium).toBe(false));
  it("administrador tem acesso", () => expect(computeAccess({ ...user, role: "ADMIN" }, null, s, now).premium).toBe(true));
  it("exige e-mail verificado quando configurado", () =>
    expect(computeAccess(user, { status: "ACTIVE", currentPeriodEnd: future }, s, now, { requireEmailVerification: true }).reason).toBe("email_not_verified"));
});

describe("Renderização segura dos sites", () => {
  const company = { name: `<script>alert(1)</script> & "Cia"`, city: "Recife", phone: "(81) 99999-1234", address: "Rua X, 10", mapsUrl: "javascript:alert(1)" };
  it("todos os modelos geram conteúdo válido", () => {
    for (const seg of SEGMENTS) {
      const content = buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key));
      expect(SiteContentSchema.safeParse(content).success).toBe(true);
      expect(renderSite(content)).toContain("<!doctype html>");
    }
  });
  it("escapa HTML e bloqueia URLs perigosas", () => {
    const seg = getSegment("barbearia");
    const c = buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key));
    c.sections.push({ id: "x", type: "cta", visible: true, title: "t", text: "", button: { label: "<b>x</b>", action: "link", href: "javascript:alert(2)" } });
    const html = renderSite(c);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:alert");
    expect(html).toContain("https://wa.me/5581999991234");
  });
  it("não inventa horários: seção sem horários fica oculta", () => {
    const seg = getSegment("restaurante");
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key)));
    expect(html).not.toContain('id="horarios"');
  });
  it("safeUrl/esc", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,x")).toBe("#");
    expect(safeUrl("https://ok.com/a")).toBe("https://ok.com/a");
    expect(safeUrl("#se'ction")).toBe("#section");
    expect(esc(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;");
  });
});

describe("Utilitários", () => {
  it("WhatsApp: normaliza telefones brasileiros", () => {
    expect(toWhatsAppNumber("(11) 98765-4321")).toBe("5511987654321");
    expect(toWhatsAppNumber("+55 11 3333-4444")).toBe("551133334444");
    expect(toWhatsAppNumber("123")).toBeNull();
    expect(whatsappLink("(11) 98765-4321", "Olá & tudo?")).toBe("https://wa.me/5511987654321?text=Ol%C3%A1%20%26%20tudo%3F");
  });
  it("classifica sites e redes sociais", () => {
    expect(classifyWebsite(null)).toBe("none");
    expect(classifyWebsite("https://www.instagram.com/barbearia")).toBe("social");
    expect(classifyWebsite("https://barbearia.com.br")).toBe("site");
  });
  it("slugs", () => {
    expect(slugify("Barbearia São João & Filhos")).toBe("barbearia-sao-joao-filhos");
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("barbearia-exemplo")).toBe(true);
    expect(isValidSlug("-x")).toBe(false);
  });
  it("período de uso no fuso de Brasília", () => {
    expect(currentPeriod(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11");
    expect(currentPeriod(new Date("2026-12-01T04:00:00Z"))).toBe("2026-12");
  });
  it("proposta inclui preços configurados pelo usuário", () => {
    const t = proposalToText({ companyName: "Cia", summary: "S", benefits: ["b"], features: ["f"], developmentPriceCents: 150000, deliveryDays: 7, paymentTerms: "50/50", domainYearlyCents: 4000, hostingMonthlyCents: 0, maintenanceMonthlyCents: 9900, includeMaintenance: true, validityDays: 15, extraTerms: "", closing: "C", senderName: "Ana", senderContact: "ana@x.com" });
    const n = t.replace(/\u00a0/g, " ");
    expect(n).toContain("R$ 1.500,00");
    expect(n).toContain("R$ 99,00/mês");
  });
});
