import { afterEach, describe, expect, it, vi } from "vitest";
import { buildConcept } from "@/lib/site/immersive/concept";
import { buildSiteContent, fallbackCopy, getSegment } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { assetFilesFor, buildPreviewBundle } from "@/lib/previewBundle";
import { externalUrlFor, publishExternal, unpublishExternal, type HostingConfig } from "@/lib/previewHosting";
import { publishedSiteCsp } from "@/lib/site/render";

afterEach(() => vi.unstubAllGlobals());

describe("Objetos 3D realistas", () => {
  it("pizzaria usa foto real de pizza; restaurante escolhe o prato pelo cardápio", () => {
    expect(buildConcept({ name: "Forneria Catarina", category: "Restaurante", segmentKey: "restaurante" })).toMatchObject({ model: "pizza", dish: "pizza" });
    expect(buildConcept({ name: "Tratto", category: "Restaurante", segmentKey: "restaurante", description: "Buffet de sabores italianos" })).toMatchObject({ model: "plate", dish: "pasta" });
    expect(buildConcept({ name: "Verde Vida", category: "Restaurante", segmentKey: "restaurante", description: "Comida natural e saudável" }).dish).toBe("salad");
    expect(buildConcept({ name: "Churrascaria Gaúcha", category: "Restaurante", segmentKey: "restaurante" }).dish).toBe("grill");
  });
  it("café usa foto real de latte; padaria e confeitaria usam modelos fotogramétricos CC0", () => {
    expect(buildConcept({ name: "Café Central", category: "Café", segmentKey: "restaurante" }).dish).toBe("latte");
    const k = buildConcept({ name: "É da Pam - Café Colonial", category: "Café", segmentKey: "restaurante" });
    expect(k).toMatchObject({ model: "cake", asset: "carrot_cake" });
    expect(k.reasons.join(" ")).toMatch(/Poly Haven, licença CC0/);
  });
  it("a página carrega o loader do glTF só quando há modelo real e credita foto e modelo", () => {
    const s = getSegment("padaria"); const co = { name: "Padaria Sol", category: "Padaria", city: "Recife", whatsapp: "" } as never;
    const c = buildSiteContent(co, s, fallbackCopy(co, s), []);
    c.concept = { ...c.concept!, model: "croissant", asset: "croissant", dish: undefined, secondary: [] };
    const html = renderSite(c, { threeSrc: "https://app.test/vendor/three.min.js" });
    expect(html).toContain('<script src="https://app.test/vendor/GLTFLoader.js" defer></script>');
    expect(html).toContain('"gltfUrl":"https://app.test/models/croissant/model.gltf"');
    expect(html).toMatch(/Modelo 3D: Croissant, por Greg Zaal e Dario Barresi \(Poly Haven, CC0\)/);
    c.concept = { ...c.concept!, model: "pizza", asset: undefined, dish: "pizza" };
    const h2 = renderSite(c, { threeSrc: "https://app.test/vendor/three.min.js" });
    expect(h2).not.toContain("GLTFLoader.js");
    expect(h2).toContain('"dishUrl":"https://app.test/models/dishes/pizza.jpg"');
    expect(h2).toMatch(/foto de personalgraphic\.official \(CC0\).*Imagem ilustrativa, não é prato da empresa/);
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
  content.concept = { ...content.concept!, model: "pizza", dish: "pizza", asset: undefined, secondary: ["wrench"] };
  it("pacote tem a página com caminhos relativos e só os recursos usados", async () => {
    const files = await assetFilesFor(content);
    expect(files).toContain("models/dishes/pizza.jpg");
    expect(files).toContain("models/combination_wrench/model.gltf");
    expect(files.some((f) => f.includes("croissant"))).toBe(false);
    const b = await buildPreviewBundle(content, "forneria-teste");
    const html = b.find((f) => f.path === "previas/forneria-teste/index.html")!.data.toString();
    expect(html).toContain('src="../_assets/vendor/three.min.js"');
    expect(html).toContain('"dishUrl":"../_assets/models/dishes/pizza.jpg"');
    expect(html).toContain('name="robots" content="noindex');
  });
  it("envia pela API do GitHub e devolve link githack (ou Pages); retirar apaga a página", async () => {
    const cfg: HostingConfig = { token: "t", owner: "ana", repo: "previas", branch: "main", dir: "previas", pagesUrl: null };
    const calls: { m: string; u: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      calls.push({ m: init?.method ?? "GET", u: String(u) });
      if ((init?.method ?? "GET") === "GET") return String(u).includes("index.html") ? new Response(JSON.stringify({ sha: "abc" })) : new Response("", { status: 404 });
      return new Response("{}", { status: 201 });
    }));
    const url = await publishExternal(content, "forneria-teste", cfg);
    expect(url).toBe("https://raw.githack.com/ana/previas/main/previas/forneria-teste/index.html");
    expect(calls.filter((c) => c.m === "PUT").map((c) => decodeURIComponent(c.u))).toEqual(expect.arrayContaining([expect.stringContaining("previas/forneria-teste/index.html"), expect.stringContaining("previas/_assets/vendor/three.min.js")]));
    expect(calls.every((c) => c.u.startsWith("https://api.github.com/repos/ana/previas/contents/"))).toBe(true);
    calls.length = 0;
    await unpublishExternal("forneria-teste", cfg);
    expect(calls.map((c) => c.m)).toEqual(["GET", "DELETE"]);
    expect(externalUrlFor({ ...cfg, pagesUrl: "https://ana.github.io/previas" }, "x")).toBe("https://ana.github.io/previas/previas/x/");
  });
});
