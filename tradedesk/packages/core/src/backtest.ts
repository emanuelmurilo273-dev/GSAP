import { buildSeries, scoreAt, WARMUP } from './strategy';
import { DEFAULT_PARAMS, type Candle, type StrategyParams } from './types';

export interface BacktestCfg {
  params: StrategyParams;
  /** taxa da corretora por lado (0.001 = 0,1%) */
  feePct: number;
  /** slippage por execução (0.0005 = 0,05%) */
  slippagePct: number;
  initialEquity: number;
}

export const DEFAULT_COSTS = { feePct: 0.001, slippagePct: 0.0005 };

export interface BtTrade {
  entryT: number;
  exitT: number;
  entry: number;
  exit: number;
  pnl: number;
  pnlPct: number;
  reason: 'stop' | 'target' | 'trailing' | 'end';
  score: number;
}

export interface BacktestResult {
  trades: BtTrade[];
  equity: { t: number; v: number }[];
  metrics: {
    trades: number;
    winRate: number | null;
    totalPnl: number;
    totalPnlPct: number;
    profitFactor: number | null;
    maxLossStreak: number;
    maxDrawdownPct: number;
    avgTradePct: number | null;
    buyHoldPct: number;
    initialEquity: number;
    finalEquity: number;
    candles: number;
    from: number;
    to: number;
    feePct: number;
    slippagePct: number;
    haltedDays: number;
  };
}

const dayKey = (t: number) => Math.floor((t - 3 * 3600_000) / 86_400_000); // dia em UTC-3

/**
 * Simula a estratégia (long-only, spot, 1 posição por vez, sem preço médio).
 *  - sinal calculado no fechamento do candle i, entrada na abertura do candle i+1;
 *  - stop e alvo checados com máxima/mínima; se ambos no mesmo candle, o STOP vence (conservador);
 *  - trailing usa só a máxima de candles anteriores (sem olhar o futuro);
 *  - taxas e slippage em todas as execuções; limite de perda diária interrompe novas entradas no dia.
 */
export function runBacktest(c: Candle[], cfg: Partial<BacktestCfg> = {}): BacktestResult {
  const params = { ...DEFAULT_PARAMS, ...(cfg.params ?? {}) };
  const fee = cfg.feePct ?? DEFAULT_COSTS.feePct;
  const slip = cfg.slippagePct ?? DEFAULT_COSTS.slippagePct;
  const initial = cfg.initialEquity ?? 1000;

  const s = buildSeries(c);
  let cash = initial;
  let pos: null | {
    qty: number; cost: number; entry: number; entryT: number; stop: number; target: number;
    peak: number; trailing: boolean; score: number;
  } = null;
  let pending: number | null = null; // nota do sinal gerado no candle anterior
  let curDay = -1;
  let dayStart = initial;
  let haltedToday = false;
  let haltedDays = 0;
  const trades: BtTrade[] = [];
  const equityFull: { t: number; v: number }[] = [];
  let peakEq = initial;
  let maxDD = 0;

  const close = (k: Candle, price: number, reason: BtTrade['reason']) => {
    if (!pos) return;
    const exit = price * (1 - slip);
    const proceeds = pos.qty * exit * (1 - fee);
    const pnl = proceeds - pos.cost;
    cash += proceeds;
    trades.push({
      entryT: pos.entryT, exitT: k.t, entry: pos.entry, exit, pnl, pnlPct: pnl / pos.cost, reason, score: pos.score,
    });
    pos = null;
  };

  for (let i = WARMUP; i < c.length; i++) {
    const k = c[i];
    const dk = dayKey(k.t);
    if (dk !== curDay) {
      curDay = dk;
      dayStart = cash + (pos ? pos.qty * c[i - 1].c : 0);
      haltedToday = false;
    }

    // 1) entrada na abertura
    if (pending !== null && !pos && !haltedToday) {
      const price = k.o * (1 + slip);
      const size = cash * params.positionPct;
      if (size > 0) {
        const qty = (size / price) * (1 - fee);
        cash -= size;
        pos = {
          qty, cost: size, entry: price, entryT: k.t,
          stop: price * (1 - params.stopPct), target: price * (1 + params.targetPct),
          peak: price, trailing: false, score: pending,
        };
      }
    }
    pending = null;

    // 2) saídas dentro do candle
    if (pos) {
      let stopLevel = pos.stop;
      let stopReason: BtTrade['reason'] = 'stop';
      if (pos.trailing && params.trailingPct > 0) {
        const ts = pos.peak * (1 - params.trailingPct);
        if (ts > stopLevel) { stopLevel = ts; stopReason = 'trailing'; }
      }
      if (k.o <= stopLevel) close(k, k.o, stopReason);
      else if (k.l <= stopLevel) close(k, stopLevel, stopReason);
      else if (k.h >= pos.target) close(k, pos.target, 'target');
      else {
        pos.peak = Math.max(pos.peak, k.h);
        if (pos.peak >= pos.entry * (1 + params.targetPct / 2)) pos.trailing = true;
      }
    }

    // 3) marcação a mercado
    const eq = cash + (pos ? pos.qty * k.c : 0);
    equityFull.push({ t: k.t, v: eq });
    if (eq > peakEq) peakEq = eq;
    maxDD = Math.max(maxDD, (peakEq - eq) / peakEq);

    if (!haltedToday && (eq - dayStart) / dayStart <= -params.dailyLossPct) {
      haltedToday = true;
      haltedDays++;
    }

    // 4) novo sinal no fechamento
    if (!pos && !haltedToday && i < c.length - 1 && !(s.atrPct[i] > params.maxVolPct)) {
      const sc = scoreAt(s, c, i, params);
      if (sc && sc.score >= params.minScore) pending = sc.score;
    }
  }

  if (pos) close(c[c.length - 1], c[c.length - 1].c, 'end');
  const finalEq = cash;
  if (equityFull.length) equityFull[equityFull.length - 1].v = finalEq;

  // métricas
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const gw = wins.reduce((a, t) => a + t.pnl, 0);
  const gl = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  let streak = 0;
  let maxStreak = 0;
  for (const t of trades) {
    streak = t.pnl <= 0 ? streak + 1 : 0;
    maxStreak = Math.max(maxStreak, streak);
  }
  const first = c[WARMUP];
  const last = c[c.length - 1];
  const step = Math.max(1, Math.ceil(equityFull.length / 300));
  const equity = equityFull.filter((_, idx) => idx % step === 0 || idx === equityFull.length - 1);

  return {
    trades,
    equity,
    metrics: {
      trades: trades.length,
      winRate: trades.length ? wins.length / trades.length : null,
      totalPnl: finalEq - initial,
      totalPnlPct: (finalEq - initial) / initial,
      profitFactor: gl > 0 ? gw / gl : null,
      maxLossStreak: maxStreak,
      maxDrawdownPct: maxDD,
      avgTradePct: trades.length ? trades.reduce((a, t) => a + t.pnlPct, 0) / trades.length : null,
      buyHoldPct: first && last ? last.c / first.o - 1 : 0,
      initialEquity: initial,
      finalEquity: finalEq,
      candles: c.length,
      from: first?.t ?? 0,
      to: last?.t ?? 0,
      feePct: fee,
      slippagePct: slip,
      haltedDays,
    },
  };
}
