import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ex } from './exchange';
import type { TradeRow } from './types';

export const DEFAULT_FEE = 0.001;

export async function log(
  sb: SupabaseClient,
  userId: string,
  agent: string,
  level: 'info' | 'warn' | 'error' | 'trade' | 'refuse',
  message: string,
  meta: Record<string, unknown> = {},
) {
  await sb.from('bot_logs').insert({ user_id: userId, agent, level, message, meta });
}

export async function setAgent(sb: SupabaseClient, userId: string, agent: string, state: string, detail = '') {
  await sb.from('agent_status').upsert({ user_id: userId, agent, state, detail, updated_at: new Date().toISOString() });
}

/** Taxa real da ordem convertida p/ moeda de cotação; cai no padrão se a corretora não informar. */
export function feeInQuote(order: any, price: number, base: string, quote: string, notional: number): number {
  const fees: { currency?: string; cost?: number }[] = order?.fees?.length ? order.fees : order?.fee ? [order.fee] : [];
  let total = 0;
  let known = false;
  for (const f of fees) {
    if (!f?.cost) continue;
    if (f.currency === quote) { total += f.cost; known = true; }
    else if (f.currency === base) { total += f.cost * price; known = true; }
  }
  return known ? total : notional * DEFAULT_FEE;
}

/**
 * Fecha uma posição: cancela o stop protetor na corretora (ou detecta que ele já executou),
 * vende a mercado o que realmente existe em carteira e registra o resultado.
 */
export async function closeTrade(sb: SupabaseClient, ex: Ex, t: TradeRow, reason: string) {
  const [base, quote] = t.symbol.split('/');
  let exitPrice: number | null = null;
  let proceeds: number | null = null;
  let exitReason = reason;

  if (t.stop_order_id) {
    try {
      const o: any = await ex.fetchOrder(t.stop_order_id, t.symbol);
      if (o.status === 'closed' && (o.filled ?? 0) > 0) {
        exitPrice = o.average ?? o.price;
        const notional = (o.filled ?? t.qty) * (exitPrice as number);
        proceeds = notional - feeInQuote(o, exitPrice as number, base, quote, notional);
        exitReason = 'stop (executado na corretora)';
      } else {
        await ex.cancelOrder(t.stop_order_id, t.symbol).catch(() => undefined);
      }
    } catch { /* ordem inexistente: segue para venda a mercado */ }
  }

  if (exitPrice === null) {
    const bal = await ex.fetchBalance();
    const free = ((bal.free ?? {}) as unknown as Record<string, number>)[base] ?? 0;
    const qty = Math.min(t.qty, free);
    if (qty <= 0) throw new Error(`sem saldo de ${base} para fechar ${t.symbol}`);
    const amount = Number(ex.amountToPrecision(t.symbol, qty));
    const last = (await ex.fetchTicker(t.symbol)).last ?? t.entry_price;
    let order: any = await ex.createOrder(t.symbol, 'market', 'sell', amount, last);
    if (!order.average && order.id) order = await ex.fetchOrder(order.id, t.symbol).catch(() => order);
    exitPrice = order.average ?? order.price ?? last;
    const notional = (order.filled ?? amount) * (exitPrice as number);
    proceeds = notional - feeInQuote(order, exitPrice as number, base, quote, notional);
  }

  const pnl = (proceeds as number) - t.cost;
  await sb.from('trades').update({
    status: 'closed',
    exit_price: exitPrice,
    exit_at: new Date().toISOString(),
    proceeds,
    pnl,
    pnl_pct: pnl / t.cost,
    exit_reason: exitReason,
  }).eq('id', t.id);
  await log(sb, t.user_id, 'executor', 'trade', `SAÍDA ${t.symbol} @ ${exitPrice} · ${exitReason} · P&L ${pnl.toFixed(2)} ${quote}`, { tradeId: t.id, pnl });
  return { exitPrice: exitPrice as number, pnl };
}
