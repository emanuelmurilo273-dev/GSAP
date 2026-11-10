/** Estatísticas REAIS (puras e testadas). Entrada = só operações reais fechadas, cada uma com o ID da ordem. Regras de honestidade: nada é filtrado,
 *  dias negativos aparecem, e a mesma função serve ao painel, ao extrato e à página pública. */
export interface StatTrade {
  id: string; market: 'b3' | 'cripto'; symbol: string; side: 'buy' | 'sell';
  openedAt: string; closedAt: string; pnl: number;     // pnl LÍQUIDO (já com custos)
  fees: number;                                         // custos pagos (taxas/emolumentos), positivo
  orderId?: string | null;
}

const TZ = 'America/Sao_Paulo';
export const dayKey = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const hourOf = (iso: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(iso))) % 24;
const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);

function weekStart(day: string): string {          // segunda-feira da semana de `day` (AAAA-MM-DD)
  const d = new Date(day + 'T12:00:00Z'); const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10);
}

export interface Group { key: string; n: number; pnl: number; winRate: number; expectancy: number }
const group = (rows: StatTrade[], f: (t: StatTrade) => string): Group[] => {
  const m = new Map<string, StatTrade[]>();
  for (const t of rows) { const k = f(t); (m.get(k) ?? m.set(k, []).get(k)!).push(t); }
  return [...m.entries()].map(([key, g]) => ({ key, n: g.length, pnl: g.reduce((a, t) => a + t.pnl, 0), winRate: g.filter((t) => t.pnl > 0).length / g.length, expectancy: mean(g.map((t) => t.pnl)) })).sort((a, b) => a.key.localeCompare(b.key));
};

export function computeStats(input: StatTrade[], opts: { now?: Date; startEquity?: number | null } = {}) {
  const trades = [...input].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  const now = opts.now ?? new Date();
  const today = dayKey(now), wk = weekStart(today), mo = today.slice(0, 7), yr = today.slice(0, 4);
  const start = opts.startEquity && opts.startEquity > 0 ? opts.startEquity : null;
  const pnls = trades.map((t) => t.pnl);
  const wins = pnls.filter((p) => p > 0), losses = pnls.filter((p) => p < 0);
  const gw = wins.reduce((a, b) => a + b, 0), gl = -losses.reduce((a, b) => a + b, 0);

  // curva de patrimônio (relativa ao capital inicial, se conhecido) e drawdown
  let cum = 0, peak = 0, maxDd = 0, maxDdPct = 0, bestStreak = 0, worstStreak = 0, w = 0, l = 0;
  const curve: { t: string; v: number }[] = [];
  for (const t of trades) {
    cum += t.pnl; peak = Math.max(peak, cum);
    const dd = peak - cum; maxDd = Math.max(maxDd, dd);
    const base = (start ?? 0) + peak; if (base > 0) maxDdPct = Math.max(maxDdPct, dd / base);
    curve.push({ t: t.closedAt, v: (start ?? 0) + cum });
    if (t.pnl > 0) { w++; l = 0; } else if (t.pnl < 0) { l++; w = 0; } else { w = 0; l = 0; }
    bestStreak = Math.max(bestStreak, w); worstStreak = Math.max(worstStreak, l);
  }
  const curDd = peak - cum;
  const period = (pred: (d: string) => boolean) => {
    const sel = trades.filter((t) => pred(dayKey(t.closedAt)));
    const pnl = sel.reduce((a, t) => a + t.pnl, 0);
    const before = trades.filter((t) => sel.length && t.closedAt < sel[0].closedAt).reduce((a, t) => a + t.pnl, 0);
    return { pnl, n: sel.length, pct: start && start + before > 0 ? pnl / (start + before) : null };
  };
  const days = new Map<string, { day: string; pnl: number; n: number }>();
  for (const t of trades) { const d = dayKey(t.closedAt); const e = days.get(d) ?? { day: d, pnl: 0, n: 0 }; e.pnl += t.pnl; e.n++; days.set(d, e); }

  return {
    n: trades.length, firstTradeAt: trades[0]?.closedAt ?? null,
    periods: { hoje: period((d) => d === today), semana: period((d) => d >= wk), mes: period((d) => d.startsWith(mo)), ano: period((d) => d.startsWith(yr)), total: period(() => true) },
    winRate: trades.length ? wins.length / trades.length : null,
    avgWin: wins.length ? mean(wins) : 0, avgLoss: losses.length ? -mean(losses) : 0,
    expectancy: trades.length ? mean(pnls) : null,                              // R$ por operação, já líquido de custos
    profitFactor: gl > 0 ? gw / gl : gw > 0 ? Infinity : null,
    bestStreak, worstStreak, maxDrawdown: maxDd, maxDrawdownPct: start ? maxDdPct : null, currentDrawdown: curDd,
    costs: trades.reduce((a, t) => a + t.fees, 0), gross: trades.reduce((a, t) => a + t.pnl + t.fees, 0), net: cum,
    curve, calendar: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byMarket: group(trades, (t) => (t.market === 'b3' ? 'B3' : 'Cripto')), bySymbol: group(trades, (t) => t.symbol),
    byHour: group(trades, (t) => `${String(hourOf(t.closedAt)).padStart(2, '0')}h`),
    negativeDays: [...days.values()].filter((d) => d.pnl < 0).length, totalDays: days.size,
  };
}

/** Extrato CSV: uma linha por operação com ID da ordem (para conferir com as notas da corretora). Separador `;` e vírgula decimal (Excel pt-BR). */
export function statementCsv(trades: StatTrade[]): string {
  const f = (n: number) => n.toFixed(2).replace('.', ',');
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = ['data_saida', 'data_entrada', 'mercado', 'ativo', 'lado', 'id_ordem', 'resultado_liquido_brl', 'custos_brl', 'resultado_bruto_brl'];
  const rows = [...trades].sort((a, b) => a.closedAt.localeCompare(b.closedAt)).map((t) => [t.closedAt, t.openedAt, t.market === 'b3' ? 'B3' : 'Cripto', t.symbol, t.side === 'buy' ? 'compra' : 'venda', t.orderId ?? '', f(t.pnl), f(t.fees), f(t.pnl + t.fees)].map(String).map(esc).join(';'));
  return '﻿' + [head.join(';'), ...rows].join('\r\n') + '\r\n';
}
