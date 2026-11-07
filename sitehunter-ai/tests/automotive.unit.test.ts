import { describe, expect, it } from "vitest";
import { OVERPASS_MIRRORS, mapNominatim, overpassQuery, phraseFor } from "@/lib/leads/providers/osm";
import { guessSegmentKey } from "@/lib/leads/normalize";
import { nicheFromText } from "@/lib/site/nicheProfile";
import { libraryKey, libraryImages, libraryPhotos } from "@/lib/site/photoLibrary";
import { assetForModel } from "@/lib/site/immersive/kinds";
import { SEGMENTS, buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { cityById } from "@/lib/br/cities";

const co = (name: string, category: string): CompanyInfo => ({ name, category, address: "Av. Brasil, 100", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 3333-1111", website: null, mapsUrl: null } as CompanyInfo);

describe("Busca de empresas do ramo automotivo", () => {
  it("cada ramo vira a categoria certa do OpenStreetMap (e estética automotiva não vira salão)", () => {
    const cases: [string, string][] = [
      ["concessionária de veículos", "car dealer"], ["revenda de carros", "car dealer"], ["loja de carros seminovos", "car dealer"], ["autopeças", "car parts"],
      ["pneus", "tyres"], ["borracharia", "tyres"], ["funilaria e pintura automotiva", "car body"], ["lanternagem", "car body"], ["lava-rápido", "car wash"],
      ["estética automotiva", "car wash"], ["vistoria veicular", "vehicle inspection"], ["oficina mecânica", "car repair"], ["loja de motos", "motorcycle dealer"],
    ];
    for (const [niche, phrase] of cases) expect(phraseFor(niche).phrase, niche).toBe(phrase);
    expect(phraseFor("salão de beleza").phrase).toBe("beauty shop");
  });
  it("monta a consulta do Overpass para os ramos automotivos", () => {
    const city = cityById(4106902);
    expect(city?.name).toBe("Curitiba");
    if (!city) return;
    for (const p of ["car dealer", "car parts", "tyres", "car body", "car wash", "vehicle inspection"]) {
      const q = overpassQuery(p, city);
      expect(q, p).toMatch(/^\[out:json\]/);
    }
    expect(overpassQuery("car dealer", city)).toContain('"shop"="car"');
    expect(OVERPASS_MIRRORS.length).toBeGreaterThan(1);
  });
  it("funilaria mantém o rótulo do ramo (a tag é shop=car_repair) e o telefone basta para entrar", () => {
    const r = mapNominatim({ osm_type: "node", osm_id: 1, name: "Funilaria Sul", category: "shop", type: "car_repair", extratags: { phone: "+55 41 3333-1111" } }, "Funilaria e pintura automotiva");
    expect(r?.category).toBe("Funilaria e pintura automotiva");
    expect(r?.phone).toBeTruthy();
    const d = mapNominatim({ osm_type: "node", osm_id: 2, name: "Auto Show", category: "shop", type: "car" }, "Concessionária / revenda de veículos");
    expect(d?.category).toBe("Concessionária / revenda de veículos");
  });
});

describe("Ramos automotivos nos sites", () => {
  it("classifica o segmento e o ramo pelo texto da empresa", () => {
    expect(guessSegmentKey("concessionária de veículos")).toBe("concessionaria");
    expect(guessSegmentKey("", "Pneus e borracharia")).toBe("pneus");
    expect(guessSegmentKey("", "Autopeças")).toBe("autopecas");
    expect(guessSegmentKey("estética automotiva")).toBe("lavagem");
    expect(guessSegmentKey("oficina mecânica")).toBe("oficina");
    expect(guessSegmentKey("salão de beleza")).toBe("salao");
    expect(nicheFromText("Auto Center Silva Funilaria e Pintura").key).toBe("funilaria");
    expect(nicheFromText("Lava Rápido Brilho").key).toBe("lavagem");
    expect(nicheFromText("Multimarcas Veículos Seminovos").key).toBe("concessionaria");
  });
  it("cada segmento automotivo existe, usa fotos do ramo e nunca uma chave inglesa 3D", () => {
    for (const k of ["concessionaria", "autopecas", "pneus", "funilaria", "lavagem", "vistoria"]) {
      expect(SEGMENTS.some((s) => s.key === k), k).toBe(true);
      expect(assetForModel("wrench", 1, k), k).toBeNull();
      expect(libraryImages(libraryKey("wheel", k), 3, 6).length, k).toBeGreaterThanOrEqual(3);
    }
    expect(assetForModel("wrench", 1, "oficina")).toBe("combination_wrench");
    for (const k of ["carros", "autopecas", "funilaria", "lavagem"]) for (const p of libraryPhotos(k)) expect(p.w).toBeGreaterThanOrEqual(900);
  });
  it("o site de uma concessionária não inventa dados e traz a frase de destaque da rolagem", () => {
    const s = getSegment("concessionaria"), c = co("Auto Show Veículos", "Concessionária / revenda de veículos");
    const html = renderSite(buildSiteContent(c, s, fallbackCopy(c, s), []), { lang: "pt-BR" } as never);
    expect(html).toContain("data-stmt");
    expect(html).toContain("Auto Show Veículos");
    expect(html).not.toMatch(/\d+ anos|premiad|melhor do/i);
    expect(html).toContain("prefers-reduced-motion");
    expect(html).not.toContain("data-stage3d");
    expect(html).not.toContain("combination_wrench");
  });
});
