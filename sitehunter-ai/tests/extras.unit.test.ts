import { describe, expect, it } from "vitest";
import { chapterNavHtml, extrasRuntime, motionButtonHtml, paletteHtml, storyHtml, FX_FOR } from "@/lib/site/immersive/extras";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { realRuntime } from "@/lib/site/immersive/realRuntime";

const base: CompanyInfo = { name: "", category: null, address: "Rua A, 1", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 3333-1111", website: null, mapsUrl: null, lat: null, lng: null, hoursLines: null, whatsapp: "" };
const page = (name: string, seg: string) => {
  const co = { ...base, name };
  const s = getSegment(seg);
  return renderSite(buildSiteContent(co, s, fallbackCopy(co, s), []));
};

describe("Extras de experiência dos sites", () => {
  it("a paleta tem papéis de acessibilidade e escapa texto", () => {
    const h = paletteHtml([{ label: "Ligar <b>", href: "tel:+5541333311" }, { label: "Pausar", action: "motion" }]);
    expect(h).toContain('role="dialog"');
    expect(h).toContain('aria-modal="true"');
    expect(h).toContain('role="combobox"');
    expect(h).not.toContain("<b>");
    expect(h).toContain("&lt;b&gt;");
  });
  it("o botão de pausa é um botão com estado", () => {
    expect(motionButtonHtml).toContain("aria-pressed");
  });
  it("capítulos e passos geram marcação navegável", () => {
    expect(chapterNavHtml([{ id: "a", label: "Início" }])).toBe(""); // menos de 3 capítulos não vale um índice
    expect(chapterNavHtml([{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }])).toContain('href="#b"');
    const s = storyHtml([{ t: "Escolha", d: "Veja as opções" }, { t: "Visite", d: "Venha" }], "Como funciona", "Passo a passo");
    expect(s).toContain("Escolha");
    expect(s).toContain("Visite");
  });
  it("o script de extras é serializável e válido", () => {
    const src = `(${extrasRuntime.toString()})`;
    expect(() => new Function(`return ${src}`)).not.toThrow();
  });
  it("campos de partículas só onde combinam", () => {
    expect(FX_FOR.calm).toBe("none");
    expect(FX_FOR.arc).toBe("none");
    expect(FX_FOR.spec).toBe("sparks");
  });
  it("páginas geradas trazem a paleta, a pausa e o ⌘K", () => {
    for (const [n, s] of [["Auto Center Pinheiro", "oficina"], ["Barbearia Navalha", "barbearia"], ["Forno da Vila", "restaurante"]]) {
      const h = page(n, s);
      expect(h).toContain("data-pal");
      expect(h).toContain("data-motion-toggle");
    }
  });
  it("o 3D respeita a pausa do visitante", () => {
    expect(String(realRuntime)).toContain("paused");
    expect(String(realRuntime)).toContain("hx:motion");
  });
});
