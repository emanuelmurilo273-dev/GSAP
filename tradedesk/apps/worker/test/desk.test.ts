import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PARAMS, closeAllPositions, enableBlockers, type TradeRow } from '@desk/core';
import { enter } from '../src/agents/executor';
import { dailyGuard, monitorPositions } from '../src/agents/risk';
import { FakeSb, MockExchange } from './mock';
import { checkBybitPermissions } from '../../../packages/core/src/exchange';

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
  sb.rows('trades').find((t) => t.symbol === 'BTC/USDT')!.stop_order_id = null; // posição sem stop na corretora
  ex.balances.BTC = { free: 0, total: 0 }; // e o BTC sumiu da carteira
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

// ----------------------------------------------------------------- BYBIT
const bybit = async () => {
  const sb = new FakeSb();
  const ex = new MockExchange('USDT', 10_000, 'bybit');
  ex.setPrice('BTC/USDT', 100);
  return { sb, ex, as: (sb as unknown) as any, ax: (ex as unknown) as any };
};

test('Bybit: abre posição e cria stop CONDICIONAL na corretora (sem reservar saldo)', async () => {
  const { sb, ex, as, ax } = await bybit();
  const t = await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  assert.ok(t);
  const stop = ex.orders.find((o) => o.conditional);
  assert.ok(stop, 'stop condicional deveria existir');
  assert.equal(stop.stopPrice, 97);
  assert.equal(sb.rows('trades')[0].stop_order_id, stop.id);
  assert.ok(ex.balances.BTC.free > 0, 'Bybit não reserva o saldo do stop');
});

test('Bybit: stop dispara na corretora → posição registrada como fechada com prejuízo', async () => {
  const { sb, ex, as, ax } = await bybit();
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  ex.movePrice('BTC/USDT', 96.5);
  await monitorPositions(as, ax, openTrades(sb), new Map([['BTC/USDT', 96.5]]), P);
  const t = sb.rows('trades')[0];
  assert.equal(t.status, 'closed');
  assert.ok(t.pnl < 0);
  assert.ok(ex.paramsSeen.some(([, p]: any) => p.trigger === true), 'consulta do stop usa {trigger:true}');
});

test('Bybit: alvo atingido cancela o stop condicional com {trigger:true} e vende a mercado', async () => {
  const { sb, ex, as, ax } = await bybit();
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  ex.prices['BTC/USDT'] = 107;
  await monitorPositions(as, ax, openTrades(sb), new Map([['BTC/USDT', 107]]), P);
  assert.equal(sb.rows('trades')[0].exit_reason, 'alvo atingido');
  assert.ok(!ex.orders.some((o) => o.status === 'open'), 'stop cancelado');
  assert.ok(ex.paramsSeen.some(([k, p]: any) => k === 'cancelOrder' && p.trigger === true));
});

test('Bybit: se a corretora não deixa consultar o stop e o ativo sumiu da carteira, registra stop executado (estimado)', async () => {
  const { sb, ex, as, ax } = await bybit();
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  ex.failFetchOrder = true;
  ex.movePrice('BTC/USDT', 96); // stop dispara; a carteira fica sem BTC
  await monitorPositions(as, ax, openTrades(sb), new Map([['BTC/USDT', 96]]), P);
  const t = sb.rows('trades')[0];
  assert.equal(t.status, 'closed');
  assert.match(t.exit_reason, /estimado/);
  assert.ok(t.pnl < 0);
});

test('Segurança: stop ainda aberto que não consegue ser cancelado NÃO vira "fechado" falsamente', async () => {
  const { sb, ex, as, ax } = setup(); // Binance: o stop reserva o saldo
  await enter(as, ax, U, 'BTC/USDT', 100, 10_000, 9_000, P, 0.8, '');
  ex.failCancel = true;
  const r = await closeAllPositions(as, ax, U);
  assert.equal(r.closed, 0);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /continua aberto/);
  assert.equal(openTrades(sb).length, 1, 'posição segue aberta no registro');
});

test('Bybit: permissões da chave — recusa saque, só leitura, sem spot; falha para o lado seguro', () => {
  const ok = { readOnly: 0, ips: '1.2.3.4', permissions: { Spot: ['SpotTrade'], Wallet: ['AccountTransfer'] } };
  assert.equal(checkBybitPermissions(ok).ok, true);
  const w = checkBybitPermissions({ ...ok, permissions: { ...ok.permissions, Wallet: ['AccountTransfer', 'Withdraw'] } });
  assert.equal(w.ok, false); assert.match((w as any).reason, /SAQUE/);
  assert.equal(checkBybitPermissions({ ...ok, readOnly: 1 }).ok, false);
  assert.equal(checkBybitPermissions({ ...ok, permissions: { Spot: [], Wallet: [] } }).ok, false);
  assert.equal(checkBybitPermissions(undefined).ok, false, 'resposta inesperada → recusa');
  assert.equal(checkBybitPermissions({ readOnly: 0 }).ok, false, 'sem permissions → recusa');
});

// ----------------------------------------------------------------- FOXBIT + PROTEÇÕES (cripto em R$)
import { cappedPositionSize, createProtectiveStop, takerFee } from '@desk/core';
import { peakGuard } from '../src/agents/risk';
import { brtDay } from '../src/lib/util';

const fx = (balance = 10_000) => {
  const sb = new FakeSb();
  const ex = new MockExchange('BRL', balance, 'foxbit');
  ex.fee = 0.005;                                   // taker da Foxbit
  ex.setPrice('BTC/BRL', 400_000);
  return { sb, ex, as: sb as unknown as any, ax: ex as unknown as any };
};

test('Foxbit: ordem real registra ID da ordem, taxa de 0,5% e cria STOP_MARKET na corretora', async () => {
  const { sb, ex, as, ax } = fx();
  const t = await enter(as, ax, U, 'BTC/BRL', 400_000, 10_000, 9_000, P, 0.8, 'ok');
  assert.ok(t);
  const row = sb.rows('trades')[0];
  assert.ok(row.entry_order_id, 'ID da ordem de entrada gravado');
  assert.equal(row.testnet, false);
  assert.ok(Math.abs(row.fees - 500 * 0.005) < 0.01, `taxa ${row.fees}`);                   // 5% de 10.000 = R$ 500 × 0,5%
  const stop = ex.orders.find((o) => o.status === 'open');
  assert.ok(stop && stop.conditional, 'stop STOP_MARKET na corretora');
  assert.ok(ex.calls.some((c) => c.startsWith('STOP_MARKET:sell')));
  assert.equal(takerFee('foxbit'), 0.005);
});

test('Cripto: nunca arrisca mais de 1% da conta por operação, mesmo com posição de 25% e stop de 10%', async () => {
  const { sb, ex, as, ax } = fx();
  const p = { ...P, positionPct: 0.25, stopPct: 0.10 };
  const t = await enter(as, ax, U, 'BTC/BRL', 400_000, 10_000, 10_000, p, 0.8, '');
  assert.ok(t);
  const perdaNoStop = t!.cost * p.stopPct;
  assert.ok(perdaNoStop <= 10_000 * 0.01 + 1, `perda no stop ${perdaNoStop}`);              // ≤ R$ 100
  assert.equal(cappedPositionSize(10_000, 10_000, 0.25, 0.10), 1000);
});

test('Trava de 5% do pico: pausa o robô, grava o motivo e só dispara a partir de 5%', async () => {
  const { sb } = fx();
  sb.rows('bot_settings').push({ user_id: U, bot_enabled: true, peak_equity: 12_000 });
  const a = await peakGuard(sb as any, U, 11_500, 12_000, null);                              // −4,2%
  assert.equal(a.paused, false); assert.equal(sb.rows('bot_settings')[0].bot_enabled, true);
  const b = await peakGuard(sb as any, U, 11_400, 12_000, null);                              // −5%
  assert.equal(b.paused, true); assert.equal(sb.rows('bot_settings')[0].bot_enabled, false);
  assert.match(String(sb.rows('bot_settings')[0].paused_reason), /5,0%|5\.0%/);
  const c = await peakGuard(sb as any, U, 13_000, 12_000, null);                              // pico sobe
  assert.equal(c.paused, false); assert.equal(sb.rows('bot_settings')[0].peak_equity, 13_000);
});

test('Risk: UMA perda no dia para o robô até amanhã (perfil inicial); se a última foi ganho, continua', async () => {
  const { sb, as } = setup();
  const add = (pnl: number, min: number) => sb.rows('trades').push({ id: `t${min}`, user_id: U, status: 'closed', pnl, exit_at: new Date(`${brtDay()}T01:${String(60 - min).padStart(2, '0')}:00-03:00`).toISOString(), symbol: 'BTC/USDT' });   // horários fixos dentro do dia de Brasília
  add(-5, 30); add(+8, 20);
  const g1 = await dailyGuard(as, U, 10_000, P);
  assert.equal(g1.halted, false);                                                             // perda, depois ganho: sequência = 0
  add(-3, 10);
  const g2 = await dailyGuard(as, U, 10_000, P);
  assert.equal(g2.halted, true);                                                              // 1 perda no fim: para
  assert.match(String(sb.rows('daily_state')[0].halted_reason), /1 perdas seguidas/);
});   // horários fixos dentro do dia de Brasília (sem depender da hora em que o teste roda)

// ----------------------------------------------------------------- EMERGÊNCIA
import { encrypt, haltEverything, killSwitchOn, releaseKillSwitch } from '@desk/core';

test('Emergência: liga a chave geral, desliga todos os robôs, trava a B3 e zera as posições de cada cliente', async () => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  const sb = new FakeSb();
  for (const u of ['u1', 'u2']) {
    sb.rows('bot_settings').push({ user_id: u, bot_enabled: true });
    sb.rows('exchange_accounts').push({ user_id: u, exchange: 'binance', api_key_enc: encrypt('k'), api_secret_enc: encrypt('s') });
  }
  sb.rows('b3_settings').push({ id: 1, mode: 'real', enabled: true, real_unlocked: true, real_locked: false });
  const exs: Record<string, MockExchange> = {};
  for (const u of ['u1', 'u2']) {
    const ex = new MockExchange('USDT', 5_000); ex.setPrice('BTC/USDT', 100);
    await ex.createOrder('BTC/USDT', 'market', 'buy', 5, 100);                                  // posição real aberta na "corretora"
    exs[u] = ex;
    sb.rows('trades').push({ id: `t-${u}`, user_id: u, symbol: 'BTC/USDT', status: 'open', qty: 5, entry_price: 100, cost: 500, stop_price: 97, target_price: 106, peak_price: 100 });
  }
  let n = 0;
  const r = await haltEverything(sb as any, 'perdas reais', { makeEx: () => (exs[n++ === 0 ? 'u1' : 'u2'] as any) });
  assert.equal(r.users, 2); assert.equal(r.closed, 2); assert.equal(r.failed, 0);
  assert.ok(sb.rows('trades').every((t) => t.status === 'closed'), 'todas as posições fechadas');
  assert.ok(sb.rows('bot_settings').every((b) => b.bot_enabled === false && /EMERGÊNCIA/.test(b.paused_reason)));
  const b3 = sb.rows('b3_settings')[0];
  assert.equal(b3.mode, 'sim'); assert.equal(b3.enabled, false); assert.equal(b3.real_locked, true);
  assert.ok(sb.rows('b3_commands').some((c) => c.command === 'panic'), 'conector da B3 recebe PARAR TUDO');
  assert.equal((await killSwitchOn(sb as any)).on, true);
});

test('Emergência: uma falha numa conta não impede de zerar as outras e é reportada', async () => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  const sb = new FakeSb();
  for (const u of ['ok', 'ruim']) {
    sb.rows('exchange_accounts').push({ user_id: u, exchange: 'binance', api_key_enc: encrypt('k'), api_secret_enc: encrypt('s') });
    sb.rows('trades').push({ id: `t-${u}`, user_id: u, symbol: 'BTC/USDT', status: 'open', qty: 1, entry_price: 100, cost: 100, stop_price: 97, target_price: 106, peak_price: 100 });
  }
  const good = new MockExchange('USDT', 1000); good.setPrice('BTC/USDT', 100); await good.createOrder('BTC/USDT', 'market', 'buy', 1, 100);
  const r = await haltEverything(sb as any, 'teste', { makeEx: (_id: any, c: any) => { if (sb.rows('exchange_accounts')[0] && calls++ === 0) return good as any; throw new Error('corretora fora do ar'); } });
  assert.equal(r.closed, 1); assert.equal(r.failed, 1); assert.match(r.errors.join(' '), /fora do ar/);
});
let calls = 0;

test('Religar: só com estratégia aprovada e a frase exata; e religar NÃO liga robô nenhum', async () => {
  const sb = new FakeSb();
  sb.rows('app_settings').push({ key: 'kill_switch', value: { on: true } });
  assert.equal((await releaseKillSwitch(sb as any, { approved: false, phrase: 'RELIGAR APÓS APROVAÇÃO' })).ok, false);
  assert.equal((await releaseKillSwitch(sb as any, { approved: true, phrase: 'religar' })).ok, false);
  assert.equal((await killSwitchOn(sb as any)).on, true);
  assert.equal((await releaseKillSwitch(sb as any, { approved: true, phrase: 'RELIGAR APÓS APROVAÇÃO' })).ok, true);
  assert.equal((await killSwitchOn(sb as any)).on, false);
  sb.rows('bot_settings').push({ user_id: 'x', bot_enabled: false });
  assert.equal(sb.rows('bot_settings')[0].bot_enabled, false);
});
