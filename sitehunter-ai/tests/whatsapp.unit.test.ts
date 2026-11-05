import { classicStyleForSegment } from "@/lib/site/styles";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeWhatsApp, waMeLink, isBrMobile } from "@/lib/whatsapp";
import { mapNominatim } from "@/lib/leads/providers/osm";
import { ownerPhotos } from "@/lib/leads/providers/googlePlaces";
import { buildFacts } from "@/lib/leads/facts";
import { analyzeHtml } from "@/lib/leads/presence";
import { templateWhatsapp } from "@/lib/leads/outreach";
import { renderSite, imageCaption } from "@/lib/site/render";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { usableOwnDescription } from "@/lib/site/copyLibrary";
import type { Facts } from "@/lib/leads/types";

afterEach(() => vi.unstubAllGlobals());

const base = { osm_type: "node", osm_id: 9, lat: "-25.4", lon: "-49.2", name: "Barbearia Teste", category: "shop", type: "hairdresser", address: { road: "Rua A", house_number: "1", city: "Curitiba" } };
const pres = (extra: Record<string, unknown> = {}) => ({ checkedAt: "2026-11-05T00:00:00Z", url: null, kind: "none" as const, ...extra });

describe("WhatsApp: número e link", () => {
  it("normaliza com código do país e só dígitos", () => {
    expect(normalizeWhatsApp("(41) 99876-5432")).toBe("5541998765432");
    expect(normalizeWhatsApp("+55 41 3323-1150")).toBe("554133231150");
    expect(normalizeWhatsApp("+351 912 345 678")).toBe("351912345678");
    expect(normalizeWhatsApp("123")).toBeNull();
    expect(isBrMobile("5541998765432")).toBe(true);
    expect(isBrMobile("554133231150")).toBe(false);
  });
  it("wa.me codifica o texto (acentos, quebras de linha, &)", () => {
    const l = waMeLink("5541998765432", "Olá, equipe!\nSite & ideia");
    expect(l).toBe("https://wa.me/5541998765432?text=Ol%C3%A1%2C%20equipe!%0ASite%20%26%20ideia");
  });
});

describe("WhatsApp: detecção sem inventar", () => {
  it("tag contact:whatsapp do OSM vira fato confirmado", () => {
    const r = mapNominatim({ ...base, extratags: { "contact:whatsapp": "+55 41 99876-5432" } }, "Barbearia")!;
    const { facts } = buildFacts(r, pres());
    expect(facts.whatsapp).toMatchObject({ status: "confirmed", value: "5541998765432" });
  });
  it("link wa.me no site oficial vira fato confirmado", () => {
    const a = analyzeHtml(`<html><body><a href="https://wa.me/5541998765432?text=oi">Fale</a></body></html>`, "https://barbearia.com.br/");
    expect(a.whatsapp).toEqual(["5541998765432"]);
    const r = mapNominatim({ ...base, extratags: { website: "barbearia.com.br" } }, "Barbearia")!;
    const { facts } = buildFacts(r, pres({ url: r.website, kind: "site", reachable: true, ...a }));
    expect(facts.whatsapp?.status).toBe("confirmed");
  });
  it("celular sem indicação de WhatsApp fica só como inferência (pede confirmação)", () => {
    const r = mapNominatim({ ...base, extratags: { phone: "+55 41 99876-5432" } }, "Barbearia")!;
    const { facts } = buildFacts(r, pres());
    expect(facts.whatsapp?.status).toBe("inferred");
    expect(facts.whatsapp?.note).toMatch(/confirm/i);
  });
  it("telefone fixo sem WhatsApp publicado: não encontrado", () => {
    const r = mapNominatim({ ...base, extratags: { phone: "+55 41 3323-1150" } }, "Barbearia")!;
    expect(buildFacts(r, pres()).facts.whatsapp?.status).toBe("not_found");
  });
});

describe("Mensagem de WhatsApp", () => {
  const facts: Facts = { name: { value: "Barbearia Teste", status: "confirmed", source: "OpenStreetMap", confidence: 0.8, collectedAt: "2026-11-05" } };
  it("curta, com fatos verificados, prévia como sugestão e saída fácil", () => {
    const m = templateWhatsapp({ facts, opportunities: [{ code: "no_website", label: "", detail: "", severity: "high", basis: "confirmed" }], senderName: "Ana", previewUrl: "https://exemplo.site/p/abc", hasPreview: true }, "pt-BR");
    expect(m.body).toContain("Barbearia Teste");
    expect(m.body).toContain("https://exemplo.site/p/abc");
    expect(m.body).toMatch(/por conta própria/i);
    // Começa pelo problema observado, explica o impacto e só depois oferece a prévia.
    const iObs = m.body.indexOf("não encontrei um site"), iWhy = m.body.indexOf("mais difíceis de achar"), iOffer = m.body.indexOf("montei uma sugestão");
    expect(iObs).toBeGreaterThan(0);
    expect(iWhy).toBeGreaterThan(iObs);
    expect(iOffer).toBeGreaterThan(iWhy);
    expect(m.basis).toBe("problem");
    expect(m.body).toMatch(/não mando mais/);
    expect(m.body).not.toMatch(/garant|aument|pediram|solicitou/i);
    expect(m.body.length).toBeLessThan(600);
  });
  it("sem prévia publicada, oferece enviar o link em vez de inventar um", () => {
    const m = templateWhatsapp({ facts, opportunities: [], senderName: "Ana", previewUrl: null, hasPreview: true }, "pt-BR");
    expect(m.body).not.toMatch(/https?:\/\//);
    expect(m.body).toMatch(/Posso te enviar o link/);
  });
});

describe("Site: WhatsApp só confirmado, textos e legendas", () => {
  const company: CompanyInfo = { name: "Barbearia Teste", category: "Barbearia", address: "Rua A, 1", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 99876-5432", website: null, mapsUrl: null, lat: null, lng: null, hoursLines: null };
  const seg = getSegment("barbearia");
  it("celular não confirmado como WhatsApp não gera botão wa.me", () => {
    const html = renderSite(buildSiteContent({ ...company, whatsapp: "" }, seg, fallbackCopy({ ...company, whatsapp: "" }, seg), [], classicStyleForSegment(seg.key)));
    expect(html).not.toContain('href="https://wa.me/');
    expect(html).not.toMatch(/data-wa="\d/);
    expect(html).toContain("tel:");
  });
  it("WhatsApp confirmado gera link wa.me e faixa de informações", () => {
    const c = { ...company, whatsapp: "5541998765432", hoursLines: [{ label: "Segunda a sexta", value: "09:00–19:00" }] };
    const html = renderSite(buildSiteContent(c, seg, fallbackCopy(c, seg), [], classicStyleForSegment(seg.key)));
    expect(html).toContain("wa.me/5541998765432");
    expect(html).toContain('class="info-strip"');
    expect(html).toContain("(41) 99876-5432");
  });
  it("biblioteca setorial e descrição do site oficial", () => {
    const copy = fallbackCopy({ ...company, ownDescription: { text: "Barbearia de bairro no Centro de Curitiba, com corte clássico e barba feita na navalha desde a reforma da casa.", source: "barbeariateste.com.br" } }, seg);
    expect(copy.aboutText).toMatch(/navalha/);
    expect(copy.heroSubtitle).toBe("Corte, barba e acabamento no detalhe. Centro, Curitiba.");
    expect(usableOwnDescription("barbearia, corte, barba, curitiba, centro, cabelo, navalha, degradê, pomada, preço")).toBeNull();
  });
  it("banco de imagens é rotulado como ilustrativo; foto da empresa mostra a fonte", () => {
    expect(imageCaption({ url: "https://x/y.jpg", alt: "", origin: "stock", credit: { name: "Autor", link: "https://x" }, license: "CC0" })).toMatch(/^<figcaption>Imagem ilustrativa · Foto:/);
    expect(imageCaption({ url: "https://x/y.jpg", alt: "", origin: "company", sourceUrl: "https://maps.google.com/x" })).toMatch(/Foto da empresa · <a href="https:\/\/maps.google.com\/x"/);
  });
});

describe("Google Maps: só fotos publicadas pela empresa", () => {
  it("filtra pelo autor = nome do estabelecimento e usa o endpoint oficial de mídia", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ photoUri: "https://lh3.googleusercontent.com/p/abc" })));
    vi.stubGlobal("fetch", fetchMock);
    const out = await ownerPhotos("KEY", "Barbearia Teste", [
      { name: "places/1/photos/own", authorAttributions: [{ displayName: "Barbearia Teste", uri: "https://maps.google.com/owner" }] },
      { name: "places/1/photos/cliente", authorAttributions: [{ displayName: "João Cliente" }] },
    ] as never, null);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: "https://lh3.googleusercontent.com/p/abc", source: expect.stringMatching(/publicada pela empresa/) });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("places/1/photos/own/media");
  });
});

describe("WhatsApp: formato e DDD", () => {
  it("rejeita DDD inexistente e celular sem o 9", () => {
    expect(normalizeWhatsApp("(20) 99876-5432")).toBeNull();
    expect(normalizeWhatsApp("(41) 8876-54321")).toBeNull();
    expect(normalizeWhatsApp("041 99876-5432")).toBe("5541998765432");
    expect(normalizeWhatsApp("(41) 1234-5678")).toBeNull();
  });
  it("número escrito como WhatsApp no texto do site é lido", () => {
    const a = analyzeHtml(`<p>Atendimento pelo WhatsApp: (47) 99123-4567 · Tel. (47) 3333-1111</p>`, "https://x.com.br/");
    expect(a.whatsapp).toEqual(["47991234567"]);
    expect(a.whatsappWritten).toBe(true);
  });
});

describe("Abordagem sem problema verificável", () => {
  it("usa uma oportunidade observável; sem fonte pública, pede edição", () => {
    const pub: Facts = { name: { value: "Loja X", status: "confirmed", source: "OpenStreetMap", confidence: 0.8, collectedAt: "x" } };
    const a = templateWhatsapp({ facts: pub, opportunities: [], senderName: "Ana", previewUrl: null, hasPreview: false }, "pt-BR");
    expect(a.basis).toBe("opportunity");
    expect(a.needsEdit).toBe(false);
    const own: Facts = { name: { value: "Loja Y", status: "user", source: "Fornecido pelo usuário", confidence: 0.7, collectedAt: "x" } };
    const b = templateWhatsapp({ facts: own, opportunities: [], senderName: "Ana", previewUrl: null, hasPreview: false }, "pt-BR");
    expect(b.needsEdit).toBe(true);
    expect(b.body).toMatch(/\[Escreva aqui/);
    expect(a.body + b.body).not.toMatch(/perdendo|vendas|garant/i);
  });
});
