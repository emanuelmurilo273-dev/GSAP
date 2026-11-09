import { atr, ema, macd, rsi, sma } from './indicators';
import type { Candle, StrategyParams } from './types';

export const WARMUP = 60;
const SR_WINDOW = 48;

export interface Series {
  ema9: number[];
  ema21: number[];
  rsi: number[];
  macdHist: number[];
  volRatio: number[];
  atrPct: number[];
  resistance: number[];
  support: number[];
}

export function buildSeries(c: Candle[]): Series {
  const close = c.map((k) => k.c);
  const vol = c.map((k) => k.v);
  const volSma = sma(vol, 20);
  const a = atr(c, 14);
  const resistance = new Array<number>(c.length).fill(NaN);
  const support = new Array<number>(c.length).fill(NaN);
  for (let i = SR_WINDOW; i < c.length; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - SR_WINDOW; j < i; j++) {
      if (c[j].h > hi) hi = c[j].h;
      if (c[j].l < lo) lo = c[j].l;
    }
    resistance[i] = hi;
    support[i] = lo;
  }
  return {
    ema9: ema(close, 9),
    ema21: ema(close, 21),
    rsi: rsi(close, 14),
    macdHist: macd(close).hist,
    volRatio: vol.map((v, i) => v / volSma[i]),
    atrPct: a.map((x, i) => x / close[i]),
    resistance,
    support,
  };
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export interface Score {
  score: number;
  parts: { trend: number; momentum: number; macd: number; volume: number; levels: number };
  snapshot: {
    close: number;
    ema9: number;
    ema21: number;
    rsi: number;
    macdHist: number;
    volRatio: number;
    atrPct: number;
    resistance: number;
    support: number;
  };
}

/**
 * Nota técnica de 0 a 1 (determinística — é a mesma usada no backtest e ao vivo).
 * Pesos: tendência 30% · RSI 20% · MACD 20% · volume 15% · suporte/resistência 15%.
 */
export function scoreAt(
  s: Series,
  c: Candle[],
  i: number,
  p: Pick<StrategyParams, 'stopPct' | 'targetPct'>,
): Score | null {
  if (i < WARMUP) return null;
  const close = c[i].c;
  const v = {
    ema9: s.ema9[i],
    ema21: s.ema21[i],
    ema21Prev: s.ema21[i - 3],
    rsi: s.rsi[i],
    rsiPrev: s.rsi[i - 1],
    hist: s.macdHist[i],
    histPrev: s.macdHist[i - 1],
    vol: s.volRatio[i],
    res: s.resistance[i],
    sup: s.support[i],
  };
  if (Object.values(v).some((x) => Number.isNaN(x) || !Number.isFinite(x))) return null;

  let trend = 0;
  if (v.ema9 > v.ema21) trend = v.ema21 > v.ema21Prev ? 1 : 0.5;
  if (close < v.ema21) trend *= 0.5;

  let momentum = 0;
  if (v.rsi >= 45 && v.rsi <= 68) momentum = 1;
  else if (v.rsi > 68 && v.rsi <= 78) momentum = 0.4;
  else if (v.rsi >= 35 && v.rsi < 45 && v.rsi > v.rsiPrev) momentum = 0.5;

  let m = 0;
  if (v.hist > 0 && v.hist > v.histPrev) m = 1;
  else if (v.hist > 0) m = 0.6;
  else if (v.hist > v.histPrev) m = 0.3;

  const volume = clamp(v.vol / 1.5);

  const room = (v.res - close) / close; // espaço até a resistência
  const distSup = Math.max(0, (close - v.sup) / close);
  const levels = 0.6 * clamp(room / p.targetPct) + 0.4 * (1 - clamp(distSup / (3 * p.stopPct)));

  const parts = { trend, momentum, macd: m, volume, levels };
  const score = 0.3 * trend + 0.2 * momentum + 0.2 * m + 0.15 * volume + 0.15 * levels;
  return {
    score: Math.round(score * 1000) / 1000,
    parts,
    snapshot: {
      close,
      ema9: v.ema9,
      ema21: v.ema21,
      rsi: v.rsi,
      macdHist: v.hist,
      volRatio: v.vol,
      atrPct: s.atrPct[i],
      resistance: v.res,
      support: v.sup,
    },
  };
}
