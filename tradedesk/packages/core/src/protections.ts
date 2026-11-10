/** Proteções do robô de cripto (puras e testadas). Valem acima de qualquer configuração do cliente. */
export const CRYPTO_MAX_RISK_PCT = 0.01;       // no máximo 1% do patrimônio arriscado por operação (distância até o stop × tamanho)
export const MAX_LOSSES_IN_ROW = 1;            // EMERGÊNCIA: perfil inicial para o dia após 1 perda
export const PEAK_DROP_LIMIT = 0.05;           // conta 5% abaixo do pico → robô pausa
export const MAX_TRADES_PER_DAY_DEFAULT = 3;   // EMERGÊNCIA: no máximo 3 operações por dia
export const MIN_RR = 2;                       // risco/retorno mínimo 1:2
export const ADX_MIN = 20;                     // abaixo disso o mercado está lateral: não opera
export const STOP_ATR_MULT = 1.5, STOP_MIN = 0.01, STOP_MAX = 0.06;

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

/** Stop TÉCNICO por ATR (1,5×ATR, entre 1% e 6%) e alvo = RR × stop (mínimo 1:2). Substitui o stop/alvo fixos do cliente. */
export function atrRules(atrPct: number, rr = MIN_RR) {
  const stopPct = Math.min(STOP_MAX, Math.max(STOP_MIN, STOP_ATR_MULT * (atrPct > 0 ? atrPct : STOP_MIN)));
  return { stopPct, targetPct: stopPct * Math.max(rr, MIN_RR) };
}
