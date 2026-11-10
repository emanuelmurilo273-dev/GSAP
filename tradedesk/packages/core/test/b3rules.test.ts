import assert from 'node:assert/strict';
import test from 'node:test';
import { APPROVAL_RULES, REAL_PHRASE, approveStrategy, realContractCap, unlockDecision } from '../src/b3rules';

const ok = { approval: { approved: true, pf: 1.4, expectancy: 20 }, demo: { sessions: 30, trades: 60, pnl: 800, expectancy: 14 }, confirm1: true, confirm2: true, phrase: REAL_PHRASE };

test('libera só com TUDO verdadeiro', () => assert.equal(unlockDecision(ok).ok, true));

test('cada exigência, sozinha, bloqueia', () => {
  for (const [patch, rx] of [
    [{ approval: null }, /NÃO aprovada/], [{ approval: { approved: false } }, /NÃO aprovada/],
    [{ demo: { ...ok.demo, sessions: 29 } }, /29 de 30/], [{ demo: { ...ok.demo, trades: 10 } }, /operações/],
    [{ demo: { ...ok.demo, expectancy: 0 } }, /expectativa/], [{ demo: { ...ok.demo, expectancy: -3 } }, /expectativa/],
    [{ demo: { ...ok.demo, pnl: -1 } }, /resultado total/], [{ demo: { ...ok.demo, expectancy: 9 } }, /longe do esperado/],
    [{ confirm1: false }, /confirmações/], [{ confirm2: false }, /confirmações/], [{ phrase: 'operar real' }, /OPERAR REAL/],
  ] as const) {
    const d = unlockDecision({ ...ok, ...patch } as any);
    assert.equal(d.ok, false, JSON.stringify(patch));
    assert.match(d.missing.join(';'), rx);
  }
});

test('sem aprovação nenhum caminho "limitado" existe', () => {
  const d = unlockDecision({ ...ok, approval: null, demo: { sessions: 100, trades: 900, pnl: 9999, expectancy: 99 } });
  assert.equal(d.ok, false);
});

test('mão no real: 1 contrato até 30 pregões positivos; depois sobe devagar', () => {
  assert.equal(realContractCap(0, 0, 10), 1);
  assert.equal(realContractCap(29, 500, 10), 1);
  assert.equal(realContractCap(30, -1, 10), 1);          // 30 pregões mas no prejuízo
  assert.equal(realContractCap(30, 500, 10), 2);
  assert.equal(realContractCap(44, 500, 10), 2);
  assert.equal(realContractCap(45, 500, 10), 3);
  assert.equal(realContractCap(75, 500, 3), 3);          // nunca passa do que o dono pediu
  assert.equal(realContractCap(60, 500, 1), 1);
});

test('aprovação: PF ≥ 1,3, drawdown ≤ 10%, ≥ 300 trades, ativo ruim é desligado', () => {
  const good = { WIN: { pf: 1.5, dd: 0.1, trades: 200, pnl: 900 }, WDO: { pf: 1.2, dd: 0.1, trades: 150, pnl: 300 } };
  const a = approveStrategy(good, { pf: 1.35, dd: 0.08, trades: 350 });
  assert.equal(a.approved, true);
  const bad = approveStrategy({ ...good, WDO: { pf: 0.8, dd: 0.2, trades: 150, pnl: -200 } }, { pf: 1.35, dd: 0.08, trades: 350 });
  assert.equal(bad.approved, true); assert.deepEqual(bad.disabled, ['WDO']);       // aprovado só com o ativo bom; o ruim é desligado
  for (const t of [{ pf: 1.29, dd: 0.1, trades: 400 }, { pf: 1.5, dd: 0.11, trades: 400 }, { pf: 1.5, dd: 0.1, trades: 299 }]) assert.equal(approveStrategy(good, t).approved, false);
  assert.equal(approveStrategy({ WIN: { pf: 0.9, dd: 0.1, trades: 400, pnl: -5 } }, { pf: 1.5, dd: 0.1, trades: 400 }).approved, false);
  assert.equal(APPROVAL_RULES.minTrades, 300);
});
