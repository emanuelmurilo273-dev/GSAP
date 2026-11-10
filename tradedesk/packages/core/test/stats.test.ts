import assert from 'node:assert/strict';
import test from 'node:test';
import { computeStats, statementCsv, type StatTrade } from '../src/stats';

const T = (i: number, pnl: number, o: Partial<StatTrade> = {}): StatTrade => ({ id: String(i), market: 'cripto', symbol: 'BTC/BRL', side: 'buy', openedAt: `2026-11-0${1 + (i % 8)}T13:00:00Z`, closedAt: `2026-11-0${1 + (i % 8)}T15:00:00Z`, pnl, fees: 1, orderId: 'ord' + i, ...o });
const NOW = new Date('2026-11-08T18:00:00Z');       // domingo; semana começa em 02/11 (segunda)

test('métricas básicas: acerto, médias, expectativa (= %acerto × ganho médio − %erro × perda média), fator de lucro', () => {
  const s = computeStats([T(0, 30), T(1, -10), T(2, -10), T(3, 30), T(4, -10)], { now: NOW });
  assert.equal(s.n, 5); assert.equal(s.winRate, 0.4); assert.equal(s.avgWin, 30); assert.equal(s.avgLoss, 10);
  assert.ok(Math.abs((s.expectancy ?? 0) - (0.4 * 30 - 0.6 * 10)) < 1e-9);
  assert.equal(s.profitFactor, 60 / 30);
  assert.equal(s.net, 30);
});

test('sequências e drawdown (máximo e atual)', () => {
  const s = computeStats([T(0, 10), T(1, 10), T(2, 10), T(3, -5), T(4, -5), T(5, -20), T(6, 5)], { now: NOW, startEquity: 1000 });
  assert.equal(s.bestStreak, 3); assert.equal(s.worstStreak, 3);
  assert.equal(s.maxDrawdown, 30); assert.equal(s.currentDrawdown, 25);        // pico 30 → fundo 0 → hoje 5
  assert.ok(Math.abs((s.maxDrawdownPct ?? 0) - 30 / 1030) < 1e-9);
});

test('períodos: hoje, semana (segunda), mês, ano, total — dias negativos nunca somem', () => {
  const tr = [
    T(0, 100, { closedAt: '2026-10-20T15:00:00Z' }), T(1, -40, { closedAt: '2026-11-03T15:00:00Z' }),
    T(2, 25, { closedAt: '2026-11-08T15:00:00Z' }), T(3, -60, { closedAt: '2025-12-01T15:00:00Z' }),
  ];
  const s = computeStats(tr, { now: NOW });
  assert.equal(s.periods.hoje.pnl, 25); assert.equal(s.periods.semana.pnl, -15);
  assert.equal(s.periods.mes.pnl, -15); assert.equal(s.periods.ano.pnl, 85); assert.equal(s.periods.total.pnl, 25);
  assert.equal(s.negativeDays, 2); assert.equal(s.totalDays, 4);
  assert.deepEqual(s.calendar.map((d) => d.day), ['2025-12-01', '2026-10-20', '2026-11-03', '2026-11-08']);
});

test('custos separados do resultado e quebra por mercado / ativo / horário (Brasília)', () => {
  const tr = [T(0, 10, { market: 'b3', symbol: 'WINZ26', fees: 2 }), T(1, -4, { fees: 3 }), T(2, 6, { symbol: 'ETH/BRL', fees: 1 })];
  const s = computeStats(tr, { now: NOW });
  assert.equal(s.costs, 6); assert.equal(s.gross, 12 + 6);
  assert.deepEqual(s.byMarket.map((g) => [g.key, g.n]), [['B3', 1], ['Cripto', 2]]);
  assert.ok(s.bySymbol.some((g) => g.key === 'ETH/BRL'));
  assert.equal(s.byHour[0].key, '12h');                                        // 15:00 UTC = 12:00 em Brasília
});

test('extrato CSV: id da ordem, vírgula decimal, aspas e BOM para o Excel', () => {
  const csv = statementCsv([T(0, -12.5, { symbol: 'WIN"Z', orderId: 'abc;1' })]);
  assert.ok(csv.startsWith('﻿data_saida;'));
  assert.match(csv, /"WIN""Z"/); assert.match(csv, /"abc;1"/); assert.match(csv, /;-12,50;1,00;-11,50/);
  assert.equal(computeStats([]).expectancy, null);
});
