import test from 'node:test';
import assert from 'node:assert/strict';
import { ema, rsi, macd, sma } from '../src/indicators';
import { runBacktest } from '../src/backtest';
import { encrypt, decrypt } from '../src/crypto';
import { hasAccess } from '../src/types';
import type { Candle } from '../src/types';

function synth(n: number, seed = 1, drift = 0.0002): Candle[] {
  let x = seed;
  const rnd = () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let p = 100;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const o = p;
    p = p * (1 + drift + (rnd() - 0.5) * 0.02 + Math.sin(i / 40) * 0.003);
    const h = Math.max(o, p) * (1 + rnd() * 0.004);
    const l = Math.min(o, p) * (1 - rnd() * 0.004);
    out.push({ t: 1_700_000_000_000 + i * 3_600_000, o, h, l, c: p, v: 100 + rnd() * 100 });
  }
  return out;
}

test('sma/ema/rsi sanity', () => {
  assert.equal(sma([1, 2, 3, 4], 2)[3], 3.5);
  assert.equal(ema([1, 2, 3, 4, 5], 5)[4], 3);
  const up = Array.from({ length: 40 }, (_, i) => i + 1);
  assert.ok(rsi(up)[39] > 99);
  const m = macd(up);
  assert.ok(m.hist.some((x) => !Number.isNaN(x)));
});

test('backtest: contabilidade consistente e sem posição presa', () => {
  const c = synth(3000);
  const r = runBacktest(c, { params: { minScore: 0.55 } as any });
  assert.ok(r.metrics.trades > 5, `poucos trades: ${r.metrics.trades}`);
  const sum = r.trades.reduce((a, t) => a + t.pnl, 0);
  assert.ok(Math.abs(sum - r.metrics.totalPnl) < 1e-6);
  assert.ok(r.metrics.maxDrawdownPct >= 0 && r.metrics.maxDrawdownPct < 1);
  for (const t of r.trades) assert.ok(t.exitT >= t.entryT);
});

test('backtest: taxas e slippage reduzem o resultado', () => {
  const c = synth(3000, 7);
  const free = runBacktest(c, { params: { minScore: 0.55 } as any, feePct: 0, slippagePct: 0 });
  const costly = runBacktest(c, { params: { minScore: 0.55 } as any, feePct: 0.002, slippagePct: 0.002 });
  assert.ok(free.metrics.totalPnl > costly.metrics.totalPnl);
});

test('backtest: stop limita a perda por trade (~stop + custos)', () => {
  const c = synth(3000, 3, -0.0003);
  const r = runBacktest(c, { params: { minScore: 0.5 } as any });
  const worst = Math.min(...r.trades.map((t) => t.pnlPct), 0);
  assert.ok(worst > -0.12, `pior trade ${worst}`); // gaps podem exceder -3%, mas não explodem
});

test('crypto AES-256-GCM: roundtrip e adulteração', () => {
  const key = Buffer.alloc(32, 7);
  const enc = encrypt('segredo-123', key);
  assert.equal(decrypt(enc, key), 'segredo-123');
  assert.notEqual(enc, encrypt('segredo-123', key));
  const parts = enc.split(':');
  parts[3] = Buffer.from('xxxxxxxxxxx').toString('base64');
  assert.throws(() => decrypt(parts.join(':'), key));
});

test('hasAccess', () => {
  assert.equal(hasAccess({ status: 'active', paid_until: null, overdue_since: null, blocked_by_admin: false }), true);
  assert.equal(hasAccess({ status: 'active', paid_until: null, overdue_since: null, blocked_by_admin: true }), false);
  assert.equal(hasAccess({ status: 'blocked', paid_until: null, overdue_since: null, blocked_by_admin: false }), false);
  assert.equal(hasAccess({ status: 'canceled', paid_until: new Date(Date.now() + 1e6).toISOString(), overdue_since: null, blocked_by_admin: false }), true);
  assert.equal(hasAccess(null), false);
});
