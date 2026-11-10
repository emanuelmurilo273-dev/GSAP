import type { Ex } from './exchange';

/**
 * Particularidades de cada corretora para o stop de proteção.
 *  - Binance: STOP_LOSS_LIMIT (reserva a quantidade; precisa cancelar antes de vender).
 *  - Bybit (spot): ordem CONDICIONAL a mercado com triggerPrice (consulta/cancelamento com {trigger:true}).
 *  - Foxbit: ordem STOP_MARKET (venda a mercado quando o preço de gatilho é tocado).
 *  - Demais: sem stop na corretora (só o worker monitora).
 */
export const supportsExchangeStop = (id: string) => id === 'binance' || id === 'bybit' || id === 'foxbit';

/** parâmetros extras para fetchOrder/cancelOrder da ordem de stop */
export const stopOrderParams = (ex: Pick<Ex, 'id'>): Record<string, unknown> => (ex.id === 'bybit' ? { trigger: true } : {});

export async function createProtectiveStop(ex: Ex, symbol: string, qty: number, stopPrice: number): Promise<string | null> {
  const amount = Number(ex.amountToPrecision(symbol, qty));
  const stopPx = Number(ex.priceToPrecision(symbol, stopPrice));
  if (ex.id === 'binance') {
    const limitPx = Number(ex.priceToPrecision(symbol, stopPrice * 0.995));
    const o: any = await ex.createOrder(symbol, 'STOP_LOSS_LIMIT', 'sell', amount, limitPx, { stopPrice: stopPx, timeInForce: 'GTC' });
    return o.id;
  }
  if (ex.id === 'bybit') {
    const o: any = await ex.createOrder(symbol, 'market', 'sell', amount, undefined, { triggerPrice: stopPx });
    return o.id;
  }
  if (ex.id === 'foxbit') {
    const o: any = await ex.createOrder(symbol, 'STOP_MARKET', 'sell', amount, undefined, { triggerPrice: stopPx });
    return o.id;
  }
  return null;
}
