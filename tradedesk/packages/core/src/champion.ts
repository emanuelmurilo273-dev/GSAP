/**
 * Comparação campeão x desafiante (pura e testada). Ambos são medidos NA MESMA SIMULAÇÃO-SOMBRA, com os mesmos custos
 * (emolumentos + 1 tick de slippage já embutidos no pnl). Só o dono promove, com um clique, e o servidor RECUSA se não passar.
 */
export interface ShadowTrade { day: string; pnl: number }
export interface Metrics { trades: number; sessions: number; pnl: number; profitFactor: number | null; maxDrawdown: number; sharpe: number }

export const MIN_SESSIONS = 10;   // pregões em paralelo
export const MIN_TRADES = 30;     // com menos que isso a diferença é ruído

export function metricsOf(trades: ShadowTrade[]): Metrics {
  const byDay = new Map<string, number>();
  let gw = 0, gl = 0, eq = 0, peak = 0, dd = 0;
  for (const t of trades) {
    byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.pnl);
    if (t.pnl > 0) gw += t.pnl; else gl += -t.pnl;
    eq += t.pnl; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
  }
  const d = [...byDay.values()];
  const mean = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
  const sd = d.length > 1 ? Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (d.length - 1)) : 0;
  return { trades: trades.length, sessions: byDay.size, pnl: eq, profitFactor: gl > 0 ? gw / gl : gw > 0 ? Infinity : null, maxDrawdown: dd, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(252) : 0 };
}

export function compare(champion: ShadowTrade[], challenger: ShadowTrade[]) {
  const a = metricsOf(champion), b = metricsOf(challenger);
  const reasons: string[] = [];
  if (b.sessions < MIN_SESSIONS) reasons.push(`só ${b.sessions} de ${MIN_SESSIONS} pregões em paralelo`);
  if (b.trades < MIN_TRADES) reasons.push(`só ${b.trades} de ${MIN_TRADES} operações (pouco para concluir algo)`);
  if (!((b.profitFactor ?? 0) > (a.profitFactor ?? 0))) reasons.push('fator de lucro não é melhor que o do campeão');
  if (!(b.maxDrawdown <= a.maxDrawdown)) reasons.push('drawdown é pior que o do campeão');
  if (!(b.sharpe > a.sharpe)) reasons.push('Sharpe não é melhor que o do campeão');
  if (!(b.pnl > 0)) reasons.push('resultado total não é positivo');
  return { champion: a, challenger: b, canPromote: reasons.length === 0, reasons };
}
