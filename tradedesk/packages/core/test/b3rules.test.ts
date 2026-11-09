import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMITED_CAPS, REAL_PHRASE, RISK_PHRASE, applyLimitedCaps, unlockDecision } from '../src/b3rules';

const ok = { strategyApproved: false, simSessions: 5, confirm1: true, confirm2: true, confirm3: true, phrase: REAL_PHRASE, riskPhrase: RISK_PHRASE };

test('sem estratégia aprovada: libera SÓ no modo limitado e com tudo cumprido', () => {
  const d = unlockDecision(ok);
  assert.equal(d.ok, true);
  assert.equal(d.limited, true);
  assert.equal(d.needSessions, 5);
});

test('cada exigência, sozinha, bloqueia', () => {
  for (const [patch, rx] of [
    [{ simSessions: 4 }, /4 de 5/], [{ confirm1: false }, /confirmações/], [{ confirm2: false }, /confirmações/],
    [{ confirm3: false }, /NÃO foi validada/], [{ phrase: 'operar real' }, /OPERAR REAL/], [{ riskPhrase: '' }, /ASSUMO/],
  ] as const) {
    const d = unlockDecision({ ...ok, ...patch });
    assert.equal(d.ok, false, JSON.stringify(patch));
    assert.match(d.missing.join(';'), rx);
  }
});

test('com estratégia aprovada: exige 20 pregões, não exige o modo limitado', () => {
  const a = { ...ok, strategyApproved: true, confirm3: false, riskPhrase: '' };
  assert.equal(unlockDecision({ ...a, simSessions: 19 }).ok, false);
  const d = unlockDecision({ ...a, simSessions: 20 });
  assert.equal(d.ok, true);
  assert.equal(d.limited, false);
});

test('tetos do modo limitado valem acima de qualquer configuração', () => {
  const s = applyLimitedCaps({ profile: 'agressivo', max_contracts: 30, daily_loss_brl: 5000, max_trades_per_day: 40, risk_per_trade_brl: 900, rr: 2 });
  assert.equal(s.max_contracts, LIMITED_CAPS.maxContracts);
  assert.equal(s.daily_loss_brl, 100);
  assert.equal(s.max_trades_per_day, 3);
  assert.equal(s.risk_per_trade_brl, 50);
  assert.equal(s.profile, 'conservador');
  assert.equal(s.rr, 2);                                   // o resto fica como está
  assert.equal(applyLimitedCaps({ ...s, daily_loss_brl: 40 }).daily_loss_brl, 40);   // valores MENORES são mantidos
});
