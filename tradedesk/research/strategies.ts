import type { Candle } from '../packages/core/src/types';
import { adx, atr, bollinger, ema, rollMax, rollMin, roc, rsi, sma } from './ind';
import type { Signals } from './engine';

export type Params = Record<string, number>;
export interface Family {
  id: string;
  name: string;
  grid: Params[];
  build: (c: Candle[], p: Params) => Signals;
}

const cross = (a: boolean[]) => a.map((v, i) => v && !(a[i - 1] ?? false)); // sinal só no instante em que vira verdadeiro
const gt = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a > b;
const lt = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a < b;
const product = (axes: Record<string, number[]>): Params[] =>
  Object.entries(axes).reduce<Params[]>((acc, [k, vs]) => acc.flatMap((p) => vs.map((v) => ({ ...p, [k]: v }))), [{}]);
const constant = <T>(n: number, v: T) => new Array<T>(n).fill(v);

// cache de indicadores por série (a mesma série é reutilizada em milhares de simulações)
const cache = new WeakMap<Candle[], Map<string, any>>();
function memo<T>(c: Candle[], key: string, f: () => T): T {
  let m = cache.get(c);
  if (!m) cache.set(c, (m = new Map()));
  if (!m.has(key)) m.set(key, f());
  return m.get(key);
}
const closes = (c: Candle[]) => memo(c, 'close', () => c.map((k) => k.c));
const highs = (c: Candle[]) => memo(c, 'high', () => c.map((k) => k.h));
const lows = (c: Candle[]) => memo(c, 'low', () => c.map((k) => k.l));

/** 1 · Tendência: cruzamento de EMAs + filtro ADX */
const trend: Family = {
  id: 'trend', name: 'Tendência (EMA cross + ADX)',
  grid: product({ fast: [9, 12, 20], slow: [26, 50], adxMin: [20, 25], stop: [0.04, 0.08] }),
  build: (c, p) => {
    const f = memo(c, `ema${p.fast}`, () => ema(closes(c), p.fast));
    const s = memo(c, `ema${p.slow}`, () => ema(closes(c), p.slow));
    const a = memo(c, 'adx14', () => adx(c, 14));
    const up = c.map((_, i) => gt(f[i], s[i]));
    return {
      entry: cross(c.map((_, i) => up[i] && a[i] >= p.adxMin)),
      exit: c.map((_, i) => lt(f[i], s[i])),
      stopDist: constant(c.length, p.stop),
    };
  },
};

/** 2 · Rompimento: Donchian */
const breakout: Family = {
  id: 'breakout', name: 'Rompimento (Donchian)',
  grid: product({ nIn: [20, 40, 80], nOut: [10, 20], stop: [0.04, 0.08] }),
  build: (c, p) => {
    const hi = memo(c, `hi${p.nIn}`, () => rollMax(highs(c), p.nIn));
    const lo = memo(c, `lo${p.nOut}`, () => rollMin(lows(c), p.nOut));
    const cl = closes(c);
    return {
      entry: c.map((_, i) => gt(cl[i], hi[i])),
      exit: c.map((_, i) => lt(cl[i], lo[i])),
      stopDist: constant(c.length, p.stop),
    };
  },
};

/** 3 · Reversão à média: RSI + Bollinger */
const meanrev: Family = {
  id: 'meanrev', name: 'Reversão à média (RSI + Bollinger)',
  grid: product({ rsiMax: [25, 30, 35], k: [2, 2.5], stop: [0.03, 0.06] }),
  build: (c, p) => {
    const r = memo(c, 'rsi14', () => rsi(closes(c), 14));
    const bb = memo(c, `bb20_${p.k}`, () => bollinger(closes(c), 20, p.k));
    const cl = closes(c);
    return {
      entry: c.map((_, i) => lt(r[i], p.rsiMax) && lt(cl[i], bb.lower[i])),
      exit: c.map((_, i) => gt(cl[i], bb.mid[i]) || gt(r[i], 55)),
      stopDist: constant(c.length, p.stop),
      maxHold: 48,
    };
  },
};

/** 4 · Momentum com filtro de regime (só opera acima da média de 200) */
const momentum: Family = {
  id: 'momentum', name: 'Momentum + regime (SMA200)',
  grid: product({ look: [10, 20, 40], thr: [0, 0.03], stop: [0.04, 0.08] }),
  build: (c, p) => {
    const cl = closes(c);
    const m200 = memo(c, 'sma200', () => sma(cl, 200));
    const r = memo(c, `roc${p.look}`, () => roc(cl, p.look));
    const regime = c.map((_, i) => gt(cl[i], m200[i]));
    return {
      entry: cross(c.map((_, i) => regime[i] && gt(r[i], p.thr))),
      exit: c.map((_, i) => !regime[i] || lt(r[i], 0)),
      stopDist: constant(c.length, p.stop),
    };
  },
};

/** 5 · Combinação com volatilidade: rompimento + regime, stop e tamanho por ATR, saída chandelier */
const atrCombo: Family = {
  id: 'atrcombo', name: 'Rompimento + regime + ATR (stop e tamanho)',
  grid: product({ nIn: [20, 55], kStop: [2, 3], mTrail: [3, 4] }),
  build: (c, p) => {
    const cl = closes(c);
    const a = memo(c, 'atr14', () => atr(c, 14));
    const m200 = memo(c, 'sma200', () => sma(cl, 200));
    const hi = memo(c, `hi${p.nIn}`, () => rollMax(highs(c), p.nIn));
    const RISK = 0.01; // arrisca 1% do capital por trade
    const stopDist = c.map((_, i) => (Number.isNaN(a[i]) ? null : (p.kStop * a[i]) / cl[i]));
    return {
      entry: c.map((_, i) => gt(cl[i], hi[i]) && gt(cl[i], m200[i]) && !Number.isNaN(a[i])),
      stopDist,
      size: c.map((_, i) => (stopDist[i] ? Math.min(1, RISK / stopDist[i]!) : 0)),
      trailAtr: { mult: p.mTrail, atr: a },
    };
  },
};

export const FAMILIES: Family[] = [trend, breakout, meanrev, momentum, atrCombo];
export const TIMEFRAMES = ['15m', '1h', '4h'] as const;
export const PAIRS = ((process.env.RESEARCH_PAIRS ?? 'BTCUSDT,ETHUSDT,SOLUSDT').split(',')) as unknown as readonly string[];   // Foxbit: RESEARCH_PAIRS=BTCBRL,ETHBRL,SOLBRL
