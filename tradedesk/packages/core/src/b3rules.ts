/**
 * Regras de liberação do modo REAL do day trade B3 (puras e testadas). Usadas pelo painel (servidor).
 * O conector (Python) repete os tetos do modo limitado — mantenha os dois em sincronia (connector/hexadesk_connector/engine.py).
 */
export const REAL_PHRASE = 'OPERAR REAL';
export const RISK_PHRASE = 'EU ASSUMO O RISCO';
export const MIN_SIM_SESSIONS = 20;          // com estratégia aprovada
export const MIN_SIM_SESSIONS_LIMITED = 5;   // liberação do dono (sem estratégia aprovada)
export const MIN_SESSION_MINUTES = 240;      // robô ligado ≥ 4 h dentro do pregão para o dia contar

/** Tetos do modo REAL LIMITADO (estratégia não aprovada). Valem acima de qualquer configuração. */
export const LIMITED_CAPS = { maxContracts: 1, dailyLossBrl: 100, maxTrades: 3, riskPerTradeBrl: 50, maxOpenPositions: 1 } as const;

export interface UnlockInput {
  strategyApproved: boolean;
  simSessions: number;       // pregões válidos na conta DEMO do MT5 (o simulador interno não conta)
  confirm1: boolean;
  confirm2: boolean;
  confirm3: boolean;         // "sei que a estratégia NÃO foi validada" (só exigido no modo limitado)
  phrase: string;
  riskPhrase: string;
}

export function unlockDecision(i: UnlockInput): { ok: boolean; limited: boolean; needSessions: number; missing: string[] } {
  const limited = !i.strategyApproved;
  const needSessions = limited ? MIN_SIM_SESSIONS_LIMITED : MIN_SIM_SESSIONS;
  const missing: string[] = [];
  if (i.simSessions < needSessions) missing.push(`só ${i.simSessions} de ${needSessions} pregões válidos na conta DEMO do MT5`);
  if (i.confirm1 !== true || i.confirm2 !== true) missing.push('as duas confirmações na tela');
  if (limited && i.confirm3 !== true) missing.push('a confirmação de que a estratégia NÃO foi validada');
  if (i.phrase !== REAL_PHRASE) missing.push(`digitar exatamente "${REAL_PHRASE}"`);
  if (limited && i.riskPhrase !== RISK_PHRASE) missing.push(`digitar exatamente "${RISK_PHRASE}"`);
  return { ok: missing.length === 0, limited, needSessions, missing };
}

/** Aplica os tetos do modo limitado a um conjunto de configurações. */
export function applyLimitedCaps<T extends Record<string, any>>(s: T): T {
  return {
    ...s,
    profile: 'conservador',
    max_contracts: Math.min(Number(s.max_contracts), LIMITED_CAPS.maxContracts),
    daily_loss_brl: Math.min(Number(s.daily_loss_brl), LIMITED_CAPS.dailyLossBrl),
    max_trades_per_day: Math.min(Number(s.max_trades_per_day), LIMITED_CAPS.maxTrades),
    risk_per_trade_brl: Math.min(Number(s.risk_per_trade_brl), LIMITED_CAPS.riskPerTradeBrl),
  };
}
