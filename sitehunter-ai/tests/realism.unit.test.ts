import { afterEach, describe, expect, it, vi } from "vitest";
import { buildConcept } from "@/lib/site/immersive/concept";
import { buildSiteContent, fallbackCopy, getSegment } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { assetFilesFor, buildPreviewBundle } from "@/lib/previewBundle";
import { externalUrlFor, publishExternal, unpublishExternal, type HostingConfig } from "@/lib/previewHosting";
import { publishedSiteCsp } from "@/lib/site/render";
import { libraryImages } from "@/lib/site/photoLibrary";

afterEach(() => vi.unstubAllGlobals());

describe("Objetos 3D realistas", () => {
  it("ramos sem modelo escaneado (pizzaria, restaurante, café, barbearia, dentista) usam fotografia, nunca 3D artificial", () => {
    for (const [name, category, seg] of [["Forneria Catarina", "Restaurante", "restaurante"], ["Tratto", "Restaurante", "restaurante"], ["Café Central", "Café", "restaurante"], ["Barbearia Navalha", "Barbearia", "barbearia"], ["Clínica Sorriso", "Dentista", "odontologia"]] as const) {
      const k = buildConcept({ name, category, segmentKey: seg });
      expect(k.asset, name).toBeUndefined();
      expect(k.dish, name).toBeUndefined();
      expect(k.heroMode, name).toBe("photo");
      expect(k.reasons.join(" ")).toMatch(/usa fotografia em vez de um objeto 3D artificial/);
    }
  });
  it("padaria, confeitaria, oficina e construção usam modelos escaneados de objetos reais (Poly Haven, CC0)", () => {
    const pam = buildConcept({ name: "É da Pam - Café Colonial", category: "Café", segmentKey: "restaurante" });
    expect(pam.model).toBe("cake");
    expect(["carrot_cake", "strawberry_chocolate_cake"]).toContain(pam.asset);
    expect(pam.reasons.join(" ")).toMatch(/modelo escaneado de um objeto real .*Poly Haven, licença CC0/);
    expect(buildConcept({ name: "Croissanteria Paris", category: "Padaria", segmentKey: "padaria" }).asset).toMatch(/croissant|hamburger_buns/);
    expect(buildConcept({ name: "Auto Center Silva", category: "Oficina mecânica", segmentKey: "oficina" }).asset).toBe("combination_wrench");
    expect(buildConcept({ name: "Construtora Alfa", category: "Construtora", segmentKey: "construcao" }).asset).toBe("cross_pein_hammer");
  });
  it("página com modelo carrega three.js, GLTF, luz HDR de estúdio e credita o escaneamento; sem modelo não carrega 3D", () => {
    const s = getSegment("padaria"); const co = { name: "Padaria Sol", category: "Padaria", city: "Recife", whatsapp: "" } as never;
    const c = buildSiteContent(co, s, fallbackCopy(co, s), []);
    c.concept = { ...c.concept!, model: "croissant", secondary: [] };
    const html = renderSite(c, { threeSrc: "https://app.test/vendor/three.min.js" });
    expect(html).toContain('<script src="https://app.test/vendor/GLTFLoader.js" defer></script>');
    expect(html).toContain('<script src="https://app.test/vendor/RGBELoader.js" defer></script>');
    expect(html).toContain('"gltfUrl":"https://app.test/models/croissant/model.gltf"');
    expect(html).toContain('"hdrUrl":"https://app.test/models/hdri/studio_small_09_1k.hdr"');
    expect(html).toMatch(/Modelo 3D escaneado de um objeto real: Croissant, por Greg Zaal e Dario Barresi \(Poly Haven, CC0\)/);
    c.concept = { ...c.concept!, model: "pizza" };
    const h2 = renderSite(c, { threeSrc: "https://app.test/vendor/three.min.js" });
    expect(h2).not.toContain("three.min.js");
    expect(h2).not.toContain("data-stage3d");
  });
  it("sites publicados podem buscar os modelos no app (connect-src e img-src)", () => {
    const csp = publishedSiteCsp("https://app.test");
    expect(csp).toContain("connect-src https://app.test");
    expect(csp).toContain("img-src https: data: https://app.test");
    expect(publishedSiteCsp()).toContain("connect-src 'none'");
  });
});

describe("Link público das prévias", () => {
  const s = getSegment("restaurante"); const co = { name: "Forneria Teste", category: "Restaurante", city: "Floripa", whatsapp: "" } as never;
  const content = buildSiteContent(co, s, fallbackCopy(co, s), []);
  content.concept = { ...content.concept!, model: "cake", seed: 2, secondary: [] };
  content.sections = content.sections.map((x) => (x.type === "hero" ? { ...x, image: libraryImages("pizza", 0, 1)[0] } : x));
  it("pacote tem a página com caminhos relativos e só os recursos usados (fotos da biblioteca + modelo)", async () => {
    const files = await assetFilesFor(content);
    expect(files).toContain("photos/pizza/h1.jpg");
    expect(files).toContain("photos/pizza/h1-m.jpg");
    expect(files).toContain("models/carrot_cake/model.gltf");
    expect(files).toContain("models/hdri/studio_small_09_1k.hdr");
    expect(files.some((f) => f.includes("croissant"))).toBe(false);
    const b = await buildPreviewBundle(content, "forneria-teste");
    const html = b.find((f) => f.path === "previas/forneria-teste/index.html")!.data.toString();
    expect(html).toContain('src="../_assets/vendor/three.min.js"');
    expect(html).toContain('"gltfUrl":"../_assets/models/carrot_cake/model.gltf"');
    expect(html).toContain('../_assets/photos/pizza/h1.jpg');
    expect(html).toContain('name="robots" content="noindex');
  });
  it("envia pela API do GitHub e devolve link do GitHub Pages; retirar apaga a página", async () => {
    const cfg: HostingConfig = { token: "t", owner: "ana", repo: "previas", branch: "main", dir: "previas", pagesUrl: null };
    const calls: { m: string; u: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      calls.push({ m: init?.method ?? "GET", u: String(u) });
      if ((init?.method ?? "GET") === "GET") return String(u).includes("index.html") ? new Response(JSON.stringify({ sha: "abc" })) : new Response("", { status: 404 });
      return new Response("{}", { status: 201 });
    }));
    const url = await publishExternal(content, "forneria-teste", cfg);
    expect(url).toBe("https://ana.github.io/previas/previas/forneria-teste/");
    expect(calls.some((c) => c.m === "PUT" && c.u.endsWith("/contents/.nojekyll"))).toBe(true);
    expect(calls.filter((c) => c.m === "PUT").map((c) => decodeURIComponent(c.u))).toEqual(expect.arrayContaining([expect.stringContaining("previas/forneria-teste/index.html"), expect.stringContaining("previas/_assets/vendor/three.min.js")]));
    expect(calls.every((c) => c.u.startsWith("https://api.github.com/repos/ana/previas/contents/"))).toBe(true);
    calls.length = 0;
    await unpublishExternal("forneria-teste", cfg);
    expect(calls.map((c) => c.m)).toEqual(["GET", "DELETE"]);
    expect(externalUrlFor({ ...cfg, pagesUrl: "https://previas.ana.com.br/" }, "x")).toBe("https://previas.ana.com.br/previas/x/");
    expect(externalUrlFor({ ...cfg, owner: "Ana", repo: "ana.github.io" }, "x")).toBe("https://ana.github.io/previas/x/");
  });
});

import { upgradeContentImages } from "@/lib/site/photoLibrary";
import { imageSize } from "@/lib/site/imageProbe";
import { readFileSync } from "node:fs";

describe("Biblioteca de fotos do app", () => {
  it("cada ramo tem fotos próprias, sem repetir, e empresas do mesmo ramo começam por capas diferentes", () => {
    const a = libraryImages("barbearia", 0, 6), b = libraryImages("barbearia", 1, 6);
    expect(new Set(a.map((i) => i.url)).size).toBe(6);
    expect(a[0]!.url).not.toBe(b[0]!.url);
    expect(a.every((i) => i.origin === "stock" && /domínio público/i.test(i.license ?? "") && i.alt.includes("foto ilustrativa"))).toBe(true);
  });
  it("todas as fotos do catálogo existem no disco e têm o tamanho registrado", () => {
    for (const key of ["pizza", "barbearia", "odonto", "academia", "pet"]) {
      for (const i of libraryImages(key, 0, 8)) {
        const f = `public/photos/${i.url.slice(4)}`;
        const dim = imageSize(new Uint8Array(readFileSync(f)));
        expect(dim!.width, f).toBeGreaterThanOrEqual(900);
        expect(readFileSync(f.replace(".jpg", "-m.jpg")).length).toBeGreaterThan(10_000);
      }
    }
  });
  it("prévias antigas: foto automática fraca vira foto da biblioteca; foto da empresa fica; galeria vazia é completada", () => {
    const s = getSegment("restaurante"); const co = { name: "Velha Prévia", category: "Restaurante", city: "Floripa", whatsapp: "" } as never;
    const c = buildSiteContent(co, s, fallbackCopy(co, s), [
      { url: "https://cdn.stocksnap.io/img-thumbs/960w/X.jpg", alt: "", origin: "stock", sourceUrl: "https://stocksnap.io/photo/x" },
      { url: "https://empresa.com.br/foto.jpg", alt: "fachada", origin: "company" },
    ]);
    delete (c as { libraryVersion?: number }).libraryVersion;
    const up = upgradeContentImages(c, "restaurante", 3);
    const urls = JSON.stringify(up);
    expect(urls).not.toContain("stocksnap.io/img-thumbs");
    expect(urls).toContain("https://empresa.com.br/foto.jpg");
    expect(up.libraryVersion).toBe(1);
    const g = up.sections.find((x) => x.type === "gallery") as { images: unknown[]; visible: boolean };
    expect(g.visible).toBe(true);
    expect(g.images.length).toBeGreaterThanOrEqual(3);
  });
  it("lê largura e altura de PNG e JPEG pelo cabeçalho", () => {
    const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47]); new DataView(png.buffer).setUint32(16, 1600); new DataView(png.buffer).setUint32(20, 900);
    expect(imageSize(png)).toEqual({ width: 1600, height: 900, type: "png" });
    expect(imageSize(new Uint8Array(readFileSync("public/photos/pizza/1.jpg")))?.type).toBe("jpeg");
  });
});
