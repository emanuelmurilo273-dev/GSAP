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

/** URLs de imagem otimizadas (tamanho, qualidade e formato) quando o banco de imagens permite. */
export function optimizedImage(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "75");
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
  } catch {
    /* mantém */
  }
  return url;
}

export function srcset(url: string, widths: number[]): string {
  try {
    if (new URL(url).hostname !== "images.unsplash.com") return "";
  } catch {
    return "";
  }
  return widths.map((w) => `${optimizedImage(url, w)} ${w}w`).join(", ");
}
