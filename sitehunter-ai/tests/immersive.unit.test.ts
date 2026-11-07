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
    expect(html).toContain("Objetos 3D ilustrativos");
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

import { withMood } from "@/lib/site/immersive/concept";
const lum = (h: string) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe("Direção de arte por ramo (premium)", () => {
  it("saúde e padaria ficam claras; barbearia e restaurante ficam escuros e cinematográficos", () => {
    const dent = make("Clínica Sorriso Pleno", "odontologia", { category: "Dentista" }).concept!;
    const pad = make("Padaria Trigo Bom", "padaria", { category: "Padaria" }).concept!;
    const barb = make("Barbearia Navalha", "barbearia", { category: "Barbearia" }).concept!;
    const rest = make("Cantina Nonna", "restaurante", { category: "Restaurante" }).concept!;
    expect([dent.mood, pad.mood, barb.mood, rest.mood]).toEqual(["ivory", "ivory", "noir", "noir"]);
    expect(lum(dent.palette.bg)).toBeGreaterThan(0.8);
    expect(lum(barb.palette.bg)).toBeLessThan(0.02);
  });
  it("texto, texto suave e destaque têm contraste AA nas paletas claras e escuras", () => {
    for (const n of ["Clínica Sorriso", "Odonto Vida", "Padaria Sol", "Salão Bella", "Barbearia X", "Pizzaria Y", "Academia Z", "Pet Amigo"]) {
      const seg = /Odonto|Clínica/.test(n) ? "odontologia" : /Padaria/.test(n) ? "padaria" : /Salão/.test(n) ? "salao" : /Barb/.test(n) ? "barbearia" : /Pizz/.test(n) ? "restaurante" : /Acad/.test(n) ? "academia" : "petshop";
      const p = make(n, seg).concept!.palette;
      expect(ratio(p.ink, p.bg)).toBeGreaterThan(7);
      expect(ratio(p.muted, p.bg)).toBeGreaterThan(4.5);
      expect(ratio(p.accent, p.bg)).toBeGreaterThan(4.5);
    }
  });
  it("página tem pular para o conteúdo, menu acessível no celular, color-scheme do ramo e abertura cinematográfica", () => {
    const c = make("Clínica Sorriso Pleno", "odontologia", { category: "Dentista" });
    const html = renderSite(c);
    expect(html).toContain('class="skip" href="#conteudo"');
    expect(html).toContain('<main id="conteudo">');
    expect(html).toMatch(/<details class="menu"><summary>Menu<\/summary><nav aria-label="Seções">/);
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(renderSite(make("Barbearia Navalha", "barbearia"))).toContain('<meta name="color-scheme" content="dark">');
  });
  it("conceito salvo antes da direção de arte ganha o mood do ramo ao renderizar", () => {
    const old = { ...make("Clínica Sorriso Pleno", "odontologia").concept!, palette: { bg: "#07090c", bg2: "#10151b", ink: "#eef3f8", muted: "#9aa8b8", accent: "#7cc4ff", accent2: "#2a5a85" } } as Record<string, unknown>;
    delete old.mood;
    const k = withMood(old as never);
    expect(k.mood).toBe("ivory");
    expect(lum(k.palette.bg)).toBeGreaterThan(0.8);
  });
});
