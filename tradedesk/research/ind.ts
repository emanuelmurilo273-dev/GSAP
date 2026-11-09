import { atr, ema, rsi, sma } from '../packages/core/src/indicators';
import type { Candle } from '../packages/core/src/types';
export { atr, ema, rsi, sma };

const nan = (n: number) => new Array<number>(n).fill(NaN);

/** ADX de Wilder (14). */
export function adx(c: Candle[], p = 14): number[] {
  const n = c.length;
  const out = nan(n);
  if (n < p * 2 + 1) return out;
  const tr: number[] = [0], pdm: number[] = [0], mdm: number[] = [0];
  for (let i = 1; i < n; i++) {
    const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
    pdm.push(up > dn && up > 0 ? up : 0);
    mdm.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)));
  }
  let sTr = 0, sP = 0, sM = 0;
  for (let i = 1; i <= p; i++) { sTr += tr[i]; sP += pdm[i]; sM += mdm[i]; }
  const dx: number[] = nan(n);
  const calc = (i: number) => {
    const pdi = (100 * sP) / sTr, mdi = (100 * sM) / sTr;
    dx[i] = (100 * Math.abs(pdi - mdi)) / ((pdi + mdi) || 1e-12);
  };
  calc(p);
  for (let i = p + 1; i < n; i++) {
    sTr = sTr - sTr / p + tr[i]; sP = sP - sP / p + pdm[i]; sM = sM - sM / p + mdm[i];
    calc(i);
  }
  let a = 0;
  for (let i = p; i < p * 2; i++) a += dx[i];
  a /= p;
  out[p * 2 - 1] = a;
  for (let i = p * 2; i < n; i++) { a = (a * (p - 1) + dx[i]) / p; out[i] = a; }
  return out;
}

export function stdev(v: number[], p: number): number[] {
  const out = nan(v.length);
  for (let i = p - 1; i < v.length; i++) {
    let m = 0; for (let j = i - p + 1; j <= i; j++) m += v[j]; m /= p;
    let s = 0; for (let j = i - p + 1; j <= i; j++) s += (v[j] - m) ** 2;
    out[i] = Math.sqrt(s / p);
  }
  return out;
}

export function bollinger(close: number[], p = 20, k = 2) {
  const mid = sma(close, p), sd = stdev(close, p);
  return { mid, lower: mid.map((m, i) => m - k * sd[i]), upper: mid.map((m, i) => m + k * sd[i]) };
}

/** máxima / mínima das N barras ANTERIORES (exclui a barra atual → sem olhar o futuro). */
export function rollMax(v: number[], n: number): number[] {
  const out = nan(v.length);
  for (let i = n; i < v.length; i++) { let m = -Infinity; for (let j = i - n; j < i; j++) if (v[j] > m) m = v[j]; out[i] = m; }
  return out;
}
export function rollMin(v: number[], n: number): number[] {
  const out = nan(v.length);
  for (let i = n; i < v.length; i++) { let m = Infinity; for (let j = i - n; j < i; j++) if (v[j] < m) m = v[j]; out[i] = m; }
  return out;
}
export function roc(close: number[], n: number): number[] {
  return close.map((x, i) => (i >= n ? x / close[i - n] - 1 : NaN));
}
