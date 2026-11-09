import { DEFAULT_PARAMS, type StrategyParams } from '@desk/core/types';

/** Estado do formulário em PERCENTUAL (3 = 3%); o servidor recebe frações. Módulo comum (servidor e navegador). */
export type PForm = { minScore: number; stopPct: number; targetPct: number; trailingPct: number; positionPct: number; dailyLossPct: number; maxPositions: number; timeframe: string };

export const toForm = (p: StrategyParams): PForm => ({
  minScore: p.minScore, stopPct: p.stopPct * 100, targetPct: p.targetPct * 100, trailingPct: p.trailingPct * 100,
  positionPct: p.positionPct * 100, dailyLossPct: p.dailyLossPct * 100, maxPositions: p.maxPositions, timeframe: p.timeframe,
});
export const fromForm = (f: PForm) => ({
  minScore: f.minScore, stopPct: f.stopPct / 100, targetPct: f.targetPct / 100, trailingPct: f.trailingPct / 100,
  positionPct: f.positionPct / 100, dailyLossPct: f.dailyLossPct / 100, maxPositions: f.maxPositions, timeframe: f.timeframe,
});
export const defaultForm = () => toForm(DEFAULT_PARAMS);
