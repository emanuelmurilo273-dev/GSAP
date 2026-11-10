import assert from 'node:assert/strict';
import test from 'node:test';
import { cryptoAutopsy, exitKind, integrity, verdict, type CryptoRow } from '../src/autopsy';

const R = (i: number, pnl: number, o: Partial<CryptoRow> = {}): CryptoRow => ({ id: `t${i}`, symbol: 'BTC/BRL', entry_at: new Date(Date.UTC(2026, 9, 1 + (i % 20), 13)).toISOString(), exit_at: new Date(Date.UTC(2026, 9, 1 + (i % 20), 17)).toISOString(), qty: 0.001, entry_price: 400_000, exit_price: 400_000 + pnl * 1000, cost: 500, proceeds: 500 + pnl, pnl, fees: 5, exit_reason: pnl > 0 ? 'alvo atingido' : 'stop loss', score: 0.8, analysis: 'nota 0,8', stop_price: 388_000, target_price: 424_000, stop_order_id: 's', entry_order_id: `e${i}`, exit_order_id: `x${i}`, status: 'closed', testnet: false, ...o });

test('autópsia: fórmula da expectativa, custos e veredito honesto quando perde', () => {
  const rows = Array.from({ length: 400 }, (_, i) => R(i, i % 5 < 2 ? 30 : -25));
  const md = cryptoAutopsy(rows);
  assert.match(md, /Expectativa NEGATIVA/); assert.match(md, /o robô não tem vantagem/i);
  assert.match(md, /As 20 piores operações/); assert.match(md, /Por motivo de saída/);
  assert.equal(verdict(rows.map((r) => r.pnl!)).status, 'SEM VANTAGEM');
});

test('autópsia: testnet e operação sem ID de ordem NUNCA entram', () => {
  const md = cryptoAutopsy([R(1, 10, { testnet: true }), R(2, 10, { entry_order_id: null }), R(3, -5)]);
  assert.match(md, /\*\*1 operações/);
});

test('integridade: acha ordem duplicada, posição esquecida sem stop, mão grande e dia com excesso', () => {
  const old = new Date(Date.now() - 100 * 3600_000).toISOString();
  const rows = [R(1, 5, { entry_order_id: 'dup' }), R(2, 5, { entry_order_id: 'dup' }), R(3, 0, { status: 'open', entry_at: old, stop_order_id: null, exit_at: null, pnl: null, exit_order_id: null }), R(4, 5, { cost: 2000 }),
    ...Array.from({ length: 5 }, (_, i) => R(10 + i, 1, { entry_at: new Date(Date.UTC(2026, 9, 25, 10 + i)).toISOString() }))];
  const r = integrity(rows, { positionPct: 0.05, maxTradesPerDay: 3, equityAt: () => 10_000 });
  const bad = r.filter((x) => !x.ok).map((x) => x.msg).join(' | ');
  for (const rx of [/duplicadas/, /esquecida/, /SEM stop/, /mão maior/, /acima de 3/]) assert.match(bad, rx);
  assert.equal(integrity([R(1, 5)], { maxTradesPerDay: 3 }).every((x) => x.ok), true);
});

test('motivos de saída e veredito com poucos dados', () => {
  assert.equal(exitKind(R(1, 1, { exit_reason: 'trailing stop' })), 'trailing stop');
  assert.equal(exitKind(R(1, 1, { exit_reason: 'emergência' })), 'emergência');
  assert.equal(verdict([5, -3, 4]).status, 'SEM PROVA');
});
