import { describe, expect, it } from "vitest";
import { SPLINE_VIEWER_SRC, SPLINE_VIEWER_VERSION, isSplineUrl, parseSplineScenes, splineRuntime, splineSkipReason } from "@/lib/site/spline";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { publishedSiteCsp, renderSite } from "@/lib/site/render";

const base: CompanyInfo = { name: "Barbearia Navalha", category: "Barbearia", address: "Rua A, 1", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 3333-1111", website: null, mapsUrl: "https://www.openstreetmap.org/node/1", lat: null, lng: null, hoursLines: null, whatsapp: "" };
const make = () => { const s = getSegment("barbearia"); return buildSiteContent(base, s, fallbackCopy(base, s), []); };
const SCENE = "https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode";

describe("Cenas do Spline (Spline Viewer)", () => {
  it("só aceita endereços de cena publicados no Spline", () => {
    expect(isSplineUrl(SCENE)).toBe(true);
    for (const bad of ["http://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode", "https://evil.example/6Wq1Q7YGyM-iab9i/scene.splinecode", "https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode?x=1", "javascript:alert(1)", "https://prod.spline.design/../scene.splinecode", "https://prod.spline.design/abc/scene.js", "", null, undefined]) expect(isSplineUrl(bad as string)).toBe(false);
  });
  it("SPLINE_SCENES: lê só entradas válidas e ignora o resto", () => {
    expect(parseSplineScenes(JSON.stringify({ barbearia: SCENE, pizzaria: "https://x.com/a.splinecode", "Ramo Inválido": SCENE }))).toEqual({ barbearia: SCENE });
    expect(parseSplineScenes("{não é json")).toEqual({});
    expect(parseSplineScenes(undefined)).toEqual({});
  });
  it("decide quando NÃO carregar: movimento reduzido, economia de dados, tela pequena e pouca memória", () => {
    const ok = { reduce: false, saveData: false, effectiveType: "4g", width: 1440, memory: 8 };
    expect(splineSkipReason(ok)).toBeNull();
    expect(splineSkipReason({ ...ok, reduce: true })).toBe("movimento reduzido");
    expect(splineSkipReason({ ...ok, saveData: true })).toBe("economia de dados");
    expect(splineSkipReason({ ...ok, effectiveType: "3g" })).toBe("economia de dados");
    expect(splineSkipReason({ ...ok, width: 390 })).toBe("tela pequena");
    expect(splineSkipReason({ ...ok, memory: 2 })).toBe("pouca memória");
  });
  it("com cena válida, o painel leva o viewer sob demanda, a foto de reserva e o crédito; sem cena, nada do Spline", () => {
    const c = make();
    c.concept = { ...c.concept!, spline: { url: SCENE } };
    const html = renderSite(c);
    expect(html).toContain('class="spl" data-spline');
    expect(html).toContain(SPLINE_VIEWER_SRC);
    expect(SPLINE_VIEWER_SRC).toContain(`@${SPLINE_VIEWER_VERSION}/`); // versão fixa, nunca "latest"
    expect(html).toContain("spl-fallback"); // a foto continua no lugar até a cena carregar
    expect(html).toContain("events-target"); // mouse reage na página inteira
    expect(html).toMatch(/Cena 3D interativa criada no <a href="https:\/\/spline\.design"/);
    expect(renderSite(make())).not.toContain('class="spl" data-spline');
    expect(renderSite(make())).not.toContain("unpkg.com");
    // endereço inválido salvo no conteúdo é ignorado (nunca vira script)
    const bad = make(); bad.concept = { ...bad.concept!, spline: { url: "https://evil.example/x.splinecode" } };
    expect(renderSite(bad)).not.toContain("evil.example");
    expect(renderSite(bad)).not.toContain('class="spl" data-spline');
  });
  it("CSP: só páginas com cena recebem o viewer, a origem das cenas e unsafe-eval (exigido pelo runtime); continuam em sandbox", () => {
    const plain = publishedSiteCsp("https://app.test");
    expect(plain).not.toContain("unpkg.com");
    expect(plain).not.toContain("unsafe-eval");
    const sp = publishedSiteCsp("https://app.test", { spline: true });
    expect(sp).toMatch(/script-src 'unsafe-inline' https:\/\/app\.test https:\/\/unpkg\.com 'unsafe-eval'/);
    expect(sp).toContain("connect-src https://app.test https://prod.spline.design https://unpkg.com");
    expect(sp).toContain("worker-src blob:");
    expect(sp).toContain("sandbox allow-scripts"); // origem opaca: sem cookies nem APIs do painel
    expect(sp).not.toContain("allow-same-origin");
  });
  it("o carregador é autossuficiente e preserva a foto se a cena falhar", () => {
    const src = splineRuntime.toString();
    expect(src).not.toMatch(/\brequire\(|\bimport\(|__vite/);
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain("load-complete");
    expect(src).toContain("failed:");
  });
  it("foto em profundidade no painel quando não há cena nem modelo", () => {
    const html = renderSite(make());
    expect(html).toContain("data-tilt-media");
  });
});
