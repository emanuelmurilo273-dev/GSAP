/**
 * Jornada completa: pagamento → e-mail → login → conectar corretora testnet → backtest → ligar robô → trade → relatório.
 *
 *   npx tsx scripts/e2e.ts --mock   → roda o que NÃO precisa de contas externas (backtest com dados reais, ciclo de trade
 *                                     com corretora simulada, template de e-mail). Sem rede de pagamento/banco.
 *   npx tsx scripts/e2e.ts          → jornada real em SANDBOX. Exige: ASAAS_API_KEY (sandbox), ASAAS_WEBHOOK_SECRET,
 *                                     SUPABASE_URL/SUPABASE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY, RESEND_API_KEY, ENCRYPTION_KEY,
 *                                     BINANCE_TESTNET=true + E2E_BINANCE_KEY/E2E_BINANCE_SECRET (testnet.binance.vision),
 *                                     E2E_WEB_URL (site rodando, ex.: http://localhost:3000), E2E_EMAIL.
 * Cada etapa imprime PASSOU / FALHOU / PULADA (com motivo). Nada é "passado" sem ser executado.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { DEFAULT_PARAMS, closeAllPositions, emailLayout, enableBlockers, fetchHistory, makeExchange, runBacktest, type TradeRow } from '../packages/core/src/index';
import { enter } from '../apps/worker/src/agents/executor';
import { dailyGuard, monitorPositions } from '../apps/worker/src/agents/risk';
import { FakeSb, MockExchange } from '../apps/worker/test/mock';

const mock = process.argv.includes('--mock');
const results: { step: string; status: 'PASSOU' | 'FALHOU' | 'PULADA'; note: string }[] = [];
const need = (...k: string[]) => k.filter((x) => !process.env[x]);

async function step(name: string, fn: () => Promise<string | void>, requires: string[] = []) {
  const miss = need(...requires);
  if (miss.length) { results.push({ step: name, status: 'PULADA', note: `faltam variáveis: ${miss.join(', ')}` }); return; }
  try { results.push({ step: name, status: 'PASSOU', note: (await fn()) ?? '' }); }
  catch (e: any) { results.push({ step: name, status: 'FALHOU', note: String(e?.message ?? e).slice(0, 200) }); }
}
const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };

async function main() {
  const U = 'e2e-user';
  const sb = new FakeSb() as any;
  const ex = new MockExchange('USDT', 1000) as any;
  ex.setPrice('BTC/USDT', 100);

  // ---------------------------------------------------------------- 1-2. pagamento e e-mail (real: sandbox)
  await step('1. Pagamento: criar assinatura no Asaas sandbox e simular Pix pago', async () => {
    const { asaas } = await import('../packages/core/src/asaas');
    const cust = await asaas.createCustomer({ name: 'E2E Teste', email: process.env.E2E_EMAIL!, cpfCnpj: '24971563792', externalReference: 'e2e' });
    const sub = await asaas.createSubscription({ customer: cust.id, value: 7000, externalReference: 'e2e', description: 'E2E' });
    const pays = await asaas.subscriptionPayments(sub.id);
    const first = pays.data[0];
    const qr = await asaas.pixQr(first.id);
    ok(qr.payload, 'sem Pix copia-e-cola');
    await asaas.receiveInCash(first.id, 7000);
    (globalThis as any).__e2e = { cust, sub, pay: first };
    return `assinatura ${sub.id}, QR ok`;
  }, mock ? ['__SO_REAL'] : ['ASAAS_API_KEY', 'E2E_EMAIL']);
  if (mock) results[results.length - 1].note = 'pulada no modo --mock (usa o sandbox do Asaas)';

  await step('2. Webhook libera acesso + e-mail de boas-vindas', async () => {
    const g = (globalThis as any).__e2e;
    const r = await fetch(`${process.env.E2E_WEB_URL}/api/webhooks/asaas`, { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': process.env.ASAAS_WEBHOOK_SECRET! },
      body: JSON.stringify({ id: `evt_e2e_${Date.now()}`, event: 'PAYMENT_CONFIRMED', payment: { id: g.pay.id, customer: g.cust.id, subscription: g.sub.id, value: 7000, status: 'CONFIRMED', billingType: 'PIX', dueDate: new Date().toISOString().slice(0, 10) } }) });
    ok(r.ok, `webhook HTTP ${r.status}`);
    const bad = await fetch(`${process.env.E2E_WEB_URL}/api/webhooks/asaas`, { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': 'errado' }, body: '{}' });
    ok(bad.status === 401, 'webhook aceitou token errado!');
    return 'conta criada; token errado → 401. Confira a caixa de entrada de E2E_EMAIL (Resend).';
  }, mock ? ['__SO_REAL'] : ['ASAAS_WEBHOOK_SECRET', 'E2E_WEB_URL', 'SUPABASE_URL', 'SUPABASE_KEY', 'RESEND_API_KEY']);
  if (mock) results[results.length - 1].note = 'pulada no modo --mock (precisa de site, Supabase e Resend)';

  // Login por link mágico depende de cookie de sessão do navegador: não é automatizável aqui sem fingir. Teste manual.
  results.push({ step: '3. Login por link mágico (e-mail → clique → painel)', status: 'PULADA', note: 'manual: abra o e-mail de boas-vindas, clique no link e confirme que cai em /app/onboarding' });

  await step('4. Conectar corretora: validar a chave no TESTNET da Binance', async () => {
    const { validateKeys } = await import('../packages/core/src/exchange');
    const r = await validateKeys('binance', { apiKey: process.env.E2E_BINANCE_KEY!, secret: process.env.E2E_BINANCE_SECRET! }, false);
    ok(r.ok, r.ok ? '' : r.reason);
    return 'chave do testnet válida';
  }, mock ? ['__SO_REAL'] : ['BINANCE_TESTNET', 'E2E_BINANCE_KEY', 'E2E_BINANCE_SECRET']);
  if (mock) results[results.length - 1].note = 'pulada no modo --mock (precisa de chaves do testnet)';

  // ---------------------------------------------------------------- 5. backtest (dados reais públicos)
  await step('5. Backtest com dados históricos reais (Binance, BTC/USDT 1h, 30 dias)', async () => {
    const c = await fetchHistory(makeExchange('binance'), 'BTC/USDT', '1h', 30);
    ok(c.length > 600, `poucos candles (${c.length})`);
    const r = runBacktest(c, { params: DEFAULT_PARAMS });
    return `${c.length} candles, ${r.metrics.trades} trades, resultado ${(r.metrics.totalPnlPct * 100).toFixed(2)}%`;
  });

  // ---------------------------------------------------------------- 6. gate: ligar robô
  await step('6. Ligar robô: exige corretora + backtest + termo; cliente bloqueado sem estratégia aprovada', async () => {
    const base = { account: { verified: true, attested_no_withdraw: false }, settings: { backtest_done_at: 'x', risk_accepted_at: 'x', risk_terms_version: '2026-11-01' } };
    const prevA = process.env.STRATEGY_APPROVED, prevT = process.env.BINANCE_TESTNET;
    process.env.STRATEGY_APPROVED = 'false'; process.env.BINANCE_TESTNET = 'false';
    const cliente = enableBlockers({ ...base, isOwner: false });
    const dono = enableBlockers({ ...base, isOwner: true });
    process.env.STRATEGY_APPROVED = prevA; process.env.BINANCE_TESTNET = prevT;
    ok(cliente.length === 1, 'cliente deveria estar bloqueado'); ok(dono.length === 0, 'dono deveria poder ligar');
    return `cliente bloqueado (${cliente[0]}); dono liberado`;
  });

  // ---------------------------------------------------------------- 7. trade (real: testnet / mock: corretora simulada)
  await step('7. Trade: entrada → stop/alvo/trailing → limite diário → fechar todas', async () => {
    const t = await enter(sb, ex, U, 'BTC/USDT', 100, 1000, 900, DEFAULT_PARAMS, 0.8, 'e2e');
    ok(t, 'entrada falhou');
    ex.prices['BTC/USDT'] = 104; // trailing liga
    await monitorPositions(sb, ex, sb.rows('trades') as TradeRow[], new Map([['BTC/USDT', 104]]), DEFAULT_PARAMS);
    ok(sb.rows('trades')[0].trailing_active, 'trailing não ativou');
    ex.prices['BTC/USDT'] = 106.5; // alvo
    await monitorPositions(sb, ex, sb.rows('trades') as TradeRow[], new Map([['BTC/USDT', 106.5]]), DEFAULT_PARAMS);
    ok(sb.rows('trades')[0].exit_reason === 'alvo atingido', 'alvo não executou');
    const g1 = await dailyGuard(sb, U, 1000, DEFAULT_PARAMS); const g2 = await dailyGuard(sb, U, 940, DEFAULT_PARAMS);
    ok(!g1.halted && g2.halted, 'limite diário não travou');
    ex.setPrice('ETH/USDT', 50);
    await enter(sb, ex, U, 'ETH/USDT', 50, 1000, 900, DEFAULT_PARAMS, 0.8, 'e2e');
    const c = await closeAllPositions(sb, ex, U);
    ok(c.closed === 1, 'fechar todas falhou');
    return 'ciclo completo OK (corretora SIMULADA; no modo real use testnet + E2E_BINANCE_*)';
  });

  // ---------------------------------------------------------------- 8. relatório diário (template)
  await step('8. Relatório diário: template de e-mail no tema terminal', async () => {
    const pnl = sb.rows('trades').reduce((a: number, t: any) => a + Number(t.pnl ?? 0), 0);
    const html = emailLayout('relatório de hoje', `<p>P&L realizado: <b style="color:#3ddc84">${pnl.toFixed(2)} USDT</b></p><p>Trades fechados: ${sb.rows('trades').filter((t: any) => t.status === 'closed').length}</p>`);
    mkdirSync('docs', { recursive: true });
    writeFileSync('docs/email-preview.html', html);
    ok(html.includes('HEXADESK') && html.includes('Não é recomendação'), 'template sem marca/aviso');
    return 'docs/email-preview.html gerado (envio real exige RESEND_API_KEY)';
  });

  console.log('\n=== E2E', mock ? '(modo --mock)' : '(sandbox real)', '===');
  for (const r of results) console.log(`${r.status === 'PASSOU' ? '✔' : r.status === 'PULADA' ? '○' : '✖'} ${r.status.padEnd(7)} ${r.step}\n    ${r.note}`);
  const failed = results.filter((r) => r.status === 'FALHOU').length;
  console.log(`\n${results.filter((r) => r.status === 'PASSOU').length} passaram, ${results.filter((r) => r.status === 'PULADA').length} puladas, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main();
