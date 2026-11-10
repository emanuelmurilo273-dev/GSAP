/** Proteções do robô de cripto (puras e testadas). Valem acima de qualquer configuração do cliente. */
export const CRYPTO_MAX_RISK_PCT = 0.01;       // no máximo 1% do patrimônio arriscado por operação (distância até o stop × tamanho)
export const MAX_LOSSES_IN_ROW = 2;            // parada do dia após 2 perdas seguidas
export const PEAK_DROP_LIMIT = 0.10;           // conta 10% abaixo do pico → robô pausa
export const MAX_TRADES_PER_DAY_DEFAULT = 6;

/** Tamanho da posição em R$: o menor entre % do patrimônio, o saldo livre e o que mantém a perda no stop ≤ 1% do patrimônio. Sem alavancagem (nunca passa do saldo livre). */
export function cappedPositionSize(equity: number, free: number, positionPct: number, stopPct: number, maxRisk = CRYPTO_MAX_RISK_PCT): number {
  if (!(equity > 0) || !(stopPct > 0)) return 0;
  return Math.max(0, Math.min(equity * positionPct, free * 0.99, (equity * maxRisk) / stopPct));
}

/** Perdas seguidas contando do trade mais recente para trás (pnls em ordem cronológica). */
export function lossStreak(pnls: number[]): number {
  let n = 0;
  for (let i = pnls.length - 1; i >= 0 && pnls[i] < 0; i--) n++;
  return n;
}

/** Maior patrimônio visto e se a queda desde o pico passou do limite. */
export function peakCheck(peak: number | null | undefined, equity: number, limit = PEAK_DROP_LIMIT): { peak: number; breached: boolean; dropPct: number } {
  const p = Math.max(peak && peak > 0 ? peak : 0, equity);
  const dropPct = p > 0 ? (p - equity) / p : 0;
  return { peak: p, breached: p > 0 && dropPct >= limit, dropPct };
}
