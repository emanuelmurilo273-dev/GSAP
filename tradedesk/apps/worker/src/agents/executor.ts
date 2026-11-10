import { cappedPositionSize, closeTrade, testnetMode, createProtectiveStop, log, supportsExchangeStop, type Ex, type StrategyParams, type TradeRow } from '@desk/core';
import type { SupabaseClient } from '@supabase/supabase-js';

function fees(order: any, base: string, quote: string) {
  let inBase = 0;
  let inQuote = 0;
  const list: any[] = order?.fees?.length ? order.fees : order?.fee ? [order.fee] : [];
  for (const f of list) {
    if (!f?.cost) continue;
    if (f.currency === base) inBase += f.cost;
    else if (f.currency === quote) inQuote += f.cost;
  }
  return { inBase, inQuote };
}

/**
 * 4 · EXECUTOR — envia a ordem real. Tamanho máximo = % do saldo. 5 · RISK (na saída): toda ordem
 * nasce com stop; na Binance o stop também fica na corretora (STOP_LOSS_LIMIT) e sobrevive a falhas do worker.
 */
export async function enter(
  sb: SupabaseClient, ex: Ex, userId: string, symbol: string, price: number, equity: number, free: number,
  p: StrategyParams, score: number, analysis: string,
) {
  const [base, quote] = symbol.split('/');
  const market = ex.market(symbol);
  // no máximo 1% do patrimônio arriscado no stop, no máximo o % configurado, e nunca mais que o saldo livre (sem alavancagem)
  const size = cappedPositionSize(equity, free, p.positionPct, p.stopPct);
  const minCost = market.limits?.cost?.min ?? 0;
  if (size <= 0 || size < minCost) {
    await log(sb, userId, 'executor', 'refuse', `RECUSA ${symbol}: tamanho ${size.toFixed(2)} ${quote} abaixo do mínimo da corretora (${minCost})`);
    return null;
  }
  const amount = Number(ex.amountToPrecision(symbol, size / price));
  if (!(amount > 0) || (market.limits?.amount?.min && amount < market.limits.amount.min)) {
    await log(sb, userId, 'executor', 'refuse', `RECUSA ${symbol}: quantidade ${amount} abaixo do mínimo`);
    return null;
  }

  let order: any = await ex.createOrder(symbol, 'market', 'buy', amount, price);
  if ((!order.average || !order.filled) && order.id) order = await ex.fetchOrder(order.id, symbol).catch(() => order);
  const avg: number = order.average ?? order.price ?? price;
  const filled: number = order.filled ?? amount;
  const f = fees(order, base, quote);
  const qty = filled - f.inBase;
  const cost = avg * filled + f.inQuote;

  const { data: trade, error } = await sb.from('trades').insert({
    user_id: userId, symbol, qty, entry_price: avg, cost,
    stop_price: avg * (1 - p.stopPct), target_price: avg * (1 + p.targetPct), peak_price: avg,
    score, analysis, entry_order_id: order.id ?? null, fees: f.inQuote + f.inBase * avg, testnet: testnetMode(),
  }).select('*').single();
  if (error || !trade) {
    await log(sb, userId, 'executor', 'error', `Ordem executada mas NÃO registrada (${error?.message}). Verifique ${symbol} manualmente!`);
    return null;
  }
  await log(sb, userId, 'executor', 'trade', `ENTRADA ${symbol} · ${qty.toFixed(6)} @ ${avg} · nota ${score} · stop ${trade.stop_price.toFixed(2)} · alvo ${trade.target_price.toFixed(2)}`, { tradeId: trade.id });

  // stop protetor na corretora (Binance: STOP_LOSS_LIMIT; Bybit: ordem condicional). Se falhar, NUNCA deixa posição sem proteção: fecha na hora.
  if (supportsExchangeStop(ex.id)) {
    try {
      // quantidade realmente disponível (a taxa pode ter sido cobrada no próprio ativo)
      let stopQty = qty;
      const bal = await ex.fetchBalance().catch(() => null);
      const freeBase = (bal?.free as any)?.[base];
      if (typeof freeBase === 'number' && freeBase > 0) stopQty = Math.min(qty, freeBase);
      const stopId = await createProtectiveStop(ex, symbol, stopQty, trade.stop_price);
      if (stopId) await sb.from('trades').update({ stop_order_id: stopId }).eq('id', trade.id);
    } catch (e: any) {
      await log(sb, userId, 'risk', 'error', `Falha ao criar stop em ${symbol} (${String(e?.message ?? e).slice(0, 120)}). Fechando posição por segurança.`);
      await closeTrade(sb, ex, trade as TradeRow, 'sem stop protetor').catch(async (e2) => {
        await log(sb, userId, 'risk', 'error', `FALHA AO FECHAR ${symbol}: ${String(e2?.message ?? e2)}. Intervenção manual necessária!`);
      });
    }
  }
  return trade as TradeRow;
}
