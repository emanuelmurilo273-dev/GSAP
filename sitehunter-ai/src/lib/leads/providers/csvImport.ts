import type { LeadCriteria, RawBusiness } from "../types";
import type { BusinessSearchProvider, ImportRow } from "./types";

// Dados fornecidos pelo próprio usuário (ex.: planilha de uma feira, lista
// de um diretório que ele tem direito de usar). A fonte fica registrada
// como "Fornecido pelo usuário".

/** Parser CSV mínimo (vírgula ou ponto e vírgula, aspas duplas). */
export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["nome", "name", "empresa", "razao social", "nome fantasia"],
  category: ["categoria", "category", "segmento", "nicho"],
  address: ["endereco", "endereço", "address"],
  city: ["cidade", "city", "municipio"],
  state: ["estado", "uf", "state"],
  phone: ["telefone", "phone", "fone", "whatsapp"],
  email: ["email", "e-mail"],
  website: ["site", "website", "url"],
  sourceUrl: ["fonte", "source", "origem"],
};

export function csvToRows(text: string): ImportRow[] {
  const [header, ...data] = parseCsv(text.trim());
  if (!header) return [];
  const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const idx: Partial<Record<keyof ImportRow, number>> = {};
  header.forEach((h, i) => {
    for (const [k, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.map(norm).includes(norm(h))) idx[k as keyof ImportRow] = i;
    }
  });
  if (idx.name === undefined) return [];
  return data
    .map((r) => {
      const o: ImportRow = { name: "" };
      for (const [k, i] of Object.entries(idx)) (o as Record<string, string>)[k] = (r[i!] ?? "").trim().slice(0, 400);
      return o;
    })
    .filter((r) => r.name);
}

export const importProvider: BusinessSearchProvider = {
  id: "import",
  label: "Importação do usuário (CSV)",
  kind: "import",
  configured: () => true,
  setupHint: "",
  async search(c: LeadCriteria, opts): Promise<RawBusiness[]> {
    const rows = (opts?.rows ?? []).slice(0, 200);
    return rows.map((r, i) => ({
      sourceId: `import:${Date.now().toString(36)}:${i}`,
      name: r.name,
      category: r.category || null,
      address: r.address || null,
      neighborhood: null,
      city: r.city || c.location || null,
      state: r.state || null,
      phone: r.phone || null,
      email: r.email || null,
      website: r.website ? (/^https?:\/\//i.test(r.website) ? r.website : `https://${r.website}`) : null,
      mapsUrl: null,
      lat: null,
      lng: null,
      businessStatus: null,
      source: { provider: "import", label: "Fornecido pelo usuário", url: r.sourceUrl && /^https?:\/\//.test(r.sourceUrl) ? r.sourceUrl : null },
    }));
  },
};
