import { classicStyleForSegment } from "@/lib/site/styles";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGoogleHours, parseOsmHours } from "@/lib/leads/hours";
import { mapNominatim, osmProvider, phraseFor } from "@/lib/leads/providers/osm";
import { mapOpenverse, searchLicensedImages } from "@/lib/images";
import { buildFacts } from "@/lib/leads/facts";
import { analyzeHtml } from "@/lib/leads/presence";
import { companyImageCandidates } from "@/lib/leads/leadImages";
import { renderSite } from "@/lib/site/render";
import { buildSiteContent, fallbackCopy, getSegment } from "@/lib/site/templates";

afterEach(() => { vi.unstubAllGlobals(); delete process.env.UNSPLASH_ACCESS_KEY; });

const nom = {
  osm_type: "node", osm_id: 123, lat: "-25.43", lon: "-49.27", name: "CWB Sorriso", category: "amenity", type: "dentist",
  address: { road: "Rua Barão do Serro Azul", house_number: "198", suburb: "Centro", city: "Curitiba", state: "Paraná" },
  extratags: { phone: "+55 41 3323 1150", opening_hours: "Mo-Fr 09:00-19:30; Sa 10:00-14:00", website: "cwbsorriso.com.br", "contact:instagram": "cwbsorriso" },
};

describe("Horários", () => {
  it("OSM: regras comuns viram linhas legíveis; formato desconhecido fica como texto original", () => {
    expect(parseOsmHours("Mo-Fr 09:00-19:30; Sa 10:00-14:00; Su off")).toEqual([
      { label: "Segunda a sexta", value: "09:00–19:30" }, { label: "Sábado", value: "10:00–14:00" }, { label: "Domingo", value: "Fechado" },
    ]);
    expect(parseOsmHours("Mo,We 08:00-12:00,14:00-18:00")).toEqual([{ label: "Segunda, Quarta", value: "08:00–12:00 e 14:00–18:00" }]);
    expect(parseOsmHours("24/7")).toEqual([{ label: "Todos os dias", value: "24 horas" }]);
    expect(parseOsmHours("Mo-Fr 8:15-18 / Th 8:15-20")).toEqual([{ label: "Horário", value: "seg-sex 8:15–18 / qui 8:15–20" }]);
    expect(parseOsmHours("")).toBeNull();
  });
  it("Google: agrupa dias iguais consecutivos", () => {
    expect(parseGoogleHours(["segunda-feira: 09:00–18:00", "terça-feira: 09:00–18:00", "quarta-feira: 09:00–18:00", "quinta-feira: 09:00–18:00", "sexta-feira: 09:00–18:00", "sábado: 09:00–13:00", "domingo: Fechado"])).toEqual([
      { label: "Segunda a sexta", value: "09:00–18:00" }, { label: "Sábado", value: "09:00–13:00" }, { label: "Domingo", value: "Fechado" },
    ]);
  });
});

describe("OpenStreetMap (Nominatim)", () => {
  it("traduz o nicho para a categoria OSM", () => {
    expect(phraseFor("barbearia").phrase).toBe("hairdresser");
    expect(phraseFor("Clínica odontológica").phrase).toBe("dentist");
    expect(phraseFor("chaveiro").phrase).toBe("chaveiro");
  });
  it("mapeia nome, categoria, endereço, contatos, redes, site, horários e fonte", () => {
    const r = mapNominatim(nom, "Dentista")!;
    expect(r).toMatchObject({ sourceId: "node/123", name: "CWB Sorriso", category: "Dentista", phone: "+55 41 3323 1150", website: "https://cwbsorriso.com.br", city: "Curitiba", mapsUrl: "https://www.openstreetmap.org/node/123" });
    expect(r.address).toContain("Rua Barão do Serro Azul, 198");
    expect(r.socialLinks).toEqual(["https://instagram.com/cwbsorriso"]);
    expect(r.hours?.[0]).toEqual({ label: "Segunda a sexta", value: "09:00–19:30" });
    const { facts } = buildFacts(r, { checkedAt: "2026-11-04T00:00:00Z", url: r.website, kind: "site", skipped: "demo" });
    expect(facts.hours).toMatchObject({ status: "confirmed", source: "OpenStreetMap", confidence: 0.8 });
    expect(facts.socials?.value).toContain("instagram.com/cwbsorriso");
    expect(facts.email?.status).toBe("not_found");
  });
  it("normaliza Instagram de stories para o perfil", () => {
    const r = mapNominatim({ ...nom, extratags: { "contact:instagram": "https://www.instagram.com/stories/corner.barbershop/123" } }, "x")!;
    expect(r.socialLinks).toEqual(["https://www.instagram.com/corner.barbershop/"]);
  });
  it("WhatsApp só para celular; telefone fixo vira botão de ligar", async () => {
    const { isMobilePhone } = await import("@/lib/site/templates");
    expect(isMobilePhone("+55 41 3434 3170")).toBe(false);
    expect(isMobilePhone("(41) 99876-5432")).toBe(true);
    const seg = getSegment("barbearia");
    const fixed = { name: "X", phone: "+55 41 3434 3170" };
    const html = renderSite(buildSiteContent(fixed, seg, fallbackCopy(fixed, seg), [], classicStyleForSegment(seg.key)));
    expect(html).not.toContain(`href="https://wa.me`);
    expect(html).toContain("Ligar agora");
  });
  it("ignora resultados que não são estabelecimentos", () => {
    expect(mapNominatim({ ...nom, category: "boundary" }, "x")).toBeNull();
    expect(mapNominatim({ ...nom, name: undefined }, "x")).toBeNull();
  });
  it("faz uma consulta identificada e respeita a quantidade pedida", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toMatch(/q=dentist(&|\+in\+Curitiba)/);
      expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/^SiteHunterAI\/1\.0/);
      return new Response(JSON.stringify([nom, { ...nom, osm_id: 124, name: "Odonto Centro" }, { ...nom, osm_id: 125, name: "Outra" }]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await osmProvider.search({ niche: "dentista", location: "Curitiba", language: "pt-BR", count: 2 });
    expect(r.map((x) => x.name)).toEqual(["CWB Sorriso", "Odonto Centro"]);
  });
  it("limite do serviço vira mensagem clara (sem dados inventados)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(osmProvider.search({ niche: "dentista", location: "Curitiba", language: "pt-BR", count: 2 })).rejects.toThrow(/limitou/);
  });
});

describe("Imagens", () => {
  it("Openverse: só licenças com uso comercial e modificação, com crédito", () => {
    const ok = mapOpenverse({ id: "1", url: "https://live.staticflickr.com/a.jpg", title: "Barber", creator: "Ana", creator_url: "https://flickr.com/ana", license: "by", license_version: "2.0", license_url: "https://creativecommons.org/licenses/by/2.0/", foreign_landing_url: "https://flickr.com/p/1", source: "flickr" })!;
    expect(ok).toMatchObject({ license: "CC BY 2.0", credit: { name: "Ana" }, source: "Openverse (flickr)" });
    expect(mapOpenverse({ id: "2", url: "https://x/b.jpg", license: "by-nc" })).toBeNull();
    expect(mapOpenverse({ id: "3", url: "http://x/b.jpg", license: "cc0" })).toBeNull();
  });
  it("sem chave do Unsplash usa o Openverse", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("api.openverse.org");
      expect(url).toContain("license_type=commercial%2Cmodification");
      return new Response(JSON.stringify({ results: [{ id: "1", url: "https://img.test/a.jpg", license: "cc0", creator: "B" }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await searchLicensedImages("barbershop", 3);
    expect(r[0]).toMatchObject({ license: "CC0 (domínio público)" });
  });
  it("imagens do site da empresa viram candidatas que exigem autorização", () => {
    const html = `<meta property="og:image" content="/img/fachada.jpg"><img src="https://cdn.x.com/logo.png"><img src="https://cdn.x.com/salao-interno.jpg" width="1200" alt="Salão">`;
    const a = analyzeHtml(html, "https://x.com/");
    expect(a.imageCandidates?.map((i) => i.url)).toEqual(["https://x.com/img/fachada.jpg", "https://cdn.x.com/salao-interno.jpg"]);
    const c = companyImageCandidates({ checkedAt: "", url: "https://x.com", kind: "site", ...a });
    expect(c.every((i) => i.requiresPermission && i.status === "candidate" && i.origin === "company")).toBe(true);
  });
  it("crédito e licença aparecem no site; horários confirmados entram na seção", () => {
    const seg = getSegment("odontologia");
    const company = { name: "CWB Sorriso", city: "Curitiba", hoursLines: [{ label: "Segunda a sexta", value: "09:00–19:30" }], hoursSource: "OpenStreetMap" };
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [{ url: "https://img.test/a.jpg", alt: "a", origin: "stock", license: "CC BY 2.0", credit: { name: "Ana", link: "https://flickr.com/ana" } }, { url: "https://img.test/b.jpg", alt: "b", origin: "company" }], classicStyleForSegment(seg.key)));
    expect(html).toContain("Ana</a> · CC BY 2.0");
    expect(html).toContain("09:00–19:30");
  });
});

describe("Palco 3D ligado à rolagem", () => {
  it("objeto adaptado ao negócio", async () => {
    const { objectKindFor } = await import("@/lib/site/stage");
    expect(objectKindFor("restaurante", "Cantina")).toBe("plate");
    expect(objectKindFor("servicos", "Loja de artigos esportivos")).toBe("sneaker");
    expect(objectKindFor("odontologia", "")).toBe("tooth");
    expect(objectKindFor("servicos", "Engenharia elétrica")).toBe("gear");
  });
  it("serviços e números confirmados viram etapas; sem script tudo visível; foto real só emoldurada", () => {
    const seg = getSegment("barbearia");
    const company = { name: "Navalha", city: "Curitiba", phone: "(41) 99876-5432" };
    const c = buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key));
    const st = c.sections.find((x) => x.type === "stats");
    if (st?.type === "stats") st.items = [{ value: "12", unit: "anos", label: "no mesmo endereço", source: "" }];
    c.stage = { kind: "scissors", mode: "auto", image: { url: "https://img.test/obj.jpg", alt: "Tesoura", origin: "stock", license: "CC0 (domínio público)", credit: { name: "Ana", link: "https://x.test" } } };
    const html = renderSite(c);
    expect(html).toContain("data-scrolly");
    expect(html).toContain('data-scount="12"');
    expect(html).toContain('<img class="o3d-face" src="https://img.test/obj.jpg"');
    expect(html).toContain("Ana</a> · CC0");
    expect(html.includes('class="scrolly sc-live')).toBe(false);
    expect(html).toContain("@media (prefers-reduced-motion:reduce){.sc-live{height:auto}}");
    c.stage.mode = "illustration";
    expect(renderSite(c)).toContain('class="o3d illus"');
    c.stage.mode = "off";
    expect(renderSite(c)).not.toContain("data-scrolly data-poses");
  });
  it("restaurante (sem seção de serviços) também ganha o palco, antes do cardápio", () => {
    const seg = getSegment("restaurante");
    const company = { name: "Cantina", city: "BH" };
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key)));
    expect(html.indexOf("data-scrolly")).toBeGreaterThan(-1);
    expect(html.indexOf("data-scrolly")).toBeLessThan(html.indexOf('id="cardapio"'));
    expect(html).not.toContain("Item do cardápio</h3>");
  });
});

import { resolveCity, searchCities, cityById, CITIES } from "@/lib/br/cities";
import { coverageNote } from "@/lib/leads/pipeline";
import { mapCommons } from "@/lib/leads/commons";

describe("Municípios do Brasil", () => {
  it("tem todos os 5.570 municípios + DF e resolve nomes com e sem acento", () => {
    expect(CITIES.length).toBe(5571);
    expect(resolveCity("chapeco - sc").city?.ibge).toBe(4204202);
    expect(resolveCity("Oiapoque").city?.uf).toBe("AP");
    expect(searchCities("sao jose", "SC")[0]?.name).toMatch(/^São José/);
  });
  it("nome repetido em vários estados pede a UF", () => {
    const r = resolveCity("Bom Jesus");
    expect(r.city).toBeNull();
    expect(new Set(r.options.map((c) => c.uf)).size).toBeGreaterThan(2);
    expect(cityById(4106902)?.name).toBe("Curitiba");
  });
  it("busca OSM usa a área do município e descarta outras cidades", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { urls.push(String(u)); return new Response(JSON.stringify([{ ...nom, address: { ...nom.address, city: "Chapecó" } }, { ...nom, osm_id: 5, address: { ...nom.address, city: "Xaxim" } }])); }));
    const r = await osmProvider.search({ niche: "dentista", location: "Chapecó - SC", cityIbge: 4204202, language: "pt-BR", count: 1 });
    expect(urls[0]).toContain("overpass"); // 1º: Overpass (WhatsApp ou site cadastrados)
    expect(urls[1]).toContain("bounded=1"); // depois: Nominatim na área do município
    expect(r.map((x) => x.city)).toEqual(["Chapecó"]);
  });
  it("cidade sem resultados é sinalizada com a cobertura real da fonte", () => {
    expect(coverageNote("osm", 0, "Oiapoque - AP", "pet shop", true)).toMatch(/^Nenhum resultado no OpenStreetMap/);
    expect(coverageNote("demo", 5, "x", "y", true)).toMatch(/fictícias/);
  });
});

describe("Wikimedia Commons", () => {
  const page = (lic: string, w = 2000) => ({ title: "File:Fachada.jpg", imageinfo: [{ url: "https://upload.wikimedia.org/a.jpg", thumburl: "https://upload.wikimedia.org/t.jpg", width: w, height: 1200, descriptionurl: "https://commons.wikimedia.org/wiki/File:Fachada.jpg", mime: "image/jpeg", extmetadata: { LicenseShortName: { value: lic }, Artist: { value: "<a>Fulano</a>" } } }] });
  it("aceita só licenças livres e marca o que a foto mostra", () => {
    const c = mapCommons(page("CC BY-SA 4.0"), "near", "X")!;
    expect(c).toMatchObject({ source: "Wikimedia Commons", license: "CC BY-SA 4.0", credit: { name: "Fulano" }, status: "candidate" });
    expect(c.note).toMatch(/Não é foto da empresa/);
    expect(mapCommons(page("All rights reserved"), "near", "X")).toBeNull();
    expect(mapCommons(page("CC0", 400), "near", "X")).toBeNull();
  });
});

import { siteMatchesBusiness } from "@/lib/leads/presence";
import { relevant } from "@/lib/leads/commons";

describe("Site informado é mesmo da empresa?", () => {
  it("site de órgão público nunca confirma dados; nome precisa aparecer no domínio ou título", () => {
    expect(siteMatchesBusiness("Academia Live", "https://www.ssp.am.gov.br/", "SSP | Secretaria de Segurança Pública")).toBe(false);
    expect(siteMatchesBusiness("Café do Mercado", "https://cafedomercado.com.br/", "Café do Mercado - Cafés especiais")).toBe(true);
    expect(siteMatchesBusiness("Barbearia Navalha", "https://exemplo.com/", "Outro negócio")).toBe(false);
    expect(siteMatchesBusiness("Academia", "https://qualquer.com/", "")).toBe(true); // nome genérico: não dá para julgar
  });
  it("WhatsApp de site que não é da empresa vira inferência", () => {
    const r = mapNominatim({ ...nom, name: "Academia Live", extratags: { website: "https://www.ssp.am.gov.br/" } }, "Academia")!;
    const { facts } = buildFacts(r, { checkedAt: "x", url: r.website, kind: "site", reachable: true, whatsapp: ["5592994349304"], siteMismatch: true });
    expect(facts.whatsapp).toMatchObject({ status: "inferred" });
    expect(facts.whatsapp?.note).toMatch(/não parece ser da empresa/);
  });
  it("foto do Commons perto do endereço só entra se citar o nome", () => {
    expect(relevant("Café do Mercado", "Mercado Público de Porto Alegre")).toBe(true);
    expect(relevant("Paraíso Animal", "Editatona Cada Livro em Natal")).toBe(false);
  });
});


import { overpassToNom } from "@/lib/leads/providers/osm";
import { contactLink } from "@/lib/leads/presence";

describe("Overpass e página de contato", () => {
  it("Overpass filtra por WhatsApp/site na área do município e prioriza quem tem WhatsApp", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (String(u).includes("overpass")) {
        bodies.push(String(init?.body));
        return new Response(JSON.stringify({ elements: [
          { type: "node", id: 10, lat: -27.1, lon: -52.6, tags: { name: "Barbearia Site", shop: "barber", website: "https://barbeariasite.com.br" } },
          { type: "way", id: 11, center: { lat: -27.1, lon: -52.6 }, tags: { name: "Barbearia Zap", shop: "hairdresser", "contact:whatsapp": "+55 49 99123-4567", "addr:street": "Rua X" } },
        ] }));
      }
      return new Response("[]");
    }));
    const r = await osmProvider.search({ niche: "barbearia", location: "Chapecó - SC", cityIbge: 4204202, language: "pt-BR", count: 5 });
    expect(decodeURIComponent(bodies[0]!)).toMatch(/contact:whatsapp\|whatsapp/);
    expect(r.map((x) => x.name)).toEqual(["Barbearia Zap", "Barbearia Site"]);
    expect(r[0]).toMatchObject({ whatsapp: "+55 49 99123-4567", city: "Chapecó", mapsUrl: "https://www.openstreetmap.org/way/11" });
  });
  it("converte elemento do Overpass e acha a página de contato do mesmo site", () => {
    expect(overpassToNom({ type: "node", id: 1, tags: {} }, { ibge: 1, name: "X", uf: "SC", lat: 0, lng: 0, ddd: 49, capital: false })).toBeNull();
    const html = '<a href="https://instagram.com/x">Insta</a><a href="/fale-conosco">Fale conosco</a><a href="https://outro.com/contato">x</a>';
    expect(contactLink(html, "https://loja.com.br/")).toBe("https://loja.com.br/fale-conosco");
    expect(contactLink('<a href="https://outro.com/contato">Contato</a>', "https://loja.com.br/")).toBeNull();
  });
});
