import { describe, expect, it } from "vitest";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { buildConcept, varyConcept } from "@/lib/site/immersive/concept";
import { immersiveRuntime } from "@/lib/site/immersive/runtime";
import { SiteContentSchema } from "@/lib/site/types";

const base: CompanyInfo = { name: "", category: null, address: "Rua A, 1", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 3333-1111", website: null, mapsUrl: null, lat: null, lng: null, hoursLines: null, whatsapp: "" };
const make = (name: string, seg: string, extra: Partial<CompanyInfo> = {}) => {
  const co = { ...base, name, ...extra };
  const s = getSegment(seg);
  return buildSiteContent(co, s, fallbackCopy(co, s), []);
};

describe("Vitrine 3D: conceito por empresa", () => {
  it("novas prévias saem na Vitrine 3D com conceito válido", () => {
    const c = make("Corner Barbershop Cafe", "barbearia", { category: "Barbearia" });
    expect(c.theme.style).toBe("immersive");
    expect(SiteContentSchema.safeParse(c).success).toBe(true);
    expect(c.concept!.model).toMatch(/scissors|razor/);
    expect(c.concept!.secondary).toContain("cup"); // "Cafe" no nome
    expect(c.concept!.reasons.join(" ")).toMatch(/nome também indica/);
  });
  it("duas empresas do mesmo ramo recebem identidades diferentes", () => {
    const names = ["Barbearia Navalha de Ouro", "Dom Bigode Barber", "Studio K Barbearia", "Barbearia do Zé", "Black Sheep Barber"];
    const sigs = names.map((n) => { const k = make(n, "barbearia", { category: "Barbearia" }).concept!; return [k.palette.accent, k.display, k.layout, k.choreo, k.motif, k.model, k.material].join("|"); });
    expect(new Set(sigs).size).toBe(names.length);
  });
  it("o objeto vem do ramo e do nome: implante, pizzaria, oficina", () => {
    expect(buildConcept({ name: "Clínica Implantes Sul", category: "Dentista", segmentKey: "odontologia" }).model).toBe("implant");
    expect(buildConcept({ name: "Forno da Vila Pizzaria", category: "Restaurante", segmentKey: "restaurante" }).model).toBe("pizza");
    expect(buildConcept({ name: "Auto Center Pinheiro", category: "Oficina mecânica", segmentKey: "oficina" }).model).toBe("wheel");
  });
  it("dados pesquisados entram no conceito (bairro, horários, Instagram, falta de foto)", () => {
    const k = buildConcept({ name: "X", segmentKey: "academia", neighborhood: "Batel", city: "Curitiba", hoursLines: [{ label: "Domingo", value: "08:00–12:00" }], instagram: "https://instagram.com/x" });
    expect(k.kicker).toBe("Batel · Curitiba");
    expect(k.highlights).toContain("Abre aos domingos");
    expect(k.reasons.join(" ")).toMatch(/Instagram/);
    expect(k.reasons.join(" ")).toMatch(/imagens são ilustrativas/);
  });
  it("variação troca o visual mas mantém o objeto", () => {
    const k = buildConcept({ name: "Padaria Sol", segmentKey: "padaria", category: "Padaria" });
    const v = varyConcept(k);
    expect(v.model).toBe(k.model);
    expect(v.seed).not.toBe(k.seed);
  });
});

describe("Vitrine 3D: página", () => {
  const c = make("CWB Sorriso", "odontologia", { category: "Dentista", hoursLines: [{ label: "Segunda a sexta", value: "09:00–19:30" }] });
  const html = renderSite(c, { threeSrc: "https://app.test/vendor/three.min.js" });
  it("usa three.js do próprio app, canvas decorativo e fallback sem WebGL", () => {
    expect(html).toContain('<script src="https://app.test/vendor/three.min.js" defer></script>');
    expect(html).toContain('<canvas id="stage3d" aria-hidden="true">');
    expect(html).toContain('class="fallback"');
    expect(html).toContain("prefers-reduced-motion");
  });
  it("capítulos com lados alternados, textos reais e aviso de objeto ilustrativo", () => {
    expect(html.match(/data-ch="/g)!.length).toBeGreaterThanOrEqual(5);
    expect(html).toMatch(/data-side="(left|right|center)"/);
    expect(html).toContain("09:00–19:30");
    expect(html).toContain("Objeto 3D ilustrativo");
    expect(html).not.toContain("wa.me/55413333"); // sem WhatsApp confirmado
  });
  it("o runtime serializado não depende de nada de fora", () => {
    const src = immersiveRuntime.toString();
    expect(src).not.toMatch(/\brequire\(|\bimport\(|__vite/);
    expect(html).toContain("var __name=function(f){return f}");
  });
});

import { usableOwnDescription } from "@/lib/site/copyLibrary";
describe("Texto do site oficial", () => {
  it("descarta avaliações e superlativos não verificáveis", () => {
    expect(usableOwnDescription("Dentista na Mooca, SP — 5,0★ no Google (mais de 100 avaliações). Facetas em resina, clareamento e implantes.")).toBeNull();
    expect(usableOwnDescription("De segunda a sábado, buffet de sabores italianos com ingredientes frescos. O melhor restaurante de Floripa.")).toBeNull();
    expect(usableOwnDescription("Pizzas artesanais, burratas feitas por nós e uma experiência italiana completa no bairro.")).toMatch(/Pizzas artesanais/);
  });
});
