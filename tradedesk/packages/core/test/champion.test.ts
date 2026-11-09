import assert from 'node:assert/strict';
import test from 'node:test';
import { compare, metricsOf } from '../src/champion';

const mk = (pnls: number[], perDay = 3) => pnls.map((pnl, i) => ({ day: `2026-11-${String(1 + Math.floor(i / perDay)).padStart(2, '0')}`, pnl }));

test('métricas: fator de lucro, drawdown, sessões e Sharpe', () => {
  const m = metricsOf(mk([10, -5, 10, -20, 5, 5]));
  assert.equal(m.trades, 6); assert.equal(m.sessions, 2); assert.equal(m.pnl, 5);
  assert.equal(m.profitFactor, 30 / 25);
  assert.equal(m.maxDrawdown, 20);                 // equity: 10,5,15,-5,0,5 → pico 15, fundo -5

  assert.equal(metricsOf([]).profitFactor, null);
});

// pnl com variação entre os dias (senão o desvio-padrão diário é zero e o Sharpe fica sem sentido)
const varied = (n: number, delta = 0) => mk(Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 20 : -9) * (1 + (Math.floor(i / 3) % 4) * 0.25) + delta), 3);

test('desafiante só passa se for melhor em TUDO, com pregões e operações suficientes', () => {
  const champ = varied(60);                          // 20 pregões, 60 operações
  assert.equal(compare(champ, varied(60, +1)).canPromote, true);    // +1 por operação: melhor em PF, drawdown e Sharpe
  const r = compare(champ, varied(60, -1));
  assert.equal(r.canPromote, false);
  assert.match(r.reasons.join(';'), /fator de lucro/);
});

test('poucos pregões ou poucas operações bloqueiam, mesmo com resultado melhor', () => {
  const champ = mk(Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? 20 : -9)), 3);
  const few = mk([30, 30, 30, -5, 30, 30], 3);
  const r = compare(champ, few);
  assert.equal(r.canPromote, false);
  assert.match(r.reasons.join(';'), /pregões/); assert.match(r.reasons.join(';'), /operações/);
});

test('drawdown pior bloqueia mesmo com fator de lucro melhor', () => {
  const champ = mk(Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 10 : -9)), 3);
  const risky = mk([...Array.from({ length: 29 }, () => 15), -400, ...Array.from({ length: 30 }, (_, i) => (i % 2 ? 40 : -5))], 3);
  const r = compare(champ, risky);
  assert.equal(r.canPromote, false);
  assert.match(r.reasons.join(';'), /drawdown/);
});
