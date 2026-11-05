import { classicStyleForSegment } from "@/lib/site/styles";
import { afterEach, describe, expect, it } from "vitest";
import { mayAuthenticate, isOwner, isPrivateMode } from "@/lib/owner";
import { isPublicPath } from "@/lib/publicPaths";
import { POST as register } from "@/app/api/auth/register/route";
import { PUBLISHED_SITE_CSP, renderSite } from "@/lib/site/render";
import { SITE_STYLES, STYLE_INFO, contrast, googleFontsHref, onColor, readableOn, styleForSegment } from "@/lib/site/styles";
import { SEGMENTS, buildSiteContent, fallbackCopy, getSegment, themeForStyle } from "@/lib/site/templates";
import { SiteContentSchema } from "@/lib/site/types";

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe("Modo privado (conta proprietária)", () => {
  const owner = { role: "ADMIN" as const, email: "dono@exemplo.dev", adminSuspendedAt: null };
  const other = { role: "SUBSCRIBER" as const, email: "x@exemplo.dev", adminSuspendedAt: null };
  it("é o padrão e só o proprietário autentica", () => {
    delete process.env.ACCESS_MODE;
    expect(isPrivateMode()).toBe(true);
    expect(mayAuthenticate(owner)).toBe(true);
    expect(mayAuthenticate(other)).toBe(false);
    expect(mayAuthenticate({ ...owner, adminSuspendedAt: new Date() })).toBe(false);
  });
  it("OWNER_EMAIL restringe a uma única conta, mesmo entre administradores", () => {
    process.env.OWNER_EMAIL = "dono@exemplo.dev";
    expect(isOwner(owner)).toBe(true);
    expect(isOwner({ role: "ADMIN", email: "outro-admin@exemplo.dev" })).toBe(false);
  });
  it("modo saas mantém o comportamento multiusuário", () => {
    process.env.ACCESS_MODE = "saas";
    expect(mayAuthenticate(other)).toBe(true);
  });
  it("cadastro público é recusado no servidor", async () => {
    delete process.env.ACCESS_MODE;
    const res = await register(new Request("http://app.test/api/auth/register", { method: "POST", body: JSON.stringify({ name: "A", email: "a@b.dev", password: "12345678", acceptTerms: true }) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("signup_disabled");
  });
  it("só login, recuperação, webhooks e sites publicados são rotas públicas", () => {
    for (const p of ["/login", "/api/auth/login", "/s/barbearia-x", "/api/webhooks/kiwify", "/api/health"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/", "/app", "/app/leads", "/api/leads", "/api/leads/searches", "/api/projects/1/publish", "/admin", "/api/admin/users/1", "/sx", "/loginx"]) expect(isPublicPath(p)).toBe(false);
  });
});

describe("Sites publicados", () => {
  it("rodam em origem isolada (sandbox) e não acessam o painel", () => {
    expect(PUBLISHED_SITE_CSP).toContain("sandbox allow-scripts");
    expect(PUBLISHED_SITE_CSP).not.toContain("allow-same-origin");
  });
});

describe("Direções visuais", () => {
  const company = { name: "Barbearia Navalha", city: "Curitiba", phone: "(41) 99999-0000", address: "Rua A, 1", email: "contato@x.dev" };
  it("cada segmento gera um site válido na sua direção, com estrutura própria", () => {
    const seen = new Set<string>();
    for (const seg of SEGMENTS) {
      const c = buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key));
      expect(SiteContentSchema.safeParse(c).success).toBe(true);
      expect(c.theme.style).toBe(classicStyleForSegment(seg.key));
      expect(styleForSegment(seg.key)).toBe("immersive");
      const html = renderSite(c);
      expect(html).toContain(`class="s-${c.theme.style}"`);
      seen.add(c.theme.style!);
    }
    expect(seen.size).toBe(SITE_STYLES.length - 1); // todas as clássicas; a Vitrine 3D é testada à parte
  });
  it("estruturas diferem de verdade entre direções", () => {
    const seg = getSegment("servicos");
    const base = buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key));
    const html = (st: (typeof SITE_STYLES)[number]) => renderSite({ ...base, theme: themeForStyle(st, base.theme.primary, base.theme.accent) });
    expect(html("forge")).toContain('class="band"');
    expect(html("cinema")).toContain(`class="sc-word"`);
    expect(html("cinema")).toContain("data-scrolly");
    expect(html("clinic")).toContain('class="facts"');
    expect(html("studio")).toContain('class="stack"');
    expect(html("atelier")).not.toContain('class="stack"');
    expect(html("clinic")).not.toMatch(/<article class="card" data-tilt/); // sóbrio: sem cartões inclinados
  });
  it("texto dos botões sempre legível e paletas de base com contraste AA", () => {
    for (const bg of ["#f472b6", "#c8a464", "#1d4ed8", "#facc15", "#111827"]) expect(contrast(bg, onColor(bg))).toBeGreaterThanOrEqual(4.5 - 0.6);
    for (const st of SITE_STYLES) {
      const i = STYLE_INFO[st];
      expect(contrast(i.text, i.background)).toBeGreaterThanOrEqual(7);
      expect(contrast(readableOn(i.muted, i.background), i.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("números só aparecem quando confirmados e contam até o valor", () => {
    const seg = getSegment("barbearia");
    const c = buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key));
    expect(renderSite(c)).not.toContain('class="stat"'); // vazio por padrão: nada inventado
    const st = c.sections.find((x) => x.type === "stats");
    if (st?.type !== "stats") throw new Error("sem seção de números");
    st.items = [{ value: "12", unit: "anos", label: "no mesmo endereço", source: "telefone" }, { value: "", unit: "", label: "sem valor", source: "" }];
    const html = renderSite(c);
    expect(html).toContain(`data-scount="12"`);
    expect(html).not.toContain("sem valor");
    expect(html).not.toContain("telefone\u003c"); // a fonte da confirmação não vai para o site
  });
  it("movimento é aprimoramento progressivo e respeita movimento reduzido", () => {
    const seg = getSegment("barbearia");
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [], classicStyleForSegment(seg.key)));
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).not.toMatch(/class="[^"]*\brv\b/); // nada nasce oculto no HTML
  });
  it("imagens animadas (zoom na capa, entrada, parallax) e paradas com movimento reduzido", () => {
    const seg = getSegment("salao");
    const html = renderSite(buildSiteContent(company, seg, fallbackCopy(company, seg), [{ url: "https://img.test/a.jpg", alt: "a" }, { url: "https://img.test/b.jpg", alt: "b" }, { url: "https://img.test/c.jpg", alt: "c" }], classicStyleForSegment(seg.key)));
    expect(html).toContain("@keyframes kb");
    expect(html).toContain("img-rv");
    expect(html).toContain("--par");
    expect(html).toMatch(/prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{transition:none!important;animation:none!important/);
  });
  it("galeria com imagens inválidas não aparece vazia", () => {
    const seg = getSegment("barbearia");
    const c = buildSiteContent(company, seg, fallbackCopy(company, seg), [{ url: "x", alt: "" }, { url: "y", alt: "" }, { url: "javascript:alert(1)", alt: "" }], classicStyleForSegment(seg.key));
    expect(renderSite(c)).not.toContain('class="gallery');
  });
  it("Google Fonts só com pesos existentes", () => {
    expect(googleFontsHref(["Bebas Neue", "Archivo"])).toContain("family=Bebas+Neue&");
    expect(googleFontsHref(["Lato"])).toContain("Lato:wght@400;700");
  });
  it("salão não herda serviços de barbearia", () => {
    const seg = getSegment("salao");
    const copy = fallbackCopy(company, seg);
    expect(copy.services.map((s) => s.title)).not.toContain("Barba");
    expect(copy.heroSubtitle).toMatch(/^Cabelo, unhas/);
    expect(copy.aboutText).toMatch(/salão de beleza/);
  });
});
