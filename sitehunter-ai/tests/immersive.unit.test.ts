import { describe, expect, it } from "vitest";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { buildConcept, varyConcept } from "@/lib/site/immersive/concept";
import { realRuntime } from "@/lib/site/immersive/realRuntime";
import { SiteContentSchema } from "@/lib/site/types";
import { libraryImages } from "@/lib/site/photoLibrary";

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

describe("Vitrine: página profissional", () => {
  const c = make("CWB Sorriso", "odontologia", { category: "Dentista", hoursLines: [{ label: "Segunda a sexta", value: "09:00–19:30" }] });
  c.sections = c.sections.map((x) => (x.type === "hero" ? { ...x, image: libraryImages("odonto", 0, 1)[0] } : x));
  const html = renderSite(c, { threeSrc: "https://app.test/vendor/three.min.js" });
  it("seções em ordem lógica: proposta, serviços, sobre, contato e chamada final", () => {
    const order = ["h-hero", "h-svc", "h-about", "h-visit", "h-final"].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("09:00–19:30");
    expect(html).not.toContain("wa.me/55413333"); // sem WhatsApp confirmado
  });
  it("foto da biblioteca com srcset (versão de celular), dimensões reais e prioridade na abertura; sem 3D artificial", () => {
    expect(html).toMatch(/<img src="https:\/\/app\.test\/photos\/odonto\/1\.jpg" srcset="https:\/\/app\.test\/photos\/odonto\/1-m\.jpg 640w, https:\/\/app\.test\/photos\/odonto\/1\.jpg \d+w"/);
    expect(html).toMatch(/width="\d+" height="\d+"/);
    expect(html).toContain('fetchpriority="high"');
    expect(html).not.toContain("three.min.js");
    expect(html).toContain("Fotos ilustrativas de bancos de imagens livres: não são fotos da empresa.");
  });
  it("acessível: pular para o conteúdo, menu no celular, foco visível e movimento reduzido", () => {
    expect(html).toContain('class="skip" href="#conteudo"');
    expect(html).toMatch(/<details class="menu"><summary>Menu<\/summary><nav aria-label="Seções">/);
    expect(html).toContain(":focus-visible");
    expect(html).toContain("prefers-reduced-motion");
  });
  it("o runtime 3D serializado não depende de nada de fora", () => {
    const src = realRuntime.toString();
    expect(src).not.toMatch(/\brequire\(|\bimport\(|__vite/);
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

import { NICHES, nicheFromText, nicheOf } from "@/lib/site/nicheProfile";
import { arcRuntime } from "@/lib/site/immersive/arcRuntime";

describe("Abertura com arco de luz e conteúdo por ramo", () => {
  const html = (name: string, seg: string, category: string, extra: Partial<CompanyInfo> = {}) => renderSite(make(name, seg, { category, mapsUrl: "https://www.openstreetmap.org/node/1", hoursLines: [{ label: "Segunda a sábado", value: "09:00–18:00" }], ...extra }), { threeSrc: "https://app.test/vendor/three.min.js" });
  it("arco de luz, pílula de status, dois botões com troca de letras e painel que sobe e é cortado na dobra", () => {
    const h = html("Lava Rápido Brilho", "barbearia", "Lava-rápido");
    expect(h).toContain("<canvas data-arc></canvas>");
    expect(h).toMatch(/class="pill rv" href="#horarios"/);
    expect(h).toContain("btn roll hero-primary mag");
    expect(h).toContain("btn roll ghost");
    expect(h).toMatch(/<span class="rl" aria-hidden="true">/); // troca de letras só visual
    expect(h).toMatch(/<span class="sr">/); // texto completo para leitores de tela
    expect(h).toContain("data-arc-panel");
    expect(h).toContain("margin-bottom:-150px");
  });
  it("cada ramo tem a sua estrutura de página (arquétipo), não só outra cor", () => {
    const cls = (n: string, s: string, c: string) => /<body class="no-js a-(\w+)/.exec(html(n, s, c))?.[1];
    expect(cls("Barbearia Navalha", "barbearia", "Barbearia")).toBe("poster");
    expect(cls("Forno Bom Pizzaria", "restaurante", "Pizzaria")).toBe("plate");
    expect(cls("Auto Silva", "oficina", "Oficina mecânica")).toBe("spec");
    expect(cls("Auto Show", "concessionaria", "Concessionária / revenda")).toBe("showroom");
    expect(cls("Pneu Já", "pneus", "Pneus e borracharia")).toBe("display");
    expect(cls("Clínica Sorriso", "odontologia", "Dentista")).toBe("calm");
    expect(cls("Lava Rápido Brilho", "lavagem", "Lava-rápido")).toBe("arc");
    const glow = (n: string, s: string, c: string) => /class="hero arc glow-(\w+)"/.exec(html(n, s, c))?.[1];
    expect(glow("Lava Rápido Brilho", "lavagem", "Lava-rápido")).toBe("neon");
    expect(html("Barbearia Navalha", "barbearia", "Barbearia")).toContain("Cortes e estilos");
    expect(html("Auto Silva", "oficina", "Oficina mecânica")).toContain("Serviços e orçamento");
  });
  it("tipologia do ramo entra na faixa em movimento e na revisão, sinalizada para confirmação", () => {
    const c = make("Barbearia Navalha", "barbearia", { category: "Barbearia" });
    expect(c.reviewNotes.join(" ")).toMatch(/itens típicos de barbearia \(Degradê, Corte social, Navalhado…\): confirme/);
    expect(renderSite(c)).toContain("Navalhado");
  });
  it("horário de hoje e status ao vivo no painel; sem horário: 'Horário não informado'", () => {
    const h = html("Lava Rápido Brilho", "barbearia", "Lava-rápido");
    expect(h).toMatch(/Hoje · <b data-today>(09:00–18:00|Fechado hoje)<\/b>/);
    const none = renderSite(make("Lava Rápido Brilho", "barbearia", { category: "Lava-rápido", hoursLines: null }));
    expect(none).toContain("Horário não informado");
    expect(none).not.toContain("data-today");
  });
  it("detecta o ramo pelo texto e pelo objeto do conceito", () => {
    expect(nicheFromText("Pizzaria e Chopperia").key).toBe("pizzaria");
    expect(nicheFromText("Auto Center Silva").key).toBe("oficina");
    expect(nicheFromText("Construtora Alfa").key).toBe("construcao");
    expect(nicheFromText("Algo sem categoria").key).toBe("generico");
    expect(nicheOf("scissors", "Studio Bella salão de beleza").key).toBe("salao");
    expect(nicheOf("scissors", "Barbearia do Zé").key).toBe("barbearia");
    expect(Object.values(NICHES).every((n) => n.panelCta && n.offer && n.why)).toBe(true);
  });
  it("o runtime do arco é autossuficiente e leve (sem dependências, 30 quadros/s)", () => {
    const src = arcRuntime.toString();
    expect(src).not.toMatch(/\brequire\(|\bimport\(|__vite/);
    expect(src).toContain("createRadialGradient");
    expect(src).toContain("prefers-reduced-motion");
  });
});
