// Utilitários de segurança e formatação compartilhados pelo renderizador.

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Aceita somente http(s), mailto, tel e âncoras internas; qualquer outra coisa vira "#". */
export function safeUrl(u: string | undefined | null): string {
  const v = (u ?? "").trim();
  if (!v) return "#";
  if (v.startsWith("#")) return "#" + v.slice(1).replace(/[^a-zA-Z0-9_-]/g, "");
  try {
    const parsed = new URL(v);
    if (["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) return parsed.toString();
  } catch {
    /* inválida */
  }
  return "#";
}

export const digits = (s: string) => s.replace(/\D/g, "");

export function waNumber(phone: string): string | null {
  let d = digits(phone);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^\d{12,13}$/.test(d) ? d : null;
}

export function telHref(phone: string): string | null {
  const d = digits(phone);
  if (d.length < 8) return null;
  return `tel:+${d.length <= 11 ? "55" + d : d}`;
}

export function paras(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export type ImageSources = { src: string; srcset: string; avif: string; webp: string };

const isUnsplash = (u: URL) => u.hostname === "images.unsplash.com";
const isPlacePhoto = (u: URL) => /\/api\/place-photo\/[^/]+\/\d+$/.test(u.pathname);

function withParams(url: URL, params: Record<string, string>) {
  const u = new URL(url.toString());
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/**
 * Fontes responsivas de uma imagem:
 * - Unsplash: AVIF e WebP explícitos + JPEG, em várias larguras;
 * - fotos do Google (via /api/place-photo): larguras de 480, 960 e 1600 px;
 * - outras URLs: usadas como estão.
 */
export function imageSources(url: string, widths: number[], fallbackWidth: number): ImageSources {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { src: url, srcset: "", avif: "", webp: "" };
  }
  if (isUnsplash(u)) {
    const base = new URL(u.toString());
    base.searchParams.delete("fm");
    base.searchParams.delete("auto");
    const set = (extra: Record<string, string>) => widths.map((w) => `${withParams(base, { w: String(w), q: "72", fit: "crop", ...extra })} ${w}w`).join(", ");
    return { src: withParams(base, { w: String(fallbackWidth), q: "72", fit: "crop", auto: "format" }), srcset: set({ auto: "format" }), avif: set({ fm: "avif" }), webp: set({ fm: "webp" }) };
  }
  if (isPlacePhoto(u)) {
    const ws = [480, 960, 1600];
    return { src: withParams(u, { w: String(ws.find((w) => w >= fallbackWidth) ?? 1600) }), srcset: ws.map((w) => `${withParams(u, { w: String(w) })} ${w}w`).join(", "), avif: "", webp: "" };
  }
  return { src: url, srcset: "", avif: "", webp: "" };
}

/** Compatibilidade: URL única otimizada. */
export function optimizedImage(url: string, width: number): string {
  return imageSources(url, [width], width).src;
}
