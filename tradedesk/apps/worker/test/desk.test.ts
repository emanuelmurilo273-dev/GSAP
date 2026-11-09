import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PARAMS, closeAllPositions, enableBlockers, type TradeRow } from '@desk/core';
import { enter } from '../src/agents/executor';
import { dailyGuard, monitorPositions } from '../src/agents/risk';
import { FakeSb, MockExchange } from './mock';

const U = 'user-1';
const P = { ...DEFAULT_PARAMS }; // stop 3%, alvo 6%, trailing 2%, 5%/trade, perda diária 5%
const setup = (balance = 10_000) => {
  const sb = new FakeSb();
  const ex = new MockExchange('USDT', balance);
  ex.setPrice('BTC/USDT', 100);
  return { sb, ex, as: (sb as unknown) as any, ax: (ex as unknown) as any };
};
const openTrades = (sb: FakeSb) => sb.rows('trades').filter((t) => t.status === 'open') as TradeRow[];

// ----------------------------------------------------------------- EXECUTOR
test('Executor: abre posição com 5% do saldo, stop -3%, alvo +6% e stop protetor na corretora', async () => {
  const { sb, ex, as, ax } = setup();
  const t = await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 1_000_000 && 9_000, P, 0.8, 'ok');
  assert.ok(t);
  assert.ok(Math.abs(t!.cost - 500 * 1.001) < 0.01, `custo ${t!.cost}`); // 5% de 10.000 + taxa
  assert.equal(Math.round(t!.stop_price * 100) / 100, 97);
  assert.equal(Math.round(t!.target_price * 100) / 100, 106);
  assert.ok(t!.qty > 0);
  const stop = ex.orders.find((o) => o.status === 'open');
  assert.ok(stop, 'stop protetor deve existir na corretora');
  assert.equal(stop.stopPrice, 97);
  assert.equal(sb.rows('trades')[0].stop_order_id, stop.id);
});

test('Executor: tamanho nunca passa do saldo livre', async () => {
  const { ex, as, ax } = setup(10_000);
  const t = await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 100, P, 0.8, ''); // só 100 livres
  assert.ok(t);
  assert.ok(t!.cost <= 100, `custo ${t!.cost}`);
  assert.ok(ex.balances.USDT.free >= 0);
});

test('Executor: recusa ordem abaixo do mínimo da corretora (sem enviar ordem)', async () => {
  const { sb, ex, as, ax } = setup(100);
  const t = await enter(as, ax, U, 'BTC/USDT', 100, 100, 100, P, 0.8, ''); // 5% de 100 = 5 < mínimo 10
  assert.equal(t, null);
  assert.equal(ex.calls.length, 0);
  assert.ok(sb.rows('bot_logs').some((l) => l.level === 'refuse'));
});

test('Executor: se o stop protetor falhar, fecha a posição na hora (nunca fica sem proteção)', async () => {
  const { sb, ex, as, ax } = setup();
  ex.failStop = true;
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  const t = sb.rows('trades')[0];
  assert.equal(t.status, 'closed');
  assert.equal(t.exit_reason, 'sem stop protetor');
  assert.ok(ex.balances.BTC.total < 1e-6, 'sem BTC sobrando');
});

test('Executor: nunca faz preço médio (índice único de 1 posição aberta por par)', async () => {
  const { sb, ex, as, ax } = setup();
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  const second = await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  assert.equal(second, null);
  assert.equal(openTrades(sb).length, 1);
  assert.ok(sb.rows('bot_logs').some((l) => /NÃO registrada/.test(l.message)), 'o descasamento é logado para intervenção');
});

// ----------------------------------------------------------------- RISK
async function opened() {
  const s = setup();
  await enter(s.as, s.ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  return s;
}
const prices = (p: number) => new Map([['BTC/USDT', p]]);

test('Risk: stop executado na corretora é detectado e registrado com prejuízo', async () => {
  const { sb, ex, as, ax } = await opened();
  ex.movePrice('BTC/USDT', 96.9); // dispara o STOP_LOSS_LIMIT
  await monitorPositions(as, ax, openTrades(sb), prices(96.9), P);
  const t = sb.rows('trades')[0];
  assert.equal(t.status, 'closed');
  assert.match(t.exit_reason, /stop/);
  assert.ok(t.pnl < 0);
});

test('Risk: preço abaixo do stop sem execução da ordem → cancela stop e vende a mercado', async () => {
  const { sb, ex, as, ax } = await opened();
  ex.prices['BTC/USDT'] = 96; // gap: preço caiu sem o mock disparar a ordem
  await monitorPositions(as, ax, openTrades(sb), prices(96), P);
  const t = sb.rows('trades')[0];
  assert.equal(t.status, 'closed');
  assert.equal(t.exit_reason, 'stop loss');
  assert.equal(ex.orders.find((o) => o.status === 'open'), undefined, 'stop cancelado');
  assert.ok(ex.balances.BTC.total < 1e-6);
});

test('Risk: alvo +6% fecha no lucro e cancela o stop da corretora', async () => {
  const { sb, ex, as, ax } = await opened();
  ex.prices['BTC/USDT'] = 106.5;
  await monitorPositions(as, ax, openTrades(sb), prices(106.5), P);
  const t = sb.rows('trades')[0];
  assert.equal(t.exit_reason, 'alvo atingido');
  assert.ok(t.pnl > 0);
  assert.ok(!ex.orders.some((o) => o.status === 'open'));
});

test('Risk: trailing liga em +3%, acompanha o pico e sai quando recua 2%', async () => {
  const { sb, ex, as, ax } = await opened();
  ex.prices['BTC/USDT'] = 104; // +4%: ativa trailing, ainda sem alvo
  await monitorPositions(as, ax, openTrades(sb), prices(104), P);
  let t = sb.rows('trades')[0];
  assert.equal(t.status, 'open');
  assert.equal(t.trailing_active, true);
  assert.equal(t.peak_price, 104);
  ex.prices['BTC/USDT'] = 105.5; // novo pico, ainda abaixo do alvo (106)
  await monitorPositions(as, ax, openTrades(sb), prices(105.5), P);
  assert.equal(sb.rows('trades')[0].peak_price, 105.5);
  ex.prices['BTC/USDT'] = 103.3; // 105,5 × 0,98 = 103,39 → recuou além de 2%
  await monitorPositions(as, ax, openTrades(sb), prices(103.3), P);
  t = sb.rows('trades')[0];
  assert.equal(t.status, 'closed');
  assert.equal(t.exit_reason, 'trailing stop');
  assert.ok(t.pnl > 0, 'trailing garantiu lucro');
});

test('Risk: limite de perda diária (-5%) trava novas entradas e continua travado', async () => {
  const { sb, as } = setup();
  let g = await dailyGuard(as, U, 10_000, P); // registra o saldo inicial do dia
  assert.equal(g.halted, false);
  g = await dailyGuard(as, U, 9_600, P); // -4%: ainda opera
  assert.equal(g.halted, false);
  g = await dailyGuard(as, U, 9_490, P); // -5,1%: para
  assert.equal(g.halted, true);
  assert.ok(sb.rows('bot_logs').some((l) => /LIMITE DIÁRIO/.test(l.message)));
  g = await dailyGuard(as, U, 10_500, P); // mesmo se recuperar, fica parado até amanhã
  assert.equal(g.halted, true);
});

// ----------------------------------------------------------------- FECHAR TODAS / LIGAR-PAUSAR
test('Fechar todas: vende todas as posições abertas, cancela stops e zera a carteira', async () => {
  const { sb, ex, as, ax } = setup();
  ex.setPrice('ETH/USDT', 50);
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  await enter(as, ax, U, 'ETH/USDT', 50, 10_000, 8_000, P, 0.8, '');
  assert.equal(openTrades(sb).length, 2);
  const r = await closeAllPositions(as, ax, U);
  assert.equal(r.closed, 2);
  assert.equal(r.errors.length, 0);
  assert.equal(openTrades(sb).length, 0);
  assert.ok(!ex.orders.some((o) => o.status === 'open'));
  assert.ok(ex.balances.BTC.total < 1e-6 && ex.balances.ETH.total < 1e-6);
});

test('Fechar todas: falha em uma posição não impede as outras', async () => {
  const { sb, ex, as, ax } = setup();
  ex.setPrice('ETH/USDT', 50);
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  await enter(as, ax, U, 'ETH/USDT', 50, 10_000, 8_000, P, 0.8, '');
  ex.balances.BTC = { free: 0, total: 0 }; ex.orders.find((o) => o.symbol === 'BTC/USDT' && o.status === 'open')!.status = 'canceled'; // BTC sumiu da carteira
  const r = await closeAllPositions(as, ax, U);
  assert.equal(r.closed, 1);
  assert.equal(r.errors.length, 1);
  assert.equal(openTrades(sb).length, 1);
});

test('Ligar/pausar: só liga com corretora, backtest e termo; sem estratégia aprovada, só testnet/dono', () => {
  const ok = { account: { verified: true, attested_no_withdraw: false }, settings: { backtest_done_at: 'x', risk_accepted_at: 'x', risk_terms_version: '2026-11-01' } };
  delete process.env.STRATEGY_APPROVED; delete process.env.BINANCE_TESTNET;
  assert.ok(enableBlockers({ ...ok, isOwner: false }).some((m) => /modo real bloqueado/.test(m)), 'cliente bloqueado sem aprovação');
  assert.deepEqual(enableBlockers({ ...ok, isOwner: true }), [], 'dono pode validar com valor pequeno');
  process.env.BINANCE_TESTNET = 'true';
  assert.deepEqual(enableBlockers({ ...ok, isOwner: false }), [], 'testnet liberado');
  assert.equal(enableBlockers({ account: null, settings: null, isOwner: false }).length, 3);
  delete process.env.BINANCE_TESTNET;
  process.env.STRATEGY_APPROVED = 'true';
  assert.deepEqual(enableBlockers({ ...ok, isOwner: false }), []);
  delete process.env.STRATEGY_APPROVED;
});
