import { describe, expect, it } from "vitest";
import { applyChanges, editableFields, inventedNumbers, proposeSiteEdit, validateProposal } from "@/lib/siteEdit";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";

const co: CompanyInfo = { name: "Barbearia Navalha", category: "Barbearia", address: "Rua A, 1", neighborhood: "Centro", city: "Curitiba", state: "PR", phone: "(41) 3333-1111", website: null, mapsUrl: null, lat: null, lng: null, hoursLines: null, whatsapp: "" };
const seg = getSegment("barbearia");
const content = buildSiteContent(co, seg, fallbackCopy(co, seg), []);

describe("Claude editando o site", () => {
  it("só lista campos de texto; contato, preço e imagem ficam de fora", () => {
    const f = editableFields(content);
    expect(f.some((x) => x.path === "siteName")).toBe(true);
    expect(f.some((x) => /phone|whatsapp|price|image|url/.test(x.path))).toBe(false);
  });
  it("descarta campo não permitido, texto grande demais e número inventado", () => {
    const title = editableFields(content).find((x) => x.path.endsWith(".title"))!;
    const p = validateProposal(content, "mais direto", { summary: "ok", changes: [
      { path: "business.phone", value: "(11) 99999-0000" },
      { path: title.path, value: "x".repeat(title.max + 1) },
      { path: title.path, value: "Mais de 25 anos de tradição" },
      { path: "siteName", value: "Navalha Barbearia" },
    ] });
    expect(p.changes.map((c) => c.path)).toEqual(["siteName"]);
    expect(p.skipped).toHaveLength(3);
  });
  it("número que a pessoa pediu ou que já está no site passa", () => {
    expect(inventedNumbers("Atendemos das 9h às 18h", "pedido: 9h às 18h")).toEqual([]);
    expect(inventedNumbers("Desde 1998", "Rua A, 1")).toEqual(["1998"]);
  });
  it("aplicar recusa caminho fora da lista e mantém o resultado válido", () => {
    expect(() => applyChanges(content, [{ path: "business.phone", after: "1" }])).toThrow();
    const out = applyChanges(content, [{ path: "siteName", after: "Navalha Club" }]);
    expect(out.siteName).toBe("Navalha Club");
    expect(out.business.phone).toBe(content.business.phone);
  });
  it("usa a ferramenta forçada e valida a resposta (SDK simulado)", async () => {
    let seen: Record<string, unknown> = {};
    const sdk = { messages: { create: async (a: Record<string, unknown>) => { seen = a; return { content: [{ type: "tool_use", id: "t", name: "propose_site_edit", input: { summary: "Nome mais curto", changes: [{ path: "siteName", value: "Navalha" }] } }] }; } } };
    const r = await proposeSiteEdit(content, "nome mais curto", sdk as never);
    expect(r.changes[0]!.after).toBe("Navalha");
    expect(seen.tool_choice).toEqual({ type: "tool", name: "propose_site_edit" });
    expect(JSON.stringify(seen.messages)).not.toContain("(41) 3333-1111\"}</campos"); // contato não entra como campo editável
  });
});
