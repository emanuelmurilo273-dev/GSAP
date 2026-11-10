/** "Saúde do robô": expectativa por operação em R$ e semáforo. Puro e testado. Regra de ouro: sem prova estatística, NUNCA verde. */
export type Light = 'verde' | 'amarelo' | 'vermelho' | 'cinza';

export interface Health {
  n: number; wins: number; winRate: number; avgWin: number; avgLoss: number;
  expectancy: number;                 // R$ por operação = %acerto × ganho médio − %erro × perda média
  profitFactor: number | null; total: number; lastExpectancy: number | null;
  ci: [number, number] | null;        // intervalo de 95% da expectativa
  light: Light; headline: string; reasons: string[];
}

export const HEALTH_MIN_N = 20;       // abaixo disso: cinza (poucos dados)
export const HEALTH_PROVEN_N = 100;   // verde só com ≥100 operações e margem de erro toda acima de zero
const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);

export function healthOf(pnls: number[]): Health {
  const n = pnls.length;
  const w = pnls.filter((p) => p > 0), l = pnls.filter((p) => p < 0);
  const expectancy = mean(pnls);
  const winRate = n ? w.length / n : 0, avgWin = mean(w), avgLoss = -mean(l);
  const gl = -l.reduce((a, b) => a + b, 0), gw = w.reduce((a, b) => a + b, 0);
  const sd = n > 1 ? Math.sqrt(pnls.reduce((a, b) => a + (b - expectancy) ** 2, 0) / (n - 1)) : 0;
  const h = n > 1 ? 1.96 * sd / Math.sqrt(n) : 0;
  const ci: [number, number] | null = n > 1 ? [expectancy - h, expectancy + h] : null;
  const last = pnls.slice(-20);
  const base = { n, wins: w.length, winRate, avgWin, avgLoss, expectancy, profitFactor: gl > 0 ? gw / gl : gw > 0 ? Infinity : null, total: pnls.reduce((a, b) => a + b, 0), lastExpectancy: last.length >= 10 ? mean(last) : null, ci };
  const reasons: string[] = [];
  if (n < HEALTH_MIN_N) return { ...base, light: 'cinza', headline: 'Ainda poucas operações para avaliar', reasons: [`${n} de ${HEALTH_MIN_N} operações mínimas para um primeiro julgamento.`] };
  if (expectancy <= 0) {
    reasons.push(ci && ci[1] < 0 && n >= 30 ? 'O prejuízo médio por operação é estatisticamente comprovado.' : 'A média por operação é zero ou negativa: não há sinal de vantagem.');
    return { ...base, light: 'vermelho', headline: 'Perdendo dinheiro — recomendo parar', reasons };
  }
  if (base.lastExpectancy !== null && base.lastExpectancy <= 0) reasons.push('As últimas 20 operações estão no prejuízo.');
  if (!(ci && ci[0] > 0 && n >= HEALTH_PROVEN_N)) {
    reasons.push(n < HEALTH_PROVEN_N ? `Só ${n} operações: lucro ainda pode ser sorte (prova a partir de ${HEALTH_PROVEN_N}).` : 'O lucro médio ainda está dentro da margem de erro (pode ser sorte).');
    return { ...base, light: 'amarelo', headline: 'Atenção — lucrando, mas sem prova de vantagem', reasons };
  }
  if (reasons.length) return { ...base, light: 'amarelo', headline: 'Atenção — a fase recente piorou', reasons };
  return { ...base, light: 'verde', headline: 'Com vantagem e lucrando', reasons: ['Lucro médio positivo e acima da margem de erro, com amostra suficiente.'] };
}

const money = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LAMP: Record<Light, string> = { verde: '🟢 verde', amarelo: '🟡 amarelo', vermelho: '🔴 vermelho', cinza: '⚪ sem dados suficientes' };

/** Texto do resumo diário (18:00): resultado do dia + saúde do robô. Honesto: diz "perdendo" quando perde. */
export function buildSummary(i: { dayPnl: number; tradesToday: number; real: boolean; pnls: number[]; stopReason?: string | null }) {
  const h = healthOf(i.pnls);
  const lines = [
    `Resultado de hoje: ${money(i.dayPnl)} · ${i.tradesToday} operação(ões) · modo ${i.real ? 'DINHEIRO REAL' : 'SIMULADOR'}`,
    ...(i.stopReason ? [`Parei hoje: ${i.stopReason}.`] : []),
    `Saúde do robô: ${LAMP[h.light]} — ${h.headline}`,
    h.n ? `Média por operação: ${money(h.expectancy)} · acerto ${(h.winRate * 100).toFixed(0)}% · ${h.n} operações no total.` : 'Ainda não há operações para medir.',
    ...h.reasons,
  ];
  return { title: `Resumo do dia: ${money(i.dayPnl)} · ${LAMP[h.light]}`, lines, health: h };
}
