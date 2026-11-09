import { fetchRecent, type Candle, type Ex, type Timeframe } from '@desk/core';

/** 1 · SCOUT — coleta candles fechados dos pares configurados. */
export async function scout(ex: Ex, symbols: string[], tf: Timeframe) {
  const out = new Map<string, Candle[]>();
  const errors: string[] = [];
  for (const s of symbols) {
    try {
      const c = await fetchRecent(ex, s, tf, 200);
      if (c.length >= 100) out.set(s, c);
      else errors.push(`${s}: histórico insuficiente (${c.length})`);
    } catch (e: any) {
      errors.push(`${s}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  return { candles: out, errors };
}
