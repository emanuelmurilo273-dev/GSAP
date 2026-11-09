import type { Ex, Quote, Series, StrategyParams } from '@desk/core';

const MIN_VOL: Record<Quote, number> = {
  USDT: Number(process.env.MIN_QUOTE_VOLUME_USDT ?? 5_000_000),
  BRL: Number(process.env.MIN_QUOTE_VOLUME_BRL ?? 1_000_000),
};
const MAX_SPREAD = Number(process.env.MAX_SPREAD ?? 0.002);

/** 2 · FILTER — descarta pares com pouca liquidez, spread alto ou volatilidade extrema. */
export async function filterPair(
  ex: Ex, symbol: string, quote: Quote, series: Series, i: number, p: StrategyParams,
): Promise<{ pass: true } | { pass: false; reason: string }> {
  const t = await ex.fetchTicker(symbol);
  const vol = t.quoteVolume ?? 0;
  if (vol < MIN_VOL[quote]) return { pass: false, reason: `liquidez baixa: volume 24h ${vol.toFixed(0)} ${quote} < ${MIN_VOL[quote]}` };
  if (t.bid && t.ask) {
    const spread = (t.ask - t.bid) / ((t.ask + t.bid) / 2);
    if (spread > MAX_SPREAD) return { pass: false, reason: `spread alto: ${(spread * 100).toFixed(2)}% > ${(MAX_SPREAD * 100).toFixed(2)}%` };
  }
  const v = series.atrPct[i];
  if (v > p.maxVolPct) return { pass: false, reason: `volatilidade extrema: ATR ${(v * 100).toFixed(2)}% > ${(p.maxVolPct * 100).toFixed(2)}%` };
  return { pass: true };
}
