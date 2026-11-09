import { DEFAULT_PARAMS, type StrategyParams, type Timeframe } from '@desk/core/types';

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Sanitiza parâmetros vindos do cliente (frações: 0.03 = 3%). */
export function cleanParams(raw: any): StrategyParams {
  const d = DEFAULT_PARAMS;
  const tf: Timeframe = ['15m', '1h', '4h'].includes(raw?.timeframe) ? raw.timeframe : d.timeframe;
  return {
    minScore: num(raw?.minScore, 0.5, 0.95, d.minScore),
    stopPct: num(raw?.stopPct, 0.003, 0.2, d.stopPct),
    targetPct: num(raw?.targetPct, 0.005, 0.5, d.targetPct),
    trailingPct: num(raw?.trailingPct, 0, 0.2, d.trailingPct),
    positionPct: num(raw?.positionPct, 0.005, 0.25, d.positionPct),
    dailyLossPct: num(raw?.dailyLossPct, 0.005, 0.3, d.dailyLossPct),
    maxPositions: Math.round(num(raw?.maxPositions, 1, 10, d.maxPositions)),
    timeframe: tf,
    maxVolPct: d.maxVolPct,
  };
}

export const settingsToParams = (s: any): StrategyParams => ({
  minScore: +s.min_score, stopPct: +s.stop_pct, targetPct: +s.target_pct, trailingPct: +s.trailing_pct,
  positionPct: +s.position_pct, dailyLossPct: +s.daily_loss_pct, maxPositions: s.max_positions,
  timeframe: s.timeframe, maxVolPct: DEFAULT_PARAMS.maxVolPct,
});
