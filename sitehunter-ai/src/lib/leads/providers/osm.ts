import { env } from "../../env";
import { HttpError } from "../../http";
import { log } from "../../logger";
import { parseOsmHours } from "../hours";
import { stripAccents } from "../normalize";
import type { LeadCriteria, RawBusiness } from "../types";
import type { BusinessSearchProvider } from "./types";

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

export const osmProvider: BusinessSearchProvider = {
  id: "osm",
  label: "OpenStreetMap",
  kind: "real",
  configured: () => true,
  setupHint: "",
  async search(c: LeadCriteria): Promise<RawBusiness[]> {
    const { phrase, label } = phraseFor(c.niche);
    const base = (env.nominatimUrl ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");
    const params = new URLSearchParams({ q: `${phrase} in ${c.location}`, format: "jsonv2", limit: String(Math.min(40, Math.max(c.count * 2, 10))), addressdetails: "1", extratags: "1" });
    if (env.osmContactEmail) params.set("email", env.osmContactEmail);
    const res = await throttle(() =>
      fetch(`${base}/search?${params}`, { headers: { "User-Agent": nominatimUserAgent(), "Accept-Language": c.language }, cache: "no-store", signal: AbortSignal.timeout(20_000) }),
    ).catch((e) => {
      log("error", "osm_search_failed", { error: String(e) });
      throw new HttpError(502, "O OpenStreetMap (Nominatim) não respondeu. Tente novamente em instantes.", "upstream");
    });
    if (res.status === 429 || res.status === 403) throw new HttpError(503, "O Nominatim limitou as consultas (política de uso). Aguarde alguns minutos ou configure NOMINATIM_URL com uma instância própria.", "upstream");
    if (!res.ok) throw new HttpError(502, "O OpenStreetMap (Nominatim) não respondeu corretamente.", "upstream");
    const items = (await res.json()) as NomItem[];
    return items.map((x) => mapNominatim(x, label)).filter((x): x is RawBusiness => !!x).slice(0, c.count);
  },
};
