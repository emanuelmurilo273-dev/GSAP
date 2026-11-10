import type { Candle } from './types';

const nan = (n: number) => new Array<number>(n).fill(NaN);

export function sma(v: number[], p: number): number[] {
  const out = nan(v.length);
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    s += v[i];
    if (i >= p) s -= v[i - p];
    if (i >= p - 1) out[i] = s / p;
  }
  return out;
}

export function ema(v: number[], p: number): number[] {
  const out = nan(v.length);
  if (v.length < p) return out;
  const k = 2 / (p + 1);
  let prev = 0;
  for (let i = 0; i < p; i++) prev += v[i];
  prev /= p;
  out[p - 1] = prev;
  for (let i = p; i < v.length; i++) {
    prev = v[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(c: number[], p = 14): number[] {
  const out = nan(c.length);
  if (c.length <= p) return out;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1];
    g += Math.max(d, 0);
    l += Math.max(-d, 0);
  }
  g /= p;
  l /= p;
  out[p] = 100 - 100 / (1 + g / (l || 1e-12));
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (p - 1) + Math.max(d, 0)) / p;
    l = (l * (p - 1) + Math.max(-d, 0)) / p;
    out[i] = 100 - 100 / (1 + g / (l || 1e-12));
  }
  return out;
}

export function macd(c: number[], fast = 12, slow = 26, sig = 9) {
  const ef = ema(c, fast);
  const es = ema(c, slow);
  const line = c.map((_, i) => ef[i] - es[i]);
  const first = line.findIndex((x) => !Number.isNaN(x));
  const signal = nan(c.length);
  if (first >= 0) {
    const s = ema(line.slice(first), sig);
    s.forEach((x, j) => (signal[first + j] = x));
  }
  const hist = line.map((x, i) => x - signal[i]);
  return { line, signal, hist };
}

/** ATR de Wilder (em preço). */
export function atr(c: Candle[], p = 14): number[] {
  const out = nan(c.length);
  if (c.length <= p) return out;
  const tr = c.map((k, i) =>
    i === 0 ? k.h - k.l : Math.max(k.h - k.l, Math.abs(k.h - c[i - 1].c), Math.abs(k.l - c[i - 1].c)),
  );
  let prev = 0;
  for (let i = 1; i <= p; i++) prev += tr[i];
  prev /= p;
  out[p] = prev;
  for (let i = p + 1; i < c.length; i++) {
    prev = (prev * (p - 1) + tr[i]) / p;
    out[i] = prev;
  }
  return out;
}

/** ADX de Wilder (força da tendência, 0–100). Abaixo de ~20 o mercado está lateral. Os primeiros 2×p valores são pouco confiáveis. */
export function adx(c: Candle[], p = 14): number[] {
  const n = c.length; if (n < 2) return new Array(n).fill(0);
  const tr: number[] = [0], pdm: number[] = [0], mdm: number[] = [0];
  for (let i = 1; i < n; i++) {
    const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
    pdm.push(up > dn && up > 0 ? up : 0); mdm.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)));
  }
  const wilder = (v: number[]) => { const o: number[] = new Array(n).fill(0); let s = 0; for (let i = 1; i <= p && i < n; i++) s += v[i]; if (n > p) o[p] = s; for (let i = p + 1; i < n; i++) o[i] = o[i - 1] - o[i - 1] / p + v[i]; return o; };
  const atr = wilder(tr), P = wilder(pdm), M = wilder(mdm), dx = new Array(n).fill(0);
  for (let i = p; i < n; i++) { const pi = atr[i] ? (100 * P[i]) / atr[i] : 0, mi = atr[i] ? (100 * M[i]) / atr[i] : 0; dx[i] = pi + mi ? (100 * Math.abs(pi - mi)) / (pi + mi) : 0; }
  const out = new Array(n).fill(0); let s = 0; for (let i = p; i < 2 * p && i < n; i++) s += dx[i]; if (n > 2 * p) out[2 * p - 1] = s / p;
  for (let i = 2 * p; i < n; i++) out[i] = (out[i - 1] * (p - 1) + dx[i]) / p;
  return out;
}
