import { env } from "../../env";
import { HttpError } from "../../http";
import { log } from "../../logger";
import { parseOsmHours } from "../hours";
import { stripAccents } from "../normalize";
import type { LeadCriteria, RawBusiness } from "../types";
import type { BusinessSearchProvider, SearchDiagnostics } from "./types";
import { cityById, cityViewbox, fold, resolveCity, type City } from "../../br/cities";

// OpenStreetMap via Nominatim (busca de estabelecimentos por categoria + local).
// Política de uso: https://operations.osmfoundation.org/policies/nominatim/
//  - no máximo 1 requisição por segundo, User-Agent identificado com contato;
//  - uso leve (uma consulta por busca, até 40 resultados), sem autocomplete;
//  - crédito obrigatório: "© colaboradores do OpenStreetMap" (licença ODbL).
// Para volume maior, aponte NOMINATIM_URL para uma instância própria.

/** Nicho em português → frase especial do Nominatim (categorias OSM). */
const PHRASES: [RegExp, string, string][] = [
  [/barbe|barber/, "hairdresser", "Barbearia / cabeleireiro"],
  [/salao|cabelei|beleza|estetic|manicure|nail|spa/, "beauty shop", "Salão de beleza"],
  [/odonto|dentist|dental/, "dentist", "Dentista"],
  [/clinic|consult|medic|saude/, "clinic", "Clínica"],
  [/veterin/, "veterinary", "Veterinário"],
  [/pet/, "pet shop", "Pet shop"],
  [/padaria|confeitar|bakery/, "bakery", "Padaria"],
  [/restaurant|comida|bistro|cantina/, "restaurant", "Restaurante"],
  [/pizz/, "pizzeria", "Pizzaria"],
  [/cafe|cafeteria/, "cafe", "Café"],
  [/lanch|hamburg|fast/, "fast food", "Lanchonete"],
  [/academ|gym|fitness|crossfit/, "gym", "Academia"],
  [/oficina|mecanic|auto ?center|car repair/, "car repair", "Oficina mecânica"],
  [/roupa|moda|boutique|clothes/, "clothes shop", "Loja de roupas"],
  [/imobili|corretor|real estate/, "estate agent", "Imobiliária"],
  [/farmac|drogaria/, "pharmacy", "Farmácia"],
  [/otica|optic/, "optician", "Ótica"],
  [/floricult|flores/, "florist", "Floricultura"],
  [/lavanderia/, "laundry", "Lavanderia"],
  [/construt|construc|material de constru/, "hardware store", "Materiais de construção"],
];

const TYPE_LABEL: Record<string, string> = {
  hairdresser: "Cabeleireiro / barbearia", beauty: "Salão de beleza", dentist: "Dentista", clinic: "Clínica", doctors: "Consultório médico",
  veterinary: "Veterinário", pet: "Pet shop", bakery: "Padaria", restaurant: "Restaurante", cafe: "Café", fast_food: "Lanchonete",
  fitness_centre: "Academia", car_repair: "Oficina mecânica", clothes: "Loja de roupas", estate_agent: "Imobiliária", pharmacy: "Farmácia",
  optician: "Ótica", florist: "Floricultura", laundry: "Lavanderia", hardware: "Materiais de construção", pizzeria: "Pizzaria",
};

/** Frase do Nominatim → filtro de tags do OSM para o Overpass. */
const OSM_TAGS: Record<string, string[]> = {
  hairdresser: ['["shop"="hairdresser"]', '["shop"="barber"]'], "beauty shop": ['["shop"="beauty"]'], dentist: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  clinic: ['["amenity"="clinic"]', '["amenity"="doctors"]'], veterinary: ['["amenity"="veterinary"]'], "pet shop": ['["shop"="pet"]', '["shop"="pet_grooming"]'],
  bakery: ['["shop"="bakery"]', '["shop"="pastry"]'], restaurant: ['["amenity"="restaurant"]'], pizzeria: ['["amenity"="restaurant"]["cuisine"~"pizza"]', '["amenity"="fast_food"]["cuisine"~"pizza"]'],
  cafe: ['["amenity"="cafe"]'], "fast food": ['["amenity"="fast_food"]'], gym: ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]["sport"="fitness"]'],
  "car repair": ['["shop"="car_repair"]', '["shop"="tyres"]'], "clothes shop": ['["shop"="clothes"]', '["shop"="boutique"]'], "estate agent": ['["office"="estate_agent"]'],
  pharmacy: ['["amenity"="pharmacy"]'], optician: ['["shop"="optician"]'], florist: ['["shop"="florist"]'], laundry: ['["shop"="laundry"]', '["shop"="dry_cleaning"]'],
  "hardware store": ['["shop"="hardware"]', '["shop"="doityourself"]'],
};

type OverpassEl = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** Elemento do Overpass no mesmo formato que o Nominatim devolve (para reaproveitar o mapeamento). */
export function overpassToNom(e: OverpassEl, city: City): NomItem | null {
  const t = e.tags ?? {};
  if (!t.name) return null;
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  const cat = ["shop", "amenity", "leisure", "office", "healthcare"].find((k) => t[k]) ?? "shop";
  return {
    osm_type: e.type, osm_id: e.id, lat: lat != null ? String(lat) : undefined, lon: lon != null ? String(lon) : undefined, name: t.name, category: cat, type: t[cat],
    address: { road: t["addr:street"], house_number: t["addr:housenumber"], suburb: t["addr:suburb"] ?? t["addr:neighbourhood"], city: t["addr:city"] ?? city.name, state: t["addr:state"] ?? city.uf },
    extratags: t,
  };
}

/** Servidores públicos do Overpass (fallback em ordem). OVERPASS_URL, se definido, vem primeiro. */
export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Consulta Overpass: todos os estabelecimentos do ramo com nome na área do município; quem tem
 * WhatsApp ou site é priorizado depois, no código. Uma união curta: a versão anterior, com filtro
 * por expressão regular na chave e uma cláusula por chave, estourava o tempo dos servidores (504).
 */
export function overpassQuery(phrase: string, city: City): string | null {
  const filters = OSM_TAGS[phrase];
  if (!filters) return null;
  const [w, n, e2, s2] = cityViewbox(city);
  const bbox = `${s2},${w},${n},${e2}`;
  return `[out:json][timeout:25][bbox:${bbox}];(${filters.map((f) => `nwr${f}["name"];`).join("")});out center tags 400;`;
}

export type OverpassResult = { items: NomItem[]; server: string | null; error: string | null };

async function overpassSearch(phrase: string, city: City, deadline: number): Promise<OverpassResult> {
  const q = overpassQuery(phrase, city);
  if (!q) return { items: [], server: null, error: null };
  const servers = [...new Set([env.overpassUrl, ...OVERPASS_MIRRORS].filter((x): x is string => !!x))];
  const errors: string[] = [];
  for (const base of servers) {
    const left = deadline - Date.now();
    if (left < 5_000) { errors.push("tempo esgotado"); break; }
    try {
      const res = await fetch(base, {
        method: "POST",
        body: new URLSearchParams({ data: q }),
        headers: { "User-Agent": nominatimUserAgent(), Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(35_000, left)),
      });
      if (!res.ok) { errors.push(`${new URL(base).host}: HTTP ${res.status}`); continue; }
      const j = (await res.json()) as { elements?: OverpassEl[]; remark?: string };
      if (!j.elements) { errors.push(`${new URL(base).host}: resposta sem dados`); continue; }
      return { items: j.elements.map((el) => overpassToNom(el, city)).filter((x): x is NomItem => !!x), server: new URL(base).host, error: null };
    } catch (e) {
      errors.push(`${new URL(base).host}: ${e instanceof Error && e.name === "TimeoutError" ? "sem resposta" : "falha de conexão"}`);
    }
  }
  return { items: [], server: null, error: errors.join("; ") || "indisponível" };
}

export function phraseFor(niche: string): { phrase: string; label: string } {
  const t = stripAccents(niche.toLowerCase());
  const hit = PHRASES.find(([r]) => r.test(t));
  return hit ? { phrase: hit[1], label: hit[2] } : { phrase: niche.trim(), label: niche.trim() };
}

type NomItem = {
  osm_type?: string; osm_id?: number; lat?: string; lon?: string; name?: string; category?: string; type?: string; display_name?: string;
  address?: Record<string, string>; extratags?: Record<string, string> | null;
};

const SOCIAL_KEYS: [string, (v: string) => string][] = [
  ["contact:instagram", (v) => {
    // Links de "stories" expiram: guarda o perfil.
    const u = /^https?:/.test(v) ? v : `https://instagram.com/${v.replace(/^@/, "")}`;
    return u.replace(/instagram\.com\/stories\/([^/?#]+).*/i, "instagram.com/$1/");
  }],
  ["contact:facebook", (v) => (/^https?:/.test(v) ? v : `https://facebook.com/${v}`)],
  ["contact:tiktok", (v) => (/^https?:/.test(v) ? v : `https://tiktok.com/@${v.replace(/^@/, "")}`)],
  ["contact:youtube", (v) => (/^https?:/.test(v) ? v : `https://youtube.com/${v}`)],
];

export function mapNominatim(x: NomItem, fallbackCategory: string): RawBusiness | null {
  if (!x.name || !x.osm_type || !x.osm_id) return null;
  if (["boundary", "place", "highway", "landuse", "natural", "waterway"].includes(x.category ?? "")) return null;
  const a = x.address ?? {};
  const t = x.extratags ?? {};
  const street = [a.road, a.house_number].filter(Boolean).join(", ");
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? null;
  const address = [street, a.suburb ?? a.neighbourhood, city, a.state].filter(Boolean).join(" · ") || null;
  const url = `https://www.openstreetmap.org/${x.osm_type}/${x.osm_id}`;
  const website = t.website ?? t["contact:website"] ?? t.url ?? null;
  const hoursRaw = t.opening_hours ?? null;
  return {
    sourceId: `${x.osm_type}/${x.osm_id}`,
    name: x.name,
    category: TYPE_LABEL[x.type ?? ""] ?? fallbackCategory,
    address,
    neighborhood: a.suburb ?? a.neighbourhood ?? null,
    city,
    state: a.state ?? null,
    phone: t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? null,
    email: t.email ?? t["contact:email"] ?? null,
    website: website && /^https?:\/\//i.test(website) ? website : website ? `https://${website}` : null,
    mapsUrl: url,
    lat: x.lat ? Number(x.lat) : null,
    lng: x.lon ? Number(x.lon) : null,
    businessStatus: null,
    source: { provider: "osm", label: "OpenStreetMap", url },
    hours: parseOsmHours(hoursRaw),
    hoursRaw,
    socialLinks: SOCIAL_KEYS.filter(([k]) => t[k]).map(([k, f]) => f(t[k]!.trim())),
    whatsapp: t["contact:whatsapp"] ?? t.whatsapp ?? null,
  };
}

// Fila global: garante ≥ 1,1 s entre requisições ao Nominatim (política de uso).
let last = 0;
let chain: Promise<unknown> = Promise.resolve();
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export function nominatimUserAgent() {
  const contact = env.osmContactEmail ? `; ${env.osmContactEmail}` : "";
  return `SiteHunterAI/1.0 (+${env.appUrl}${contact})`;
}

async function nominatim(params: URLSearchParams, language: string): Promise<NomItem[]> {
  const base = (env.nominatimUrl ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");
  const res = await throttle(() =>
    fetch(`${base}/search?${params}`, { headers: { "User-Agent": nominatimUserAgent(), "Accept-Language": language }, cache: "no-store", signal: AbortSignal.timeout(20_000) }),
  ).catch((e) => {
    log("error", "osm_search_failed", { error: String(e) });
    throw new HttpError(502, "O OpenStreetMap (Nominatim) não respondeu. Tente novamente em instantes.", "upstream");
  });
  if (res.status === 429 || res.status === 403) throw new HttpError(503, "O Nominatim limitou as consultas (política de uso). Aguarde alguns minutos ou configure NOMINATIM_URL com uma instância própria.", "upstream");
  if (!res.ok) throw new HttpError(502, "O OpenStreetMap (Nominatim) não respondeu corretamente.", "upstream");
  return (await res.json()) as NomItem[];
}

export const osmProvider: BusinessSearchProvider = {
  id: "osm",
  label: "OpenStreetMap",
  kind: "real",
  configured: () => true,
  setupHint: "",
  async search(c: LeadCriteria, opts): Promise<RawBusiness[]> {
    const { phrase, label } = phraseFor(c.niche);
    // Qualquer município do Brasil: escolhido na lista (código IBGE) ou reconhecido no texto ("Chapecó - SC").
    const city: City | null = cityById(c.cityIbge) ?? resolveCity(c.location, c.uf).city;
    const limit = String(Math.min(40, Math.max(c.count * 2, 10)));
    const queries: URLSearchParams[] = [];
    if (city) {
      // 1) categoria dentro da área do município; 2) "categoria em Cidade, UF" (pega o que estiver fora da caixa).
      queries.push(new URLSearchParams({ q: phrase, viewbox: cityViewbox(city).join(","), bounded: "1", countrycodes: "br", format: "jsonv2", limit, addressdetails: "1", extratags: "1" }));
      queries.push(new URLSearchParams({ q: `${phrase} in ${city.name}, ${city.uf}, Brasil`, countrycodes: "br", format: "jsonv2", limit, addressdetails: "1", extratags: "1" }));
      // 3) o termo em português dentro da área (pega estabelecimentos com o ramo no nome, ex.: "Academia Fit").
      if (fold(c.niche) !== fold(phrase)) queries.push(new URLSearchParams({ q: c.niche, viewbox: cityViewbox(city).join(","), bounded: "1", countrycodes: "br", format: "jsonv2", limit, addressdetails: "1", extratags: "1" }));
    } else {
      queries.push(new URLSearchParams({ q: `${phrase} in ${c.location}`, format: "jsonv2", limit, addressdetails: "1", extratags: "1" }));
    }
    const seen = new Set<string>();
    const out: RawBusiness[] = [];
    const diag: SearchDiagnostics = { overpass: city && OSM_TAGS[phrase] ? "failed" : "skipped", overpassServer: null, overpassError: null, nominatimQueries: 0 };
    // 0) Overpass primeiro: empresas do ramo com WhatsApp ou site cadastrados. Se todos os servidores
    //    falharem, segue com o Nominatim e o motivo aparece no resumo da busca.
    if (city && OSM_TAGS[phrase]) {
      const ov = await overpassSearch(phrase, city, Date.now() + 60_000);
      diag.overpassServer = ov.server;
      diag.overpassError = ov.error;
      if (!ov.error) diag.overpass = "ok";
      else log("warn", "overpass_failed", { error: ov.error });
      for (const x of ov.items) {
        const r = mapNominatim(x, label);
        if (!r || seen.has(r.sourceId)) continue;
        // A caixa do município encosta nas vizinhas: descarta endereço de outra cidade.
        if (r.city && fold(r.city) !== fold(city.name)) continue;
        seen.add(r.sourceId);
        out.push(r);
      }
    }
    for (const params of queries) {
      if (env.osmContactEmail) params.set("email", env.osmContactEmail);
      diag.nominatimQueries++;
      const items = await nominatim(params, c.language);
      for (const x of items) {
        const r = mapNominatim(x, label);
        if (!r || seen.has(r.sourceId)) continue;
        // Com município escolhido, descarta resultados de outras cidades (a caixa pode encostar em vizinhas).
        if (city && r.city && fold(r.city) !== fold(city.name)) continue;
        seen.add(r.sourceId);
        out.push(city && !r.state ? { ...r, state: city.uf } : r);
      }
      if (out.filter((r) => r.whatsapp || r.website).length >= c.count) break;
    }
    // Prioriza quem tem WhatsApp cadastrado, depois quem tem site (onde o WhatsApp costuma estar publicado).
    const rank = (r: RawBusiness) => (r.whatsapp ? 0 : r.website ? 1 : 2);
    opts?.onDiagnostics?.(diag);
    return out.sort((a, b) => rank(a) - rank(b)).slice(0, c.count);
  },
};
