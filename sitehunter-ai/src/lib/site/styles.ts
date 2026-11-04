// Direções visuais dos sites gerados. Cada direção muda a estrutura da capa,
// a composição das seções, a tipografia, a paleta de base e o desenho dos
// botões, não só cor e logo. O segmento sugere uma direção; o usuário troca no editor.

export const SITE_STYLES = ["atelier", "forge", "clinic", "hearth", "studio"] as const;
export type SiteStyle = (typeof SITE_STYLES)[number];

export type StyleInfo = {
  label: string;
  description: string;
  uses3d: boolean;
  heading: string;
  body: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  radius: "none" | "md" | "lg";
};

export const STYLE_INFO: Record<SiteStyle, StyleInfo> = {
  atelier: {
    label: "Ateliê editorial",
    description: "Serifa elegante, muito respiro e imagem em moldura de arco. Sóbrio, sem 3D. Para beleza, moda e estética.",
    uses3d: false, heading: "DM Serif Display", body: "Lato",
    background: "#fbf8f6", surface: "#f2ebe7", text: "#1f1a17", muted: "#6b5f58", radius: "none",
  },
  forge: {
    label: "Oficina em alto contraste",
    description: "Tipografia condensada, fundo escuro, faixa diagonal e cartões com profundidade 3D. Para barbearias, oficinas, academias e obras.",
    uses3d: true, heading: "Bebas Neue", body: "Archivo",
    background: "#0f0f10", surface: "#18181b", text: "#f4f4f5", muted: "#a1a1aa", radius: "none",
  },
  clinic: {
    label: "Clínica serena",
    description: "Linhas limpas, cantos suaves e contatos confirmados logo na capa. Sóbrio, sem 3D. Para saúde e serviços que pedem confiança.",
    uses3d: false, heading: "Manrope", body: "Manrope",
    background: "#ffffff", surface: "#f2f6f9", text: "#0f1b2d", muted: "#4d5c74", radius: "lg",
  },
  hearth: {
    label: "Casa artesanal",
    description: "Serifa calorosa, formas orgânicas e cardápio em destaque. Para restaurantes, padarias e cafés.",
    uses3d: false, heading: "Fraunces", body: "Nunito",
    background: "#fdf9f3", surface: "#f4eadb", text: "#2a1c12", muted: "#6c5643", radius: "lg",
  },
  studio: {
    label: "Estúdio contemporâneo",
    description: "Grade em blocos, geometria precisa e uma composição 3D discreta na capa. Para serviços, imobiliárias e pet shops.",
    uses3d: true, heading: "Archivo", body: "Manrope",
    background: "#f6f7fb", surface: "#ffffff", text: "#0b1220", muted: "#536074", radius: "md",
  },
};

const BY_SEGMENT: Record<string, SiteStyle> = {
  barbearia: "forge", oficina: "forge", academia: "forge", construcao: "forge",
  salao: "atelier", roupas: "atelier",
  odontologia: "clinic", clinica: "clinic",
  restaurante: "hearth", padaria: "hearth",
  imobiliaria: "studio", servicos: "studio", petshop: "studio",
};

export function styleForSegment(segmentKey: string): SiteStyle {
  return BY_SEGMENT[segmentKey] ?? "studio";
}

// ---------- cor ----------
function rgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "777777";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function toHex([r, g, b]: number[]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v!))).toString(16).padStart(2, "0")).join("");
}
export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
export function mix(a: string, b: string, t: number) {
  const A = rgb(a), B = rgb(b);
  return toHex(A.map((v, i) => v + (B[i]! - v) * t));
}
/** Texto legível sobre uma cor de fundo (preto quase puro ou branco). */
export function onColor(bg: string) {
  return contrast(bg, "#ffffff") >= contrast(bg, "#141414") ? "#ffffff" : "#141414";
}
/** Ajusta uma cor de destaque até ter contraste mínimo sobre o fundo (para textos e links). */
export function readableOn(color: string, bg: string, min = 4.5) {
  if (contrast(color, bg) >= min) return color;
  const target = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.1; t <= 1; t += 0.1) {
    const c = mix(color, target, t);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

// Google Fonts falha a requisição inteira se pedirmos um peso inexistente.
const WEIGHTS: Record<string, string> = {
  "Bebas Neue": "", "DM Serif Display": ":ital@0;1", Lato: ":wght@400;700", Merriweather: ":wght@400;700",
  Fraunces: ":ital,wght@0,400;0,600;0,700;1,400;1,600", Oswald: ":wght@400;500;600;700",
};
export function googleFontsHref(families: string[]) {
  const q = [...new Set(families)].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}${WEIGHTS[f] ?? ":wght@400;600;700"}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}
