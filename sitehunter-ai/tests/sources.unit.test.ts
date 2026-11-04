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
    const html = renderSite(buildSiteContent(fixed, seg, fallbackCopy(fixed, seg)));
    expect(html).not.toContain(`href="https://wa.me`);
    expect(html).toContain("Ligar agora");
  });
  it("ignora resultados que não são estabelecimentos", () => {
    expect(mapNominatim({ ...nom, category: "boundary" }, "x")).toBeNull();
    expect(mapNominatim({ ...nom, name: undefined }, "x")).toBeNull();
  });
  it("faz uma consulta identificada e respeita a quantidade pedida", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("q=dentist+in+Curitiba");
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
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [{ url: "https://img.test/a.jpg", alt: "a", origin: "stock", license: "CC BY 2.0", credit: { name: "Ana", link: "https://flickr.com/ana" } }, { url: "https://img.test/b.jpg", alt: "b", origin: "company" }]));
    expect(html).toContain("Ana</a> · CC BY 2.0");
    expect(html).toContain("09:00–19:30");
  });
});
