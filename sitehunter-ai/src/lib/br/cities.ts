import data from "./municipios.json";
import { UFS } from "./ufs";

// Todos os 5.570 municípios brasileiros + Distrito Federal, com código IBGE, UF, coordenadas
// da sede e DDD. Fonte: lista "municipios-brasileiros" (Kelvin S. do Prado, licença MIT),
// derivada das bases do IBGE. Fica embutida para a busca funcionar sem depender de outra API.

export type City = { ibge: number; name: string; uf: string; lat: number; lng: number; ddd: number; capital: boolean };

export { UFS };

export const CITIES: City[] = (data as [number, string, string, number, number, number, number][]).map(([ibge, name, uf, lat, lng, ddd, cap]) => ({ ibge, name, uf, lat, lng, ddd, capital: cap === 1 }));
const BY_ID = new Map(CITIES.map((c) => [c.ibge, c]));
export const VALID_DDDS = new Set(CITIES.map((c) => c.ddd));

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function cityById(ibge: number | null | undefined): City | null {
  return ibge ? BY_ID.get(ibge) ?? null : null;
}

export function citiesOf(uf: string): City[] {
  return CITIES.filter((c) => c.uf === uf.toUpperCase());
}

/** Busca por nome (com ou sem acento), opcionalmente filtrando a UF. Começo do nome vem primeiro. */
export function searchCities(q: string, uf?: string | null, limit = 12): City[] {
  const f = fold(q);
  if (!f) return [];
  const pool = uf ? citiesOf(uf) : CITIES;
  const starts: City[] = [], contains: City[] = [];
  for (const c of pool) {
    const n = fold(c.name);
    if (n.startsWith(f)) starts.push(c);
    else if (n.includes(f)) contains.push(c);
  }
  const rank = (a: City, b: City) => Number(b.capital) - Number(a.capital) || a.name.length - b.name.length;
  return [...starts.sort(rank), ...contains.sort(rank)].slice(0, limit);
}

/**
 * Interpreta um texto livre ("Chapecó", "Chapecó - SC", "São José, SC").
 * Quando o nome existe em mais de uma UF e nenhuma foi informada, devolve as opções para o usuário escolher.
 */
export function resolveCity(text: string, uf?: string | null): { city: City | null; options: City[] } {
  const m = text.match(/^(.*?)(?:\s*[-,/]\s*|\s+)([A-Za-z]{2})$/);
  const name = m && UFS[m[2]!.toUpperCase()] ? m[1]! : text;
  const u = (m && UFS[m[2]!.toUpperCase()] ? m[2]! : uf ?? "")?.toUpperCase() || null;
  const f = fold(name);
  const exact = (u ? citiesOf(u) : CITIES).filter((c) => fold(c.name) === f);
  if (exact.length === 1) return { city: exact[0]!, options: [] };
  if (exact.length > 1) return { city: null, options: exact };
  return { city: null, options: searchCities(name, u, 8) };
}

/** Caixa aproximada em volta da sede do município (graus). Capitais e metrópoles recebem uma área maior. */
export function cityViewbox(c: City): [number, number, number, number] {
  const r = c.capital ? 0.22 : 0.12;
  return [c.lng - r, c.lat + r, c.lng + r, c.lat - r];
}

export function cityLabel(c: City) {
  return `${c.name} - ${c.uf}`;
}
