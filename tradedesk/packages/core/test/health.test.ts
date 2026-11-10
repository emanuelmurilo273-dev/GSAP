import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSummary, healthOf } from '../src/health';

const rep = (xs: number[], k: number) => Array.from({ length: k }, () => xs).flat();

test('expectativa = %acerto × ganho médio − %erro × perda média', () => {
  const h = healthOf(rep([40, -30, -30, 40, -30], 8));          // 40 operações: 16 ganhos de 40, 24 perdas de 30
  assert.equal(h.n, 40);
  assert.ok(Math.abs(h.expectancy - (0.4 * 40 - 0.6 * 30)) < 1e-9);   // = -2
  assert.equal(h.light, 'vermelho');
});
test('poucos dados = cinza, nunca verde nem vermelho', () => assert.equal(healthOf([10, 20, -5]).light, 'cinza'));
test('lucro sem prova (amostra pequena) = amarelo, não verde', () => {
  const h = healthOf(rep([50, -20, 30, -40, 25], 8));
  assert.ok(h.expectancy > 0); assert.equal(h.light, 'amarelo');
});
test('verde só com ≥100 operações e margem de erro acima de zero', () => {
  const h = healthOf(rep([30, 30, -10, 25, -10], 30));          // 150 operações, lucro folgado
  assert.equal(h.n, 150); assert.equal(h.light, 'verde');
  const sorte = healthOf(rep([100, -90, -80, -70, 330, -60], 20));
  assert.notEqual(sorte.light, 'verde');
});
test('fase recente ruim rebaixa o verde para amarelo', () => {
  const h = healthOf([...rep([30, 30, -10, 25, -10], 30), ...rep([-40], 20)]);
  assert.equal(h.light === 'verde', false);
});
test('prejuízo comprovado com ≥30 operações', () => {
  const h = healthOf(rep([-30, -25, 10, -35], 15));
  assert.equal(h.light, 'vermelho'); assert.match(h.reasons[0], /comprovado/);
});

test('resumo diário: resultado, modo, saúde e motivo da parada — sem maquiar prejuízo', () => {
  const r = buildSummary({ dayPnl: -120, tradesToday: 3, real: false, pnls: rep([-30, 20, -25, -10], 20), stopReason: '2 perdas seguidas' });
  assert.match(r.title, /−R\$ 120,00/); assert.match(r.title, /vermelho/);
  assert.ok(r.lines.some((l) => /SIMULADOR/.test(l)) && r.lines.some((l) => /2 perdas seguidas/.test(l)) && r.lines.some((l) => /Perdendo dinheiro/.test(l)));
  const v = buildSummary({ dayPnl: 90, tradesToday: 2, real: true, pnls: [], stopReason: null });
  assert.ok(v.lines.some((l) => /DINHEIRO REAL/.test(l)) && v.lines.some((l) => /Ainda não há operações/.test(l)));
});
