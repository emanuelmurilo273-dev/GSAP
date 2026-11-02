// Design próprio para cada empresa: paleta, tipografia e composição são escolhidas
// a partir do segmento, das cores da marca (quando encontradas na pesquisa) e de uma
// semente derivada da própria empresa. Duas empresas do mesmo ramo recebem sites
// visualmente diferentes; a mesma empresa sempre recebe o mesmo design.
import type { Layout, SiteContent, Theme } from "./types";
import type { Segment } from "./templates";
import { contrast, isDark, mix, readable } from "./renderer/color";

type Style = SiteContent["style"];
type Font = Theme["headingFont"];

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mixSeed(seed: number, salt: number) {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const pick = <T,>(arr: readonly T[], seed: number, salt: number): T => arr[mixSeed(seed, salt) % arr.length]!;

/** Pares tipográficos por personalidade (título, texto). */
const FONT_PAIRS: Record<Style, [Font, Font][]> = {
  elegant: [["Playfair Display", "Lato"], ["Cormorant Garamond", "Manrope"], ["Fraunces", "Work Sans"], ["DM Serif Display", "DM Sans"], ["Libre Baskerville", "Outfit"]],
  bold: [["Bebas Neue", "DM Sans"], ["Anton", "Work Sans"], ["Oswald", "Rubik"], ["Archivo", "Archivo"], ["Barlow", "Manrope"]],
  clean: [["Poppins", "Nunito"], ["Plus Jakarta Sans", "Plus Jakarta Sans"], ["Sora", "Manrope"], ["Outfit", "Work Sans"], ["Quicksand", "Nunito"]],
  industrial: [["Oswald", "Roboto"], ["Barlow", "Barlow"], ["Archivo", "Work Sans"], ["Anton", "Rubik"]],
  editorial: [["Playfair Display", "DM Sans"], ["Fraunces", "Manrope"], ["Abril Fatface", "Work Sans"], ["Cormorant Garamond", "Josefin Sans"], ["DM Serif Display", "Outfit"]],
  corporate: [["Montserrat", "Open Sans"], ["Plus Jakarta Sans", "Inter"], ["Sora", "Work Sans"], ["Manrope", "Manrope"], ["Archivo", "Inter"]],
};

/** Paletas alternativas por segmento [primária, destaque, fundo, superfície, texto, texto secundário]. */
const PALETTES: Record<string, [string, string, string, string, string, string][]> = {
  barbearia: [["#8a6a2f", "#d9b26a", "#0b0b0c", "#141416", "#f4f1ea", "#a7a39a"], ["#7f1d1d", "#f2c94c", "#111111", "#1a1a1a", "#f5f5f4", "#a8a29e"], ["#1f3b2d", "#c9a227", "#0d1210", "#151c18", "#eef2ee", "#9aa69e"], ["#22314d", "#e0b15c", "#0b0f17", "#131a26", "#f1f5f9", "#94a3b8"]],
  salao: [["#9d2b5e", "#f2b8cf", "#fdf8f6", "#f7ece8", "#2a1620", "#7a5f69"], ["#6b4e9b", "#e9c46a", "#faf7fc", "#f0eaf6", "#231a33", "#6f6480"], ["#b5651d", "#f4d6b8", "#fffaf5", "#f6ece2", "#2e1d10", "#7d6550"], ["#1f1f1f", "#d4a373", "#f8f5f0", "#efe9df", "#1a1a1a", "#6b645a"]],
  restaurante: [["#7a2516", "#e2a857", "#130d0a", "#1c1410", "#f4ebdd", "#bfae95"], ["#2f4f2f", "#e9c46a", "#0f140f", "#182018", "#eef2e6", "#a6b09a"], ["#9a3412", "#fbbf24", "#fffaf3", "#f6ecdf", "#2a1a0e", "#7a6450"], ["#1e3a5f", "#f4a261", "#0d1420", "#152030", "#eef3f8", "#9fb0c4"]],
  odontologia: [["#0b5cad", "#5ee0c8", "#ffffff", "#f2f7fb", "#0f1c2e", "#4d5f75"], ["#0e7c86", "#ffd166", "#ffffff", "#f0f8f8", "#102a2c", "#4b6567"], ["#3949ab", "#80deea", "#fbfcff", "#eef1fb", "#141a33", "#56607d"]],
  clinica: [["#0f6b7a", "#7fe3a8", "#ffffff", "#f1f8f8", "#0f2326", "#4c6466"], ["#2b4c7e", "#9ad1f5", "#fbfdff", "#eef4fb", "#13203a", "#55637a"], ["#5b4b8a", "#f2c6de", "#fdfbff", "#f2eef8", "#1f1a33", "#655e7a"]],
  academia: [["#c2410c", "#facc15", "#0a0a0b", "#141416", "#fafaf9", "#a8a29e"], ["#15803d", "#a3e635", "#0a0f0b", "#121a14", "#f0fdf4", "#9fb3a5"], ["#1d4ed8", "#f43f5e", "#0b0d14", "#141826", "#f1f5f9", "#94a3b8"], ["#7c3aed", "#22d3ee", "#0c0a14", "#16121f", "#f5f3ff", "#a5a0b8"]],
  oficina: [["#1d4ed8", "#f59e0b", "#0d1117", "#151b24", "#eef2f7", "#93a1b5"], ["#b91c1c", "#fbbf24", "#111111", "#1b1b1b", "#f5f5f5", "#a3a3a3"], ["#334155", "#f97316", "#0f1115", "#181c23", "#f1f5f9", "#9aa4b2"], ["#0f766e", "#facc15", "#0b1211", "#141d1c", "#ecfdf5", "#93aca8"]],
  roupas: [["#1c1917", "#e9c7a5", "#faf7f2", "#f1ebe2", "#1c1917", "#6b625a"], ["#7c2d12", "#fde68a", "#fffbf5", "#f7efe3", "#26170c", "#7a6656"], ["#0f172a", "#f9a8d4", "#ffffff", "#f4f4f5", "#0f172a", "#5b6474"], ["#365314", "#fcd34d", "#fbfaf4", "#f0efe3", "#1d2410", "#6a6f58"]],
  imobiliaria: [["#13315c", "#f2c14e", "#ffffff", "#f3f6fa", "#0f1b2d", "#51607a"], ["#1f2937", "#c8a165", "#fafaf9", "#f1efea", "#111827", "#5f5a52"], ["#14532d", "#d9b26a", "#fbfdfb", "#eef4ef", "#10231a", "#55675c"]],
  servicos: [["#1d4ed8", "#38d9f5", "#ffffff", "#f4f6fa", "#101828", "#526075"], ["#0f172a", "#fbbf24", "#ffffff", "#f5f5f4", "#0f172a", "#57534e"], ["#0f766e", "#fca5a5", "#fdfefe", "#eff7f6", "#10201e", "#55696a"], ["#6d28d9", "#fde047", "#fcfbff", "#f2effa", "#1c1530", "#625c78"]],
  petshop: [["#0f766e", "#fbbf24", "#ffffff", "#f3f8f7", "#0f1f1d", "#4f6663"], ["#c2410c", "#7dd3fc", "#fffaf6", "#f8eee6", "#2a170b", "#7b6352"], ["#7c3aed", "#fcd34d", "#fdfcff", "#f3effb", "#1d1530", "#615a77"], ["#be185d", "#a7f3d0", "#fffafc", "#f8eef3", "#2b1020", "#7a5c6a"]],
  padaria: [["#7c3f12", "#f2b25c", "#fbf6ee", "#f3e9da", "#2b1d12", "#7a6450"], ["#9f1239", "#fcd9a8", "#fffaf5", "#f8ede4", "#2b0f17", "#7b5a60"], ["#3f2a1d", "#e6b673", "#16110d", "#211913", "#f5ece0", "#bba78f"], ["#14532d", "#f6c177", "#fbf8f1", "#f0ebdd", "#14231a", "#62705f"]],
  construcao: [["#a16207", "#facc15", "#101010", "#191919", "#f2f2ef", "#a3a39a"], ["#1e3a8a", "#f97316", "#0e1117", "#171b24", "#eef2f7", "#94a0b4"], ["#3f3f46", "#eab308", "#fafaf9", "#f0efec", "#18181b", "#5f5f66"], ["#9a3412", "#fde68a", "#14100d", "#1e1814", "#f6efe6", "#b3a594"]],
};

const LAYOUTS: Record<Segment["template"], Partial<Record<keyof Layout, Layout[keyof Layout][]>>> = {
  restaurant: { hero: ["full", "split", "frame"], services: ["cards", "rows"], about: ["right", "left", "stack"], headings: ["left", "center"], texture: ["grain", "none", "dots"] },
  barber: { hero: ["full", "split", "frame", "center"], services: ["list", "rows", "cards"], about: ["left", "right"], headings: ["left", "center"], texture: ["grain", "lines", "none"] },
  clinic: { hero: ["split", "center", "full"], services: ["cards", "rows", "list"], about: ["right", "left", "stack"], headings: ["center", "left"], texture: ["none", "dots"] },
  mechanic: { hero: ["full", "split", "frame"], services: ["cards", "list", "rows"], about: ["left", "right"], headings: ["left"], texture: ["lines", "none", "grain"] },
  store: { hero: ["frame", "split", "full", "center"], services: ["cards", "rows"], about: ["stack", "right", "left"], headings: ["center", "left"], texture: ["none", "grain"] },
  services: { hero: ["split", "full", "center", "frame"], services: ["cards", "rows", "list"], about: ["right", "left", "stack"], headings: ["left", "center"], texture: ["none", "dots", "lines"] },
};

const isHex = (c?: string | null) => !!c && /^#[0-9a-fA-F]{6}$/.test(c);

export type DesignInput = {
  key: string; // identificador estável da empresa (id ou nome + cidade)
  brandColors?: string[]; // cores encontradas nos canais oficiais (hex)
  preferFonts?: { heading?: Font; body?: Font };
};

export function designFor(segment: Segment, input: DesignInput): { theme: Theme; layout: Layout } {
  const seed = seedFrom(`${segment.key}:${input.key}`);
  const palettes = PALETTES[segment.key] ?? [[segment.theme.primary, segment.theme.accent, segment.theme.background, segment.theme.surface, segment.theme.text, segment.theme.muted] as [string, string, string, string, string, string]];
  let [primary, accent, background, surface, text, muted] = pick(palettes, seed, 1);
  // Cores da marca encontradas na pesquisa têm prioridade (com contraste garantido).
  const brand = (input.brandColors ?? []).filter(isHex);
  if (brand[0]) {
    primary = brand[0];
    if (brand[1] && contrast(brand[1], brand[0]) > 1.6) accent = brand[1];
    else if (contrast(accent, primary) < 1.6) accent = isDark(primary) ? mix(primary, "#ffffff", 0.7) : mix(primary, "#000000", 0.5);
  }
  muted = readable(muted, background, 4.5);
  const style = segment.style;
  const [hf, bf] = pick(FONT_PAIRS[style], seed, 3);
  const L = LAYOUTS[segment.template];
  const layout: Layout = {
    hero: pick((L.hero ?? ["full"]) as Layout["hero"][], seed, 5),
    services: pick((L.services ?? ["cards"]) as Layout["services"][], seed, 7),
    about: pick((L.about ?? ["right"]) as Layout["about"][], seed, 11),
    headings: pick((L.headings ?? ["left"]) as Layout["headings"][], seed, 13),
    texture: pick((L.texture ?? ["none"]) as Layout["texture"][], seed, 17),
  };
  const radius = pick(["none", "md", "lg"] as const, seed, 19);
  return {
    theme: {
      primary,
      accent,
      background,
      surface,
      text,
      muted,
      headingFont: input.preferFonts?.heading ?? hf,
      bodyFont: input.preferFonts?.body ?? bf,
      radius: style === "bold" || style === "industrial" ? (radius === "lg" ? "md" : radius) : radius,
    },
    layout,
  };
}
