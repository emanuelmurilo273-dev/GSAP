import type { RawBusiness } from "./types";

// Normalização e deduplicação de empresas.

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const LEGAL = /\b(ltda|me|epp|eireli|s\/?a|sa|mei|inc|llc|ltd|sl|srl|cia|e\s+cia)\b\.?/g;

export function normalizeName(name: string): string {
  return stripAccents(name.toLowerCase())
    .replace(/&/g, " e ")
    .replace(LEGAL, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Últimos 8+ dígitos significativos (ignora código do país e formatação). */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  if (!x || !y) return false;
  return x.slice(-8) === y.slice(-8);
}

export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

const SOCIAL_HOSTS = /(^|\.)(instagram\.com|facebook\.com|fb\.com|linktr\.ee|wa\.me|whatsapp\.com|tiktok\.com|ifood\.com\.br|linkedin\.com|youtube\.com|x\.com|twitter\.com|threads\.net)$/i;

export function isSocialUrl(url: string | null | undefined): boolean {
  const d = normalizeDomain(url);
  return !!d && SOCIAL_HOSTS.test(d);
}

export function socialNetwork(url: string): string | null {
  const d = normalizeDomain(url);
  if (!d) return null;
  const m = d.match(/(instagram|facebook|fb|linktr|wa|whatsapp|tiktok|ifood|linkedin|youtube|x|twitter|threads)\./);
  if (!m) return null;
  return ({ fb: "facebook", wa: "whatsapp", linktr: "linktree", twitter: "x" } as Record<string, string>)[m[1]!] ?? m[1]!;
}

/**
 * Chaves de deduplicação. Duas empresas são consideradas a mesma se
 * compartilharem qualquer chave: domínio próprio, telefone ou nome+cidade.
 * Perfis sociais não viram chave de domínio (instagram.com é comum a todos),
 * mas o caminho do perfil vira.
 */
export function dedupeKeys(b: Pick<RawBusiness, "name" | "city" | "phone" | "website">): string[] {
  const keys = new Set<string>();
  if (b.website) {
    if (isSocialUrl(b.website)) {
      try {
        const u = new URL(b.website);
        const path = u.pathname.replace(/\/+$/, "").toLowerCase();
        if (path && path !== "/") keys.add(`social:${normalizeDomain(b.website)}${path}`);
      } catch {
        /* ignora */
      }
    } else {
      const d = normalizeDomain(b.website);
      if (d) keys.add(`domain:${d}`);
    }
  }
  const p = normalizePhone(b.phone);
  if (p) keys.add(`phone:${p.slice(-8)}`);
  const n = normalizeName(b.name);
  if (n) keys.add(`name:${n}|${normalizeName(b.city ?? "")}`);
  return [...keys];
}

/** Remove duplicatas dentro de um lote mantendo a primeira ocorrência. */
export function dedupeBatch<T extends Pick<RawBusiness, "name" | "city" | "phone" | "website">>(items: T[]): { unique: T[]; duplicates: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicates = 0;
  for (const it of items) {
    const keys = dedupeKeys(it);
    if (keys.some((k) => seen.has(k))) {
      duplicates++;
      continue;
    }
    keys.forEach((k) => seen.add(k));
    unique.push(it);
  }
  return { unique, duplicates };
}

/** Sugere um modelo de site a partir do nicho digitado (inferência; o usuário pode trocar). */
export function guessSegmentKey(niche: string, category?: string | null): string {
  const t = stripAccents(`${niche} ${category ?? ""}`.toLowerCase());
  const rules: [RegExp, string][] = [
    [/barbe|barber/, "barbearia"],
    [/salao|beleza|beauty|cabelei|estetic|manicure|nail/, "salao"],
    [/padaria|bakery|panader|confeitar/, "padaria"],
    [/restaurant|pizz|lanchon|hamburg|cafe|bistro|comida|food|bar\b/, "restaurante"],
    [/odonto|dentist|dental/, "odontologia"],
    [/clinic|consult|medic|fisio|psico|doctor|veterin/, "clinica"],
    [/academ|gym|fitness|crossfit|pilates|yoga/, "academia"],
    [/oficina|mecanic|auto ?center|car repair|funilar/, "oficina"],
    [/roupa|moda|boutique|clothing|fashion|loja/, "roupas"],
    [/imobili|real estate|corretor/, "imobiliaria"],
    [/pet|veterin/, "petshop"],
    [/constru|reforma|contractor|engenhar|arquitet/, "construcao"],
  ];
  return rules.find(([r]) => r.test(t))?.[1] ?? "servicos";
}
