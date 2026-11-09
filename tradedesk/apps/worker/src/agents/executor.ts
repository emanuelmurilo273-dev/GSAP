import { closeTrade, log, type Ex, type StrategyParams, type TradeRow } from '@desk/core';
import { sb } from '../lib/env';

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
  ex: Ex, userId: string, symbol: string, price: number, equity: number, free: number,
  p: StrategyParams, score: number, analysis: string,
) {
  const [base, quote] = symbol.split('/');
  const market = ex.market(symbol);
  const size = Math.min(equity * p.positionPct, free * 0.99);
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
    score, analysis,
  }).select('*').single();
  if (error || !trade) {
    await log(sb, userId, 'executor', 'error', `Ordem executada mas NÃO registrada (${error?.message}). Verifique ${symbol} manualmente!`);
    return null;
  }
  await log(sb, userId, 'executor', 'trade', `ENTRADA ${symbol} · ${qty.toFixed(6)} @ ${avg} · nota ${score} · stop ${trade.stop_price.toFixed(2)} · alvo ${trade.target_price.toFixed(2)}`, { tradeId: trade.id });

  // stop protetor na corretora (Binance). Se falhar, NUNCA deixa posição sem proteção: fecha na hora.
  if (ex.id === 'binance') {
    try {
      const stopPx = Number(ex.priceToPrecision(symbol, trade.stop_price));
      const limitPx = Number(ex.priceToPrecision(symbol, trade.stop_price * 0.995));
      const so: any = await ex.createOrder(symbol, 'STOP_LOSS_LIMIT', 'sell', Number(ex.amountToPrecision(symbol, qty)), limitPx, {
        stopPrice: stopPx, timeInForce: 'GTC',
      });
      await sb.from('trades').update({ stop_order_id: so.id }).eq('id', trade.id);
    } catch (e: any) {
      await log(sb, userId, 'risk', 'error', `Falha ao criar stop em ${symbol} (${String(e?.message ?? e).slice(0, 120)}). Fechando posição por segurança.`);
      await closeTrade(sb, ex, trade as TradeRow, 'sem stop protetor').catch(async (e2) => {
        await log(sb, userId, 'risk', 'error', `FALHA AO FECHAR ${symbol}: ${String(e2?.message ?? e2)}. Intervenção manual necessária!`);
      });
    }
  }
  return trade as TradeRow;
}
