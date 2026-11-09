/**
 * Regras de segurança do dinheiro no day trade B3 (puras e testadas). O painel (servidor) as aplica; o conector Python repete as que valem na máquina
 * (engine.py: `real_contract_cap`, queda de 10% do pico) — mantenha os dois em sincronia.
 */
export const REAL_PHRASE = 'OPERAR REAL';
export const MIN_SIM_SESSIONS = 20;          // pregões na conta DEMO do MT5 (preços reais) com resultado positivo
export const MIN_SESSION_MINUTES = 240;      // robô ligado ≥ 4 h dentro do pregão para o dia contar
export const MIN_DEMO_TRADES = 30;           // operações mínimas na demo para a expectativa valer
export const NEAR_BACKTEST = 0.5;            // expectativa da demo precisa ser ≥ 50% da esperada no teste fora da amostra

/** Critérios de APROVAÇÃO da estratégia (teste final, uma única vez). */
export const APPROVAL_RULES = { minPF: 1.3, maxDD: 0.15, minTrades: 300 } as const;

/** Real: começa com 1 contrato. Só sobe depois de 30 pregões reais com resultado positivo, e 1 contrato a cada 15 pregões positivos a mais. */
export const REAL_START_CONTRACTS = 1;
export const REAL_SCALE_AFTER = 30;
export const REAL_SCALE_STEP = 15;
/** Se o dinheiro real cair 10% abaixo do pico, o robô volta sozinho ao simulador. */
export const REAL_DD_STOP = 0.10;

export interface Approval { approved: boolean; pf?: number; dd?: number; trades?: number; expectancy?: number; at?: string }
export interface DemoStats { sessions: number; trades: number; pnl: number; expectancy: number }

export interface UnlockInput {
  approval: Approval | null;       // aprovação no teste fora da amostra (app_settings.b3_approval; só é gravada se passar nos critérios)
  demo: DemoStats;                 // só conta demo do MT5 (o simulador interno, de preços artificiais, NÃO conta)
  confirm1: boolean;
  confirm2: boolean;
  phrase: string;
}

/** Decide se o modo REAL pode ser liberado. TODAS as condições precisam ser verdadeiras. */
export function unlockDecision(i: UnlockInput): { ok: boolean; missing: string[] } {
  const m: string[] = [];
  const a = i.approval;
  if (!a?.approved) m.push('estratégia ainda NÃO aprovada no teste fora da amostra (o robô ainda não tem vantagem comprovada)');
  if (i.demo.sessions < MIN_SIM_SESSIONS) m.push(`só ${i.demo.sessions} de ${MIN_SIM_SESSIONS} pregões válidos na conta DEMO do MT5`);
  if (i.demo.trades < MIN_DEMO_TRADES) m.push(`só ${i.demo.trades} de ${MIN_DEMO_TRADES} operações na demo para medir a expectativa`);
  if (!(i.demo.expectancy > 0)) m.push('a expectativa por operação na demo não é positiva (em R$)');
  if (!(i.demo.pnl > 0)) m.push('o resultado total da demo não é positivo');
  if (a?.approved && a.expectancy && i.demo.expectancy < NEAR_BACKTEST * a.expectancy) m.push('o resultado da demo está longe do esperado no teste (menos da metade da expectativa)');
  if (i.confirm1 !== true || i.confirm2 !== true) m.push('as duas confirmações na tela');
  if (i.phrase !== REAL_PHRASE) m.push(`digitar exatamente "${REAL_PHRASE}"`);
  return { ok: m.length === 0, missing: m };
}

/** Quantos contratos o real permite: 1 até provar. `sessions`/`pnl` = pregões reais já feitos e resultado acumulado em R$. */
export function realContractCap(sessions: number, pnl: number, requested: number): number {
  if (sessions < REAL_SCALE_AFTER || !(pnl > 0)) return REAL_START_CONTRACTS;
  const cap = 2 + Math.floor((sessions - REAL_SCALE_AFTER) / REAL_SCALE_STEP);
  return Math.max(REAL_START_CONTRACTS, Math.min(Math.round(requested), cap));
}

/** A estratégia só é aprovada se passar em TUDO no teste final (PF, drawdown, nº de trades) e for positiva nos dois ativos (ou o ruim é desligado). */
export function approveStrategy(perAsset: Record<string, { pf: number | null; dd: number; trades: number; pnl: number }>, total: { pf: number | null; dd: number; trades: number }): { approved: boolean; reasons: string[]; disabled: string[] } {
  const reasons: string[] = [], disabled: string[] = [];
  const assets = Object.entries(perAsset);
  const good = assets.filter(([, v]) => v.pnl > 0 && (v.pf ?? 0) > 1);
  for (const [k, v] of assets) if (!(v.pnl > 0 && (v.pf ?? 0) > 1)) disabled.push(k);
  if (good.length === 0) reasons.push('nenhum ativo é positivo no teste final');
  if (!((total.pf ?? 0) >= APPROVAL_RULES.minPF)) reasons.push(`fator de lucro ${total.pf?.toFixed(2) ?? '—'} < ${APPROVAL_RULES.minPF}`);
  if (!(total.dd <= APPROVAL_RULES.maxDD)) reasons.push(`drawdown ${(total.dd * 100).toFixed(1)}% > ${APPROVAL_RULES.maxDD * 100}%`);
  if (!(total.trades >= APPROVAL_RULES.minTrades)) reasons.push(`${total.trades} trades < ${APPROVAL_RULES.minTrades}`);
  return { approved: reasons.length === 0, reasons, disabled };
}

/** Frase para destravar o modo real depois do diagnóstico (a trava `real_locked` nasce LIGADA na migration 007). */
export const UNLOCK_DIAG_PHRASE = 'LIBERAR APÓS DIAGNÓSTICO';
export const CONSERVATIVE = { dailyLossBrl: 100, riskPerTradeBrl: 50, maxContracts: 1, maxTrades: 3 } as const;
