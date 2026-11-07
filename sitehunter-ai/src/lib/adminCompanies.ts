import type { Prisma } from "@prisma/client";

// Filtros da lista administrativa de empresas. Usado pela página e pela exportação, para que
// "o que aparece na tela" e "o que vai no CSV" sejam sempre o mesmo conjunto.
export type CompanyFilters = { q: string; cat: string; uf: string; contato: string; situacao: string; fonte: string };

export const CONTACT_FILTERS = [
  { key: "", label: "Qualquer contato" },
  { key: "phone", label: "Com telefone" },
  { key: "email", label: "Com e-mail" },
  { key: "site", label: "Com site" },
  { key: "none", label: "Sem nenhum contato" },
] as const;

export const SITUATIONS = [
  { key: "", label: "Ativas" },
  { key: "contacted", label: "Já contatadas" },
  { key: "preview", label: "Com prévia de site" },
  { key: "nopreview", label: "Sem prévia" },
  { key: "excluded", label: "Excluídas" },
  { key: "all", label: "Todas" },
] as const;

export function readFilters(sp: Record<string, string | string[] | undefined>): CompanyFilters {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v ?? "").toString().slice(0, 80); };
  return { q: one("q").trim(), cat: one("cat"), uf: one("uf").toUpperCase().slice(0, 2), contato: one("contato"), situacao: one("situacao"), fonte: one("fonte") };
}

export function companyWhere(f: CompanyFilters): Prisma.CompanyWhereInput {
  const and: Prisma.CompanyWhereInput[] = [{ isDemo: false }];
  if (f.q) and.push({ OR: [{ name: { contains: f.q, mode: "insensitive" } }, { city: { contains: f.q, mode: "insensitive" } }, { phone: { contains: f.q.replace(/\D/g, "") || "§" } }] });
  if (f.cat) and.push({ category: f.cat });
  if (f.uf) and.push({ OR: [{ state: f.uf }, { state: { startsWith: f.uf } }] });
  if (f.fonte) and.push({ source: f.fonte });
  if (f.contato === "phone") and.push({ phone: { not: null } });
  if (f.contato === "email") and.push({ email: { not: null } });
  if (f.contato === "site") and.push({ website: { not: null } });
  if (f.contato === "none") and.push({ phone: null, email: null, website: null });
  switch (f.situacao) {
    case "contacted": and.push({ contactedAt: { not: null }, excludedAt: null }); break;
    case "preview": and.push({ projects: { some: {} }, excludedAt: null }); break;
    case "nopreview": and.push({ projects: { none: {} }, excludedAt: null }); break;
    case "excluded": and.push({ excludedAt: { not: null } }); break;
    case "all": break;
    default: and.push({ excludedAt: null });
  }
  return { AND: and };
}

export function filtersToQuery(f: Partial<CompanyFilters>, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
