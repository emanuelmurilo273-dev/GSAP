import type { Candle } from '../packages/core/src/types';

export const FEE = 0.001;   // 0,1% por execução
export const SLIP = 0.0005; // 0,05% por execução

/** Saída de uma estratégia: sinais calculados no FECHAMENTO de cada barra (execução na abertura da seguinte). */
export interface Signals {
  entry: boolean[];
  exit?: boolean[];                 // sair na abertura da próxima barra
  stopDist: (number | null)[];      // distância do stop como fração do preço de entrada (no momento do sinal)
  size?: number[];                  // fração do capital (default 1 = 100%)
  trailAtr?: { mult: number; atr: number[] }; // chandelier: sai se fechar abaixo de (máx. fechamento desde a entrada − mult×ATR)
  maxHold?: number;                 // barras
}

export interface Trade { entryI: number; exitI: number; ret: number; reason: string }
export interface SimResult {
  trades: Trade[];
  equity: number[];     // por barra no intervalo [from,to)
  times: number[];
}

/** Simula long-only spot, 1 posição por vez, capital inicial 1, no intervalo [from,to). */
export function simulate(c: Candle[], s: Signals, from: number, to: number): SimResult {
  let cash = 1;
  let pos: null | { qty: number; cost: number; entry: number; entryI: number; stop: number; peakClose: number } = null;
  const trades: Trade[] = [];
  const equity: number[] = [];
  const times: number[] = [];
  const close = (i: number, price: number, reason: string) => {
    if (!pos) return;
    const px = price * (1 - SLIP);
    const proceeds = pos.qty * px * (1 - FEE);
    cash += proceeds;
    trades.push({ entryI: pos.entryI, exitI: i, ret: proceeds / pos.cost - 1, reason });
    pos = null;
  };
  let pendingEntry: { size: number; stop: number | null } | null = null;
  let pendingExit = false;

  for (let i = from; i < to; i++) {
    const k = c[i];
    // execuções agendadas no fechamento anterior
    if (pos && pendingExit) close(i, k.o, 'sinal');
    pendingExit = false;
    if (!pos && pendingEntry) {
      const price = k.o * (1 + SLIP);
      const eq = cash;
      const cost = eq * Math.min(1, pendingEntry.size);
      if (cost > 0) {
        cash -= cost;
        pos = { qty: (cost / price) * (1 - FEE), cost, entry: price, entryI: i, stop: pendingEntry.stop ? price * (1 - pendingEntry.stop) : 0, peakClose: price };
      }
    }
    pendingEntry = null;

    if (pos) {
      if (pos.stop > 0) {
        if (k.o <= pos.stop) close(i, k.o, 'stop');
        else if (k.l <= pos.stop) close(i, pos.stop, 'stop');
      }
      if (pos && s.maxHold && i - pos.entryI >= s.maxHold) close(i, k.c, 'tempo');
    }
    equity.push(cash + (pos ? pos.qty * k.c : 0));
    times.push(k.t);

    if (pos) {
      pos.peakClose = Math.max(pos.peakClose, k.c);
      if (s.exit?.[i]) pendingExit = true;
      if (s.trailAtr && !Number.isNaN(s.trailAtr.atr[i]) && k.c < pos.peakClose - s.trailAtr.mult * s.trailAtr.atr[i]) pendingExit = true;
    } else if (s.entry[i] && i < to - 1) {
      pendingEntry = { size: s.size?.[i] ?? 1, stop: s.stopDist[i] };
    }
  }
  if (pos) { close(to - 1, c[to - 1].c, 'fim'); equity[equity.length - 1] = cash; }
  return { trades, equity, times };
}

// ------------------------------------------------------------------ métricas
export interface Metrics {
  trades: number; winRate: number | null; pf: number | null; totalRet: number;
  maxDD: number; sharpe: number; avgTrade: number | null;
}

const DAY = 86_400_000;
/** retornos diários (equity amostrada a cada 24h) */
export function dailyReturns(times: number[], eq: number[]): number[] {
  const out: number[] = [];
  let lastDay = -1, last = eq[0];
  for (let i = 0; i < eq.length; i++) {
    const d = Math.floor(times[i] / DAY);
    if (d !== lastDay) { if (lastDay !== -1) out.push(eq[i] / last - 1); last = eq[i]; lastDay = d; }
  }
  return out;
}
export function sharpe(daily: number[]): number {
  if (daily.length < 5) return 0;
  const m = daily.reduce((a, b) => a + b, 0) / daily.length;
  const sd = Math.sqrt(daily.reduce((a, b) => a + (b - m) ** 2, 0) / (daily.length - 1));
  return sd > 0 ? (m / sd) * Math.sqrt(365) : 0;
}
export function maxDrawdown(eq: number[]): number {
  let peak = eq[0], dd = 0;
  for (const e of eq) { if (e > peak) peak = e; dd = Math.max(dd, (peak - e) / peak); }
  return dd;
}
export function profitFactor(trades: { ret: number }[], weight = 1): number | null {
  let gw = 0, gl = 0;
  for (const t of trades) { if (t.ret > 0) gw += t.ret * weight; else gl += -t.ret * weight; }
  return gl > 0 ? gw / gl : gw > 0 ? Infinity : null;
}
export function metrics(r: { trades: Trade[]; equity: number[]; times: number[] }): Metrics {
  const t = r.trades;
  const wins = t.filter((x) => x.ret > 0).length;
  return {
    trades: t.length, winRate: t.length ? wins / t.length : null, pf: profitFactor(t),
    totalRet: r.equity.length ? r.equity[r.equity.length - 1] - 1 : 0, maxDD: maxDrawdown(r.equity),
    sharpe: sharpe(dailyReturns(r.times, r.equity)), avgTrade: t.length ? t.reduce((a, x) => a + x.ret, 0) / t.length : null,
  };
}

/** Portfólio igual-peso (sem rebalanceamento): média das curvas normalizadas, alinhadas por timestamp. */
export function combine(parts: { times: number[]; equity: number[] }[]): { times: number[]; equity: number[] } {
  const times = parts[0].times;
  const equity = times.map((_, i) => parts.reduce((a, p) => a + (p.equity[i] ?? p.equity[p.equity.length - 1]), 0) / parts.length);
  return { times, equity };
}
export function buyHold(c: Candle[], from: number, to: number) {
  const first = c[from].o * (1 + SLIP);
  const times: number[] = [], equity: number[] = [];
  for (let i = from; i < to; i++) { times.push(c[i].t); equity.push(c[i].c / first); }
  equity[equity.length - 1] = (c[to - 1].c * (1 - SLIP)) / first;
  return { times, equity };
}
