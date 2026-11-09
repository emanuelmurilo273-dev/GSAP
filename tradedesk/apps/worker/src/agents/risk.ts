import { closeTrade, log, type Ex, type StrategyParams, type TradeRow } from '@desk/core';
import { brtDay, sb } from '../lib/env';

/** Equity que o robô enxerga: saldo da moeda de cotação + posições abertas do próprio robô a mercado. */
export async function botEquity(ex: Ex, quote: string, open: TradeRow[]) {
  const bal = await ex.fetchBalance();
  const free = ((bal.free ?? {}) as unknown as Record<string, number>)[quote] ?? 0;
  const total = ((bal.total ?? {}) as unknown as Record<string, number>)[quote] ?? 0;
  const prices = new Map<string, number>();
  let positions = 0;
  for (const t of open) {
    const last = (await ex.fetchTicker(t.symbol)).last ?? t.entry_price;
    prices.set(t.symbol, last);
    positions += t.qty * last;
  }
  return { equity: total + positions, free, prices };
}

/** 5 · RISK — monitora stop / alvo / trailing das posições abertas. */
export async function monitorPositions(ex: Ex, open: TradeRow[], prices: Map<string, number>, p: StrategyParams) {
  for (const t of open) {
    const price = prices.get(t.symbol);
    if (!price) continue;
    try {
      if (t.stop_order_id) {
        const o: any = await ex.fetchOrder(t.stop_order_id, t.symbol).catch(() => null);
        if (o?.status === 'closed' && (o.filled ?? 0) > 0) { await closeTrade(sb, ex, t, 'stop'); continue; }
      }
      const peak = Math.max(t.peak_price, price);
      const trailingActive = t.trailing_active || peak >= t.entry_price * (1 + p.targetPct / 2);
      const trailLevel = trailingActive && p.trailingPct > 0 ? peak * (1 - p.trailingPct) : 0;
      const stopLevel = Math.max(t.stop_price, trailLevel);
      if (price <= stopLevel) {
        await closeTrade(sb, ex, t, trailLevel > t.stop_price ? 'trailing stop' : 'stop loss');
      } else if (price >= t.target_price) {
        await closeTrade(sb, ex, t, 'alvo atingido');
      } else if (peak !== t.peak_price || trailingActive !== t.trailing_active) {
        await sb.from('trades').update({ peak_price: peak, trailing_active: trailingActive }).eq('id', t.id);
      }
    } catch (e: any) {
      await log(sb, t.user_id, 'risk', 'error', `Erro ao monitorar ${t.symbol}: ${String(e?.message ?? e).slice(0, 150)}`);
    }
  }
}

/** Limite de perda diária. Atingiu → para de abrir posições até o dia seguinte (posições abertas mantêm stop). */
export async function dailyGuard(userId: string, equity: number, p: StrategyParams) {
  const day = brtDay();
  let { data: st } = await sb.from('daily_state').select('*').eq('user_id', userId).eq('day', day).maybeSingle();
  if (!st) {
    const ins = await sb.from('daily_state').insert({ user_id: userId, day, start_equity: equity }).select('*').single();
    st = ins.data;
  }
  if (!st) return { halted: false, dayPnlPct: 0 };
  const dayPnlPct = (equity - st.start_equity) / st.start_equity;
  if (!st.halted && dayPnlPct <= -p.dailyLossPct) {
    await sb.from('daily_state').update({ halted: true, halted_reason: `perda do dia ${(dayPnlPct * 100).toFixed(2)}%` }).eq('user_id', userId).eq('day', day);
    await log(sb, userId, 'risk', 'warn', `LIMITE DIÁRIO ATINGIDO (${(dayPnlPct * 100).toFixed(2)}%). Robô não abre novas posições até amanhã.`);
    return { halted: true, dayPnlPct };
  }
  return { halted: st.halted as boolean, dayPnlPct };
}
