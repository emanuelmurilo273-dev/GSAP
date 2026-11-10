import assert from 'node:assert/strict';
import test from 'node:test';
import { cappedPositionSize, lossStreak, peakCheck } from '../src/protections';

test('tamanho: nunca arrisca mais de 1% do patrimônio no stop e nunca passa do saldo livre', () => {
  const eq = 10_000;
  const size = cappedPositionSize(eq, 10_000, 0.05, 0.03);              // 5% = 500; 1%/3% = 3.333 → vale 500
  assert.equal(size, 500);
  const wide = cappedPositionSize(eq, 10_000, 0.25, 0.003);             // stop curtíssimo: 1%/0,3% = 33.333 > 25% = 2.500
  assert.equal(wide, 2500);
  const tight = cappedPositionSize(eq, 10_000, 0.25, 0.2);              // stop de 20%: 1%/20% = 500 (corta o 25%)
  assert.equal(tight, 500);
  assert.ok(tight * 0.2 <= eq * 0.01 + 1e-9);                           // perda no stop ≤ 1%
  assert.equal(cappedPositionSize(eq, 100, 0.25, 0.03), 99);            // sem alavancagem: limitado ao saldo livre
  assert.equal(cappedPositionSize(0, 100, 0.05, 0.03), 0);
});

test('perdas seguidas contam do fim para trás', () => {
  assert.equal(lossStreak([]), 0); assert.equal(lossStreak([5, -1, -2]), 2); assert.equal(lossStreak([-1, -2, 3]), 0); assert.equal(lossStreak([0, -1]), 1);
});

test('pausa quando a conta cai 10% do pico (9,9% não pausa)', () => {
  assert.equal(peakCheck(null, 1000).breached, false);
  assert.equal(peakCheck(1200, 1080).breached, true);                    // exatamente 10%
  assert.equal(peakCheck(1200, 1081).breached, false);
  assert.equal(peakCheck(1000, 1500).peak, 1500);                        // pico sobe
  assert.equal(peakCheck(1500, 1349).breached, true);
});

import { ADX_MIN, MIN_RR, atrRules } from '../src/protections';
import { adx } from '../src/indicators';

test('stop técnico por ATR e alvo sempre ≥ 1:2', () => {
  const a = atrRules(0.01); assert.ok(Math.abs(a.stopPct - 0.015) < 1e-9); assert.ok(a.targetPct / a.stopPct >= MIN_RR - 1e-9);
  assert.equal(atrRules(0.0001).stopPct, 0.01);              // piso de 1%
  assert.equal(atrRules(0.2).stopPct, 0.06);                 // teto de 6%
  assert.ok(atrRules(0.02, 1).targetPct >= atrRules(0.02, 1).stopPct * 2 - 1e-9);   // pedir 1:1 vira 1:2
});

test('ADX: tendência forte passa de 20; mercado de vai-e-volta fica abaixo', () => {
  const mk = (f: (i: number) => number) => Array.from({ length: 200 }, (_, i) => { const c = f(i); return { t: i * 3600_000, o: c, h: c + 1, l: c - 1, c, v: 1 }; });
  const trend = adx(mk((i) => 100 + i * 1.5)), range = adx(mk((i) => 100 + (i % 2 ? 1 : -1) * 2));
  assert.ok(trend[199] > ADX_MIN, `tendência ${trend[199]}`); assert.ok(range[199] < ADX_MIN, `lateral ${range[199]}`);
});
