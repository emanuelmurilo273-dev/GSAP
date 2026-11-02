import { afterEach, describe, expect, it, vi } from "vitest";
import { renderSite, PUBLISHED_SITE_CSP, contrast, onColor, readable } from "@/lib/site/render";
import { buildSiteContent, fallbackCopy, getSegment, SEGMENTS, hoursToLines } from "@/lib/site/templates";
import { computeRoute, geocode } from "@/lib/maps";

const company = { name: "Cantina Teste", phone: "(41) 99812-3456", address: "Rua das Flores, 200 - Centro, Curitiba - PR", city: "Curitiba", neighborhood: "Centro", lat: -25.43, lng: -49.27, hours: ["segunda-feira: Fechado", "terça-feira: 11:30–15:00"] };
const site = (key = "restaurante", opts = {}) => {
  const seg = getSegment(key);
  return renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg)), opts);
};

describe("Contraste de cores", () => {
  it("escolhe texto legível sobre qualquer cor de destaque", () => {
    for (const s of SEGMENTS) {
      expect(contrast(onColor(s.theme.accent), s.theme.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(readable(s.theme.muted, s.theme.background), s.theme.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("não usa color-mix (compatibilidade com navegadores antigos)", () => {
    for (const s of SEGMENTS) expect(site(s.key)).not.toContain("color-mix");
  });
});

describe("Acessibilidade e SEO", () => {
  const html = site();
  it("tem link para pular conteúdo, landmarks e menu acessível", () => {
    expect(html).toContain('class="skip" href="#conteudo"');
    expect(html).toContain('<main id="conteudo"');
    expect(html).toContain('aria-expanded="false" aria-controls="menu"');
    expect(html).toContain('aria-label="Menu principal"');
    expect(html).toMatch(/<h1 id="inicio-t">/);
    expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
  });
  it("abas do cardápio seguem o padrão ARIA", () => {
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/role="tab" id="cardapio-tab-0"[^>]*aria-selected="true" aria-controls="cardapio-panel-0"/);
  });
  it("links externos avisam que abrem em nova aba", () => {
    expect(html).toContain("(abre em nova aba)");
  });
  it("metadados de SEO e schema.org", () => {
    const h = site("restaurante", { canonicalUrl: "https://cantina.sitehunter.app" });
    expect(h).toContain('<link rel="canonical" href="https://cantina.sitehunter.app">');
    expect(h).toContain('"@type":"Restaurant"');
    expect(h).toContain('"geo":{"@type":"GeoCoordinates"');
    expect(h).toContain('property="og:locale" content="pt_BR"');
  });
  it("usa horários reais da fonte e marca o dia de hoje via script", () => {
    expect(hoursToLines(company.hours)).toEqual([{ label: "Segunda-feira", value: "Fechado" }, { label: "Terça-feira", value: "11:30–15:00" }]);
    expect(html).toContain('data-day="terça-feira"');
  });
});

describe("Mapa nos sites", () => {
  it("embute o Google Maps só com chave e fora da pré-visualização", () => {
    expect(site("oficina")).not.toContain("maps/embed");
    const withKey = site("oficina", { mapsEmbedKey: "CHAVE_TESTE" });
    expect(withKey).toContain("https://www.google.com/maps/embed/v1/place?key=CHAVE_TESTE");
    expect(withKey).toMatch(/<iframe title="Mapa com a localização de Cantina Teste"[^>]*loading="lazy"/);
    expect(site("oficina", { mapsEmbedKey: "CHAVE_TESTE", preview: true })).not.toContain("maps/embed");
  });
  it("sempre oferece rota pelas coordenadas e barra de ações no celular", () => {
    const h = site("oficina");
    expect(h).toContain("https://www.google.com/maps/dir/?api=1&amp;destination=-25.43,-49.27");
    expect(h).toContain('class="mbar" aria-label="Ações rápidas"');
  });
  it("CSP dos sites publicados libera somente o iframe do Google", () => {
    expect(PUBLISHED_SITE_CSP).toContain("frame-src https://www.google.com");
    expect(PUBLISHED_SITE_CSP).toContain("default-src 'none'");
  });
});

describe("Formulário de orçamento", () => {
  const h = site("oficina");
  it("tem rótulos, validação e mensagens de erro associadas", () => {
    expect(h).toContain('<form class="quote rv" novalidate');
    expect(h).toMatch(/<label for="orcamento-nome">/);
    expect(h).toContain('aria-describedby="orcamento-nome-err"');
    expect(h).toContain('class="form-status" role="status" aria-live="polite"');
    expect(h).toContain("Informe seu nome.");
  });
});

describe("Serviços do Google Maps no servidor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
  });
  it("exige chave configurada", async () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(geocode({ address: "Av. Paulista" })).rejects.toMatchObject({ status: 503, code: "maps_not_configured" });
  });
  it("geocodifica e traduz erros do Google", async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = "k";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "OK", results: [{ formatted_address: "Av. Paulista, 1000", place_id: "p1", geometry: { location: { lat: -23.56, lng: -46.65 } } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const r = await geocode({ address: "Av. Paulista, 1000" });
    expect(r[0]).toMatchObject({ formattedAddress: "Av. Paulista, 1000", lat: -23.56, lng: -46.65 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("components=country%3ABR");
    await expect(geocode({ address: "xyzxyz" })).rejects.toMatchObject({ status: 404 });
  });
  it("calcula rota e formata distância e tempo", async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = "k";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [{ distanceMeters: 12345, duration: "1530s", polyline: { encodedPolyline: "abc" } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const r = await computeRoute({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, "DRIVE");
    expect(r).toMatchObject({ distanceText: "12,3 km", durationText: "26 min", polyline: "abc" });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain("routes.polyline.encodedPolyline");
    expect(JSON.parse(String(init.body)).routingPreference).toBe("TRAFFIC_AWARE");
  });
});

describe("Script dos sites", () => {
  it("é JavaScript válido (o site funciona com interações)", async () => {
    const { SITE_SCRIPT } = await import("@/lib/site/renderer/script");
    expect(() => new Function(SITE_SCRIPT)).not.toThrow();
  });
});

describe("Imagens e galeria", () => {
  const imgs = [1, 2, 3, 4, 5, 6].map((i) => ({ url: `https://images.unsplash.com/photo-${i}?fm=jpg`, alt: `Ambiente ${i}`, credit: { name: `Autor ${i}`, link: "https://unsplash.com", source: "unsplash" as const } }));
  const seg = getSegment("restaurante");
  const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), imgs));
  it("serve AVIF/WebP com srcset, dimensões e carregamento sob demanda", () => {
    expect(html).toContain('<source type="image/avif" srcset="https://images.unsplash.com/photo-2?');
    expect(html).toContain('<source type="image/webp"');
    expect(html).toMatch(/<img [^>]*width="\d+" height="\d+" alt="Ambiente 2" loading="lazy" decoding="async">/);
    expect(html).toMatch(/fetchpriority="high"/); // foto da capa prioritária
  });
  it("galeria com lightbox acessível e alt em todas as imagens", () => {
    expect(html).toContain('id="lb" role="dialog" aria-modal="true"');
    expect(html).toMatch(/data-lb="0" aria-label="Ampliar foto 1 de \d+: Ambiente 2"/);
    expect(html).not.toMatch(/<img(?![^>]*\balt=)[^>]*>/);
  });
  it("fotos do Google passam pela rota interna, com larguras por tela e crédito", () => {
    const g = [{ url: "https://app.test/api/place-photo/ckabc1234567890/0", alt: "Fachada", credit: { name: "Maria", link: "https://maps.google.com", source: "google" as const } }, { url: "https://app.test/api/place-photo/ckabc1234567890/1", alt: "Salão", credit: { name: "João", link: "https://maps.google.com", source: "google" as const } }];
    const h = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), g));
    expect(h).toContain("/api/place-photo/ckabc1234567890/1?w=480 480w");
    expect(h).toContain("/ Google Maps");
    expect(h).not.toMatch(/[?&]key=/);
  });
  it("animações de entrada com variações e respeito ao movimento reduzido", () => {
    expect(html).toContain('data-rv="zoom"');
    expect(html).toContain('data-rv="left"');
    expect(html).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
