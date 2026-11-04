import type { LeadCriteria, RawBusiness } from "../types";
import type { BusinessSearchProvider } from "./types";

// MODO DEMONSTRAÇÃO — gera empresas FICTÍCIAS, claramente identificadas.
// Nenhum dado aqui corresponde a uma empresa real: nomes têm o sufixo
// "(demo)", endereços usam "Rua Exemplo", telefones usam o prefixo 0000 e
// sites usam o domínio reservado example.com (RFC 2606).

const ADJ = ["Aurora", "Horizonte", "Bela Vista", "Central", "Primavera", "Atlântico", "Serra Azul", "Jardim", "Estrela", "Raiz", "Vértice", "Lume"];
const STREETS = ["Rua Exemplo", "Avenida Modelo", "Travessa Demonstração", "Alameda Fictícia"];

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function titleCase(s: string) {
  return s.replace(/\S+/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}

export const demoProvider: BusinessSearchProvider = {
  id: "demo",
  label: "Modo demonstração (dados fictícios)",
  kind: "demo",
  configured: () => true,
  setupHint: "",
  async search(c: LeadCriteria): Promise<RawBusiness[]> {
    const seed = hash(`${c.niche}|${c.location}`);
    const niche = titleCase(c.niche.trim());
    const city = titleCase(c.location.split(",")[0]!.trim());
    const out: RawBusiness[] = [];
    for (let i = 0; i < c.count; i++) {
      const r = (seed + i * 7919) >>> 0;
      const adj = ADJ[(seed + i) % ADJ.length]! + (i >= ADJ.length ? ` ${Math.floor(i / ADJ.length) + 1}` : "");
      const variant = r % 5; // distribui cenários de presença digital
      const slug = `${niche}-${adj}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
      const website =
        variant === 0 || variant === 1 ? null : variant === 2 ? `https://instagram.com/${slug.replace(/-/g, "")}_demo` : `https://${slug}.example.com`;
      out.push({
        sourceId: `demo:${seed}:${i}`,
        name: `${niche} ${adj} (demo)`,
        category: niche,
        address: `${STREETS[r % STREETS.length]}, ${100 + (r % 900)} — ${city} (endereço fictício)`,
        neighborhood: null,
        city,
        state: null,
        phone: i % 4 === 3 ? null : `(00) 0000-${String(1000 + ((seed + i * 37) % 9000)).padStart(4, "0")}`,
        email: variant >= 3 ? `contato@${slug}.example.com` : null,
        website,
        mapsUrl: null,
        lat: null,
        lng: null,
        businessStatus: "OPERATIONAL",
        source: { provider: "demo", label: "Demonstração (fictício)", url: null },
      });
    }
    return out;
  },
};
