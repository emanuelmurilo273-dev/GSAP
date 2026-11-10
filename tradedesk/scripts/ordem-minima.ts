/**
 * TESTE DE PONTA A PONTA com DINHEIRO REAL e valor mínimo, na SUA conta da Foxbit (ou Mercado Bitcoin):
 *   compra o menor valor aceito → cria o stop na corretora → confere o ID das ordens e o saldo → cancela o stop → vende tudo.
 * Custa as taxas de uma ida e volta (cerca de 1% do valor mínimo) + o spread. NÃO roda sem a confirmação explícita.
 *
 *   FOXBIT_KEY=... FOXBIT_SECRET=... npx tsx scripts/ordem-minima.ts --confirmo [BTC/BRL]
 *
 * Use uma chave SEM permissão de saque. Cada etapa imprime PASSOU/FALHOU; se algo falhar no meio, o script tenta zerar a posição e avisa.
 */
import { createProtectiveStop, makeExchange } from '../packages/core/src';

const step = (n: string, ok: boolean, d = '') => { console.log(`${ok ? 'PASSOU ' : 'FALHOU '} ${n}${d ? ' · ' + d : ''}`); if (!ok) process.exitCode = 1; return ok; };

(async () => {
  if (!process.argv.includes('--confirmo')) { console.log('Isto faz ordens REAIS de valor mínimo. Rode de novo com --confirmo se tiver certeza.'); process.exit(2); }
  const symbol = process.argv.find((a) => /\/BRL$/.test(a)) ?? 'BTC/BRL';
  const key = process.env.FOXBIT_KEY, secret = process.env.FOXBIT_SECRET;
  if (!key || !secret) { console.log('Defina FOXBIT_KEY e FOXBIT_SECRET.'); process.exit(2); }
  const ex = makeExchange('foxbit', { apiKey: key, secret });
  await ex.loadMarkets();
  const [base] = symbol.split('/');
  const m = ex.market(symbol);
  const price = (await ex.fetchTicker(symbol)).last as number;
  const minCost = Math.max(m.limits?.cost?.min ?? 0, 10);                         // ~R$ 10 (confira o mínimo da corretora)
  let amount = Number(ex.amountToPrecision(symbol, (minCost * 1.2) / price));
  step('chave funciona (saldo)', !!(await ex.fetchBalance().catch(() => null)));
  let bought = 0;
  try {
    const buy: any = await ex.createOrder(symbol, 'market', 'buy', amount, price);
    bought = buy.filled ?? amount;
    step('compra a mercado executada', !!buy.id, `ordem ${buy.id}`);
    const bal: any = await ex.fetchBalance();
    const qty = Math.min(bought, bal.free?.[base] ?? bought);
    const stopId = await createProtectiveStop(ex, symbol, qty, price * 0.9);
    step('stop criado na corretora', !!stopId, `ordem ${stopId}`);
    if (stopId) { await ex.cancelOrder(stopId, symbol); step('stop cancelado', true); }
  } catch (e: any) {
    step('fluxo de compra/stop', false, String(e?.message ?? e).slice(0, 160));
  } finally {
    try {
      const bal: any = await ex.fetchBalance(); const have = Number(ex.amountToPrecision(symbol, Math.min(bought, bal.free?.[base] ?? 0)));
      if (have > 0) { const sell: any = await ex.createOrder(symbol, 'market', 'sell', have, price); step('venda a mercado (zerou)', !!sell.id, `ordem ${sell.id}`); }
    } catch (e: any) { step('ZERAR POSIÇÃO', false, `faça na mão no app da corretora: ${String(e?.message ?? e).slice(0, 120)}`); }
  }
  console.log(process.exitCode ? '\nHouve falhas. Veja acima.' : '\nOK: compra, stop, cancelamento e venda funcionaram na sua conta.');
})();
