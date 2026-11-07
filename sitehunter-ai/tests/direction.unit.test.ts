import { describe, expect, it } from "vitest";
import { designDirectionFor } from "@/lib/site/direction";
import { buildConcept } from "@/lib/site/immersive/concept";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { companyWhere, filtersToQuery, readFilters } from "@/lib/adminCompanies";

const co = (name: string, category: string, extra: Partial<CompanyInfo> = {}): CompanyInfo => ({ name, category, address: "Av. Brasil, 100", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 3333-1111", website: null, mapsUrl: null, ...extra } as CompanyInfo);

describe("Direção visual por ramo", () => {
  it("cada ramo tem direção própria e as referências são links https reais da pesquisa", () => {
    const keys = ["concessionaria", "oficina", "autopecas", "pneus", "funilaria", "lavagem", "vistoria", "barbearia", "pizzaria", "restaurante", "odonto", "academia"];
    const names = new Set<string>();
    for (const k of keys) {
      const d = designDirectionFor(k);
      expect(d.key, k).toBe(k);
      expect(d.why.length, k).toBeGreaterThan(40);
      names.add(d.name);
      for (const r of d.refs) expect(r.url, r.title).toMatch(/^https:\/\/[^\s]+$/);
    }
    expect(names.size).toBe(keys.length); // nenhuma direção repetida entre ramos
  });
  it("o texto da empresa refina o segmento genérico, sem trocar um ramo específico", () => {
    expect(designDirectionFor("oficina", "Pneus Rápido Borracharia").key).toBe("pneus");
    expect(designDirectionFor("barbearia", "Auto Peças Silva").key).toBe("barbearia");
    expect(designDirectionFor("servicos", "Lava Rápido Brilho").key).toBe("lavagem");
    expect(designDirectionFor(undefined, "Empresa qualquer").key).toBe("servicos");
  });
  it("a direção manda no clima e na paleta do conceito (claro na vistoria e na odonto, escuro nos demais)", () => {
    const mood = (seg: string, name: string, cat: string) => buildConcept({ name, category: cat, segmentKey: seg } as never).mood;
    expect(mood("odontologia", "Sorriso Bom", "Dentista")).toBe("ivory");
    expect(mood("vistoria", "Vistoria Fácil", "Vistoria veicular")).toBe("ivory");
    expect(mood("concessionaria", "Auto Show", "Concessionária / revenda")).toBe("noir");
    expect(mood("barbearia", "Navalha", "Barbearia")).toBe("noir");
  });
  it("ramos diferentes recebem identidades diferentes (paleta e tipografia não coincidem em todos)", () => {
    const sig = (seg: string, n: string, c: string) => { const k = buildConcept({ name: n, category: c, segmentKey: seg } as never); return `${k.palette.accent}|${k.display}|${k.layout}`; };
    const all = new Set([sig("concessionaria", "Auto Show", "Concessionária"), sig("lavagem", "Brilho", "Lava-rápido"), sig("pneus", "Pneu Já", "Pneus"), sig("odontologia", "Sorriso", "Dentista"), sig("pizzaria", "Forno", "Pizzaria"), sig("academia", "Força", "Academia")]);
    expect(all.size).toBeGreaterThanOrEqual(5);
  });
});

describe("Consulta rápida nos sites automotivos", () => {
  const render = (seg: string, c: CompanyInfo) => { const s = getSegment(seg); return renderSite(buildSiteContent(c, s, fallbackCopy(c, s), []), { lang: "pt-BR" } as never); };
  it("pneus: formulário com a medida; sem WhatsApp, o botão liga e a página avisa", () => {
    const html = render("pneus", co("Pneu Já", "Pneus e borracharia"));
    expect(html).toContain("data-ask");
    expect(html).toContain("Medida do pneu");
    expect(html).toContain('data-via="tel"');
    expect(html).toContain("não publicou WhatsApp");
  });
  it("sem nenhum contato publicado a seção não aparece; ramo sem consulta também não", () => {
    expect(render("pneus", co("Pneu Já", "Pneus", { phone: null, email: null }))).not.toContain("data-ask ");
    expect(render("barbearia", co("Navalha", "Barbearia"))).not.toContain("data-ask ");
  });
});

describe("Filtros administrativos de empresas", () => {
  it("lê e limita os parâmetros e monta a consulta sem demo e sem excluídas por padrão", () => {
    const f = readFilters({ q: "  auto  ", uf: "sp123", contato: "phone", cat: ["Autopeças", "x"] });
    expect(f).toMatchObject({ q: "auto", uf: "SP", contato: "phone", cat: "Autopeças" });
    const w = JSON.stringify(companyWhere(f));
    expect(w).toContain('"isDemo":false');
    expect(w).toContain('"excludedAt":null');
    expect(w).toContain('"phone":{"not":null}');
    expect(JSON.stringify(companyWhere(readFilters({ situacao: "excluded" })))).toContain('"excludedAt":{"not":null}');
    expect(filtersToQuery({ q: "a b", uf: "" })).toBe("?q=a+b");
  });
});
