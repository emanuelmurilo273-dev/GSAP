// Cálculos de cor feitos no servidor (sem color-mix, para funcionar em navegadores mais antigos)
// e garantia de contraste mínimo de texto (WCAG).

type RGB = [number, number, number];

export function toRgb(hex: string): RGB {
  const n = parseInt((/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000").slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbStr = (hex: string) => toRgb(hex).join(",");
const toHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** Mistura `a` com `b`; `t` = peso de `b` (0..1). */
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a), y = toRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function luminance(hex: string): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Cor de texto (preto ou branco) com melhor contraste sobre `bg`. */
export function onColor(bg: string): string {
  return contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111";
}

/** Usa `fg` se tiver contraste suficiente com `bg`; senão escurece/clareia até atingir. */
export function readable(fg: string, bg: string, min = 4.5): string {
  if (contrast(fg, bg) >= min) return fg;
  const target = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.1; t <= 1; t += 0.1) {
    const c = mix(fg, target, t);
    if (contrast(c, bg) >= min) return c;
  }
  return target === "#000000" ? "#111111" : "#ffffff";
}

export const isDark = (hex: string) => luminance(hex) < 0.2;
