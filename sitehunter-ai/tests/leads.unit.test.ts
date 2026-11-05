import { classicStyleForSegment } from "@/lib/site/styles";
import { describe, expect, it } from "vitest";
import { dedupeBatch, dedupeKeys, guessSegmentKey, normalizeName, normalizePhone, phonesMatch } from "@/lib/leads/normalize";
import { isAllowed, parseRobots } from "@/lib/leads/robots";
import { analyzeHtml } from "@/lib/leads/presence";
import { buildFacts, applyUserEdit } from "@/lib/leads/facts";
import { detectOpportunities } from "@/lib/leads/opportunities";
import { templateOutreach } from "@/lib/leads/outreach";
import { csvToRows, parseCsv } from "@/lib/leads/providers/csvImport";
import { demoProvider } from "@/lib/leads/providers/demo";
import { isPrivateIp } from "@/lib/leads/safeFetch";
import { buildFlowPrompt } from "@/lib/flow";
import { verifiedCompanyInfo } from "@/lib/leads/verified";
import { renderSite } from "@/lib/site/render";
import { buildSiteContent, fallbackCopy, getSegment } from "@/lib/site/templates";
import type { PresenceReport, RawBusiness } from "@/lib/leads/types";

const raw = (o: Partial<RawBusiness> = {}): RawBusiness => ({
  sourceId: "p1", name: "Barbearia Navalha Ltda", category: "Barbearia", address: "Rua A, 10 - Centro, Curitiba", neighborhood: null, city: "Curitiba", state: "PR",
  phone: "(41) 3333-4444", email: null, website: null, mapsUrl: "https://maps.google.com/?cid=1", lat: null, lng: null, businessStatus: "OPERATIONAL",
  source: { provider: "google_places", label: "Google Places", url: "https://maps.google.com/?cid=1" }, ...o,
});
const none: PresenceReport = { checkedAt: "2026-11-04T12:00:00.000Z", url: null, kind: "none", skipped: "no_website" };

describe("Normalização e deduplicação", () => {
  it("normaliza nomes e telefones", () => {
    expect(normalizeName("Barbearia São José LTDA.")).toBe("barbearia sao jose");
    expect(normalizePhone("+55 (41) 3333-4444")).toBe("4133334444");
    expect(phonesMatch("41 3333-4444", "+55 41 33334444")).toBe(true);
    expect(phonesMatch("41 3333-4444", "41 3333-4445")).toBe(false);
  });
  it("detecta duplicadas por domínio, telefone ou nome+cidade", () => {
    const a = raw();
    const b = raw({ sourceId: "p2", name: "BARBEARIA NAVALHA", phone: null });
    const c = raw({ sourceId: "p3", name: "Outra", phone: "41 3333 4444" });
    const d = raw({ sourceId: "p4", name: "Site X", phone: null, website: "https://www.navalha.com.br" });
    const e = raw({ sourceId: "p5", name: "Site Y", city: "Recife", phone: null, website: "http://navalha.com.br/contato" });
    expect(dedupeBatch([a, b, c, d, e]).unique.map((x) => x.sourceId)).toEqual(["p1", "p4"]);
  });
  it("perfis sociais não colidem entre si pelo domínio", () => {
    expect(dedupeKeys(raw({ website: "https://instagram.com/a" }))).toContain("social:instagram.com/a");
    expect(dedupeKeys(raw({ website: "https://instagram.com/a" }))).not.toContain("domain:instagram.com");
  });
  it("sugere modelo pelo nicho", () => {
    expect(guessSegmentKey("barbearia")).toBe("barbearia");
    expect(guessSegmentKey("clínica odontológica")).toBe("odontologia");
    expect(guessSegmentKey("chaveiro")).toBe("servicos");
  });
});

describe("robots.txt (RFC 9309)", () => {
  const txt = "User-agent: *\nDisallow: /admin\n\nUser-agent: SiteHunterBot\nDisallow: /\nAllow: /$\n";
  it("grupo específico prevalece e regra mais longa vence", () => {
    const rules = parseRobots(txt);
    expect(isAllowed(rules, "/")).toBe(true);
    expect(isAllowed(rules, "/precos")).toBe(false);
  });
  it("sem grupo específico usa *", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /privado\n");
    expect(isAllowed(rules, "/")).toBe(true);
    expect(isAllowed(rules, "/privado/x")).toBe(false);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /\n"), "/")).toBe(false);
  });
});

describe("Análise do site", () => {
  const html = `<html><head><title>Navalha</title></head><body>
    <a href="https://instagram.com/navalha">IG</a><a href="https://www.facebook.com/sharer.php?u=x">share</a>
    <a href="mailto:contato@navalha.com.br">e-mail</a><a href="mailto:joao.silva@gmail.com">pessoal</a>
    <a href="tel:+554133335555">tel</a><footer>© 2019 Navalha</footer></body></html>`;
  const r = analyzeHtml(html, "https://navalha.com.br/", new Date("2026-11-04"));
  it("extrai sinais e só e-mails comerciais genéricos", () => {
    expect(r.title).toBe("Navalha");
    expect(r.hasViewport).toBe(false);
    expect(r.copyrightYear).toBe(2019);
    expect(r.emails).toEqual(["contato@navalha.com.br"]);
    expect(r.socials?.map((s) => s.network)).toEqual(["instagram"]);
    expect(r.phones).toEqual(["+554133335555"]);
  });
  it("gera oportunidades verificáveis e telefone divergente", () => {
    const presence: PresenceReport = { checkedAt: "2026-11-04T12:00:00Z", url: "https://navalha.com.br", kind: "site", reachable: true, status: 200, https: true, finalUrl: "https://navalha.com.br/", ...r };
    const { facts } = buildFacts(raw({ website: "https://navalha.com.br" }), presence);
    const { list } = detectOpportunities(facts, presence, new Date("2026-11-04"));
    expect(list.map((o) => o.code).sort()).toEqual(["inconsistent_phone", "missing_seo", "not_mobile", "outdated"]);
    expect(list.every((o) => o.basis === "confirmed")).toBe(true);
  });
});

describe("Proveniência", () => {
  it("sem site é inferência, nunca fato confirmado", () => {
    const { facts } = buildFacts(raw(), none);
    expect(facts.website?.status).toBe("inferred");
    expect(facts.email?.status).toBe("not_found");
    expect(facts.phone?.status).toBe("confirmed");
    expect(facts.phone?.source).toBe("Google Places");
    const { list } = detectOpportunities(facts, none);
    expect(list[0]).toMatchObject({ code: "no_website", basis: "inferred" });
  });
  it("correção do usuário guarda o valor anterior", () => {
    const { facts } = buildFacts(raw(), none);
    const edited = applyUserEdit(facts, "phone", "(41) 99999-0000");
    expect(edited.phone).toMatchObject({ status: "user", value: "(41) 99999-0000" });
    expect(edited.phone?.note).toContain("3333-4444");
  });
  it("site usa só fatos confirmados/revisados", () => {
    const { facts } = buildFacts(raw({ address: null }), none);
    const company = { ...raw(), id: "c", userId: "u", facts, socials: [], email: null, address: "valor que não deve aparecer" } as never;
    const info = verifiedCompanyInfo(company);
    expect(info.address).toBeNull();
    expect(info.phone).toBe("(41) 3333-4444");
    expect(info.website).toBeNull();
  });
});

describe("Abordagem", () => {
  it("cita observação verificável, não afirma ausência de site e não promete resultados", () => {
    const { facts } = buildFacts(raw(), none);
    const { list } = detectOpportunities(facts, none);
    const d = templateOutreach({ facts, opportunities: list, senderName: "Ana", hasPreview: true }, "pt-BR");
    expect(d.subject).toContain("Barbearia Navalha Ltda");
    expect(d.body).toContain("não encontrei um site informado no perfil");
    expect(d.body).toContain("Por iniciativa própria");
    expect(d.body).not.toMatch(/garant|urgente|última chance|vocês não têm site/i);
    expect(d.body).toMatch(/não volto a entrar em contato/);
  });
  it("gera em inglês e espanhol", () => {
    const { facts } = buildFacts(raw(), none);
    const { list } = detectOpportunities(facts, none);
    expect(templateOutreach({ facts, opportunities: list, senderName: "Ana", hasPreview: false }, "en").body).toContain("didn't find a website");
    expect(templateOutreach({ facts, opportunities: list, senderName: "Ana", hasPreview: false }, "es").body).toContain("no encontré un sitio web");
  });
  it("dados importados não viram observação sobre fonte pública", () => {
    const r = raw({ source: { provider: "import", label: "Fornecido pelo usuário", url: null } });
    const { facts } = buildFacts(r, none);
    const d = templateOutreach({ facts, opportunities: detectOpportunities(facts, none).list, senderName: "Ana", hasPreview: false }, "pt-BR");
    expect(d.body).not.toContain("Google");
    expect(d.body).not.toContain("não encontrei um site");
  });
});

describe("Provedores", () => {
  it("demo gera dados claramente fictícios", async () => {
    const r = await demoProvider.search({ niche: "barbearia", location: "Curitiba", language: "pt-BR", count: 8 });
    expect(r).toHaveLength(8);
    for (const b of r) {
      expect(b.name).toContain("(demo)");
      expect(b.address).toContain("fictício");
      if (b.website && !b.website.includes("instagram")) expect(b.website).toMatch(/example\.com/);
      if (b.phone) expect(b.phone).toMatch(/^\(00\)/);
    }
  });
  it("CSV com ; e aspas", () => {
    expect(parseCsv('a;b\n"x;1";"y ""z"""')).toEqual([["a", "b"], ["x;1", 'y "z"']]);
    const rows = csvToRows("Nome,Cidade,Telefone,Site\nPadaria Sol,Recife,(81) 3333-0000,\n,Recife,,\n");
    expect(rows).toEqual([{ name: "Padaria Sol", city: "Recife", phone: "(81) 3333-0000", website: "" }]);
  });
  it("bloqueia IPs privados (SSRF)", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.5.4", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "2606:4700::1111"]) expect(isPrivateIp(ip)).toBe(false);
  });
});

describe("Imagens e prévia", () => {
  it("prompt do Flow não cita a empresa e exige revisão", () => {
    const p = buildFlowPrompt({ segmentLabel: "Barbearias", purpose: "hero" });
    expect(p.prompt).toMatch(/no logos/);
    expect(p.checklist.length).toBeGreaterThan(2);
  });
  it("imagem gerada sempre leva aviso; prévia mostra faixa de não publicada", () => {
    const seg = getSegment("barbearia");
    const c = buildSiteContent({ name: "X" }, seg, fallbackCopy({ name: "X" }, seg), [{ url: "https://img.example/a.jpg", alt: "a", origin: "generated", generator: "Google Flow" }, { url: "https://img.example/b.jpg", alt: "b", origin: "generated" }], classicStyleForSegment(seg.key));
    const html = renderSite(c, { previewRibbon: "Prévia não publicada" });
    expect(html).toContain("Imagem ilustrativa gerada por IA");
    expect(html).toContain('class="preview-ribbon"');
    expect(renderSite(c)).not.toContain('class="preview-ribbon"');
  });
});
