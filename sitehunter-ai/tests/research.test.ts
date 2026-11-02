import { describe, expect, it } from "vitest";
import { parseResearch, publicHttpsUrl, verifyResearch, ResearchSchema } from "@/lib/research";
import { applyConfirmed, buildSiteContent, fallbackCopy, getSegment, SEGMENTS } from "@/lib/site/templates";
import { designFor } from "@/lib/site/design";
import { reviewSite } from "@/lib/site/review";
import { renderSite } from "@/lib/site/render";
import { stockImages } from "@/lib/site/stock";

const company = { name: "Cantina Bella Nonna", category: "Restaurante italiano", address: "Rua das Flores, 10 - Centro, Curitiba - PR", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 99999-1234" };

describe("Pesquisa da empresa", () => {
  it("lê o JSON final mesmo com texto em volta e valida o formato", () => {
    const r = parseResearch('Resultado:\n{"summary":"Cantina familiar","services":[{"name":"Almoço executivo","sourceUrl":"https://bellanonna.com.br"}],"brandColors":["#aa2200"]}\nFim.');
    expect(r.summary).toBe("Cantina familiar");
    expect(r.services[0]!.name).toBe("Almoço executivo");
    expect(r.contacts.whatsapp).toBe("");
    expect(() => parseResearch("sem json")).toThrow();
    expect(() => parseResearch('{"brandColors":["vermelho"]}')).toThrow();
  });

  it("bloqueia links para a rede interna e sem https", async () => {
    expect(await publicHttpsUrl("http://example.com")).toBeNull();
    expect(await publicHttpsUrl("https://127.0.0.1/x")).toBeNull();
    expect(await publicHttpsUrl("https://10.0.0.5/x")).toBeNull();
    expect(await publicHttpsUrl("https://[::1]/x")).toBeNull();
    expect(await publicHttpsUrl("https://localhost/x")).toBeNull();
    expect(await publicHttpsUrl("https://8.8.8.8/x")).not.toBeNull();
  });

  it("descarta fotos que não são imagem, itens sem fonte válida e marca o que confirmar", async () => {
    const raw = ResearchSchema.parse({
      services: [
        { name: "Massas artesanais", sourceUrl: "https://8.8.8.8/cardapio" },
        { name: "Serviço inventado", sourceUrl: "" },
        { name: "Fonte quebrada", sourceUrl: "https://8.8.4.4/404" },
      ],
      photos: [
        { url: "https://8.8.8.8/salao.jpg", description: "Salão", pageUrl: "https://8.8.8.8/" },
        { url: "https://8.8.8.8/pagina.html", description: "não é foto", pageUrl: "https://8.8.8.8/" },
      ],
      contacts: { phone: "(41) 3333-0000", instagram: "https://8.8.4.4/404", email: "contato@bellanonna" },
      sources: [{ title: "Site oficial", url: "https://8.8.8.8/" }, { title: "Quebrado", url: "https://8.8.4.4/404" }],
    });
    const fake = async (url: string) => {
      if (url.includes("8.8.4.4")) return new Response("", { status: 404 });
      return new Response("x", { status: 200, headers: { "content-type": url.endsWith(".jpg") ? "image/jpeg" : "text/html" } });
    };
    const r = await verifyResearch(raw, company, fake as never);
    expect(r.photos.map((p) => p.url)).toEqual(["https://8.8.8.8/salao.jpg"]);
    expect(r.services.map((s) => s.name)).toEqual(["Massas artesanais"]);
    expect(r.sources).toHaveLength(1);
    expect(r.contacts.instagram).toBe("");
    expect(r.contacts.email).toBe("");
    const notes = r.needsConfirmation.join(" ");
    expect(notes).toMatch(/Telefone diferente/);
    expect(notes).toMatch(/autorização de uso/);
    expect(notes).toMatch(/WhatsApp/);
  });
});

describe("Fatos confirmados no site", () => {
  const seg = getSegment("restaurante");
  it("serviços e cardápio confirmados substituem as sugestões, com preços publicados", () => {
    const copy = fallbackCopy(company, seg);
    const { copy: out, suggested } = applyConfirmed(copy, {
      summary: "",
      services: [{ name: "Almoço executivo", description: "", price: "R$ 39,90", sourceUrl: "https://x" }, { name: "Rodízio de massas", description: "Às sextas", price: "", sourceUrl: "https://x" }],
      menu: [1, 2, 3].map((i) => ({ category: "Massas", name: `Prato ${i}`, description: "", price: `R$ ${i}0,00`, sourceUrl: "https://x" })),
      differentiators: [],
    }, seg);
    expect(out.services.map((s) => s.title)).toEqual(["Almoço executivo", "Rodízio de massas"]);
    expect(out.services[0]!.price).toBe("R$ 39,90");
    expect(out.menuCategories).toEqual([{ name: "Massas", items: [1, 2, 3].map((i) => ({ name: `Prato ${i}`, description: "", price: `R$ ${i}0,00` })) }]);
    expect(suggested).toEqual([]);
    const c = buildSiteContent(company, seg, out, [], { suggested });
    expect(c.reviewNotes.join(" ")).toMatch(/páginas da própria empresa/);
  });

  it("sem pesquisa, avisa que serviços/pratos são sugestões", () => {
    const { suggested } = applyConfirmed(fallbackCopy(company, seg), null, seg);
    expect(suggested.length).toBeGreaterThan(0);
    const c = buildSiteContent(company, seg, fallbackCopy(company, seg), [], { suggested });
    expect(c.reviewNotes.join(" ")).toMatch(/Não confirmados/);
  });
});

describe("Avaliações reais e imagens", () => {
  const seg = getSegment("barbearia");
  it("mostra só avaliações reais do Google com autor e link, e nenhuma quando não há", () => {
    const reviews = { rating: 4.8, total: 120, sourceUrl: "https://maps.google.com/?cid=1", items: [
      { author: "Ana P.", authorUrl: "https://www.google.com/maps/contrib/1", rating: 5, text: "Atendimento excelente.", when: "há 2 semanas" },
      { author: "João", authorUrl: "", rating: 2, text: "Demorou.", when: "há 1 mês" },
    ] };
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [], { reviews }));
    expect(html).toContain("Ana P.");
    expect(html).toContain("Atendimento excelente.");
    expect(html).not.toContain("Demorou.");
    expect(html).toContain("https://maps.google.com/?cid=1");
    const none = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [], {}));
    expect(none).not.toMatch(/id="avaliacoes"/);
  });

  it("imagens de banco aparecem marcadas como ilustrativas; fotos do site oficial não", () => {
    const stock = stockImages("barbearia", "/", "abc");
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), stock));
    expect(html).toContain("Imagem ilustrativa");
    const own = [{ url: "https://barbearia.com.br/foto.jpg", alt: "Fachada", credit: { name: "barbearia.com.br", link: "https://barbearia.com.br", source: "site" as const } }];
    const html2 = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), own));
    expect(html2).not.toContain("Imagem ilustrativa");
    expect(html2).toContain("site oficial");
  });

  it("empresas diferentes recebem fotos de capa e designs variados", () => {
    const heroes = new Set(["a", "b", "c", "d", "e", "f"].map((k) => stockImages("restaurante", "/", k)[0]!.url));
    expect(heroes.size).toBeGreaterThan(1);
    for (const s of SEGMENTS) {
      const looks = new Set(Array.from({ length: 8 }, (_, i) => { const d = designFor(s, { key: `empresa-${i}` }); return `${d.theme.primary}|${d.theme.headingFont}|${d.layout.hero}`; }));
      expect(looks.size, s.key).toBeGreaterThan(3);
    }
  });

  it("cores da marca encontradas na pesquisa são usadas", () => {
    const d = designFor(seg, { key: "x", brandColors: ["#123456"] });
    expect(d.theme.primary.toLowerCase()).toBe("#123456");
  });
});

describe("Revisão automática", () => {
  const seg = getSegment("servicos");
  it("aponta contato inválido, placeholders e afirmações sem prova", () => {
    const copy = fallbackCopy({ ...company, phone: "123" }, seg);
    copy.aboutText = "Somos a melhor da cidade, com 20 anos de experiência e {nome}.";
    const c = buildSiteContent({ ...company, phone: "123" }, seg, copy);
    const notes = reviewSite(c).join(" ");
    expect(notes).toMatch(/não parece um celular/);
    expect(notes).toMatch(/placeholder/);
    expect(notes).toMatch(/tempo de mercado/);
  });
  it("um site limpo não gera avisos", () => {
    expect(reviewSite(buildSiteContent(company, seg, fallbackCopy(company, seg)))).toEqual([]);
  });
});
