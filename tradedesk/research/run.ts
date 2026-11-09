// Pesquisa de estratégias com validação fora da amostra.
//   npx tsx research/run.ts select   → treino (60%) + walk-forward + validação (20%). NÃO enxerga o teste final.
//   npx tsx research/run.ts test     → teste final (20%), UMA vez por estratégia (trava em results/test.lock.json).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Candle } from '../packages/core/src/types';
import { buyHold, combine, dailyReturns, metrics, maxDrawdown, profitFactor, sharpe, simulate, type Signals, type Trade } from './engine';
import { FAMILIES, PAIRS, TIMEFRAMES, type Params } from './strategies';

mkdirSync('research/results', { recursive: true });
const phase = process.argv[2];
const SPLIT = { train: 0.6, val: 0.8 }; // fim do treino / fim da validação (fração do TEMPO total)
const MONTH = 30.44 * 86_400_000;

type Series = Record<string, Candle[]>;
function load(tf: string): { data: Series; t0: number; t1: number } {
  const data: Series = {};
  for (const p of PAIRS) data[p] = (JSON.parse(readFileSync(`research/data/${p}_${tf}.json`, 'utf8')) as number[][]).map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] }));
  const t0 = Math.max(...PAIRS.map((p) => data[p][0].t));
  const t1 = Math.min(...PAIRS.map((p) => data[p][data[p].length - 1].t)) + 1;
  for (const p of PAIRS) data[p] = data[p].filter((k) => k.t >= t0 && k.t < t1);
  return { data, t0, t1 };
}
const idxAt = (c: Candle[], t: number) => { let lo = 0, hi = c.length; while (lo < hi) { const m = (lo + hi) >> 1; if (c[m].t < t) lo = m + 1; else hi = m; } return lo; };

const objective = (trades: Trade[]) => {
  if (trades.length < 10) return 0;
  const pf = profitFactor(trades) ?? 0;
  return Math.min(Number.isFinite(pf) ? pf : 3, 3) * Math.min(1, Math.sqrt(trades.length / 30));
};

interface Eval { trades: Trade[]; parts: { times: number[]; equity: number[] }[] }
function evalRange(data: Series, sigs: Record<string, Signals>, tFrom: number, tTo: number): Eval {
  const trades: Trade[] = [];
  const parts = PAIRS.map((p) => {
    const c = data[p];
    const a = idxAt(c, tFrom), b = idxAt(c, tTo);
    const r = simulate(c, sigs[p], a, b);
    trades.push(...r.trades);
    return { times: r.times, equity: r.equity };
  });
  return { trades, parts };
}
const summarize = (e: Eval) => {
  const port = combine(e.parts);
  const wins = e.trades.filter((t) => t.ret > 0).length;
  return {
    trades: e.trades.length, winRate: e.trades.length ? wins / e.trades.length : null, pf: profitFactor(e.trades),
    ret: port.equity[port.equity.length - 1] - 1, maxDD: maxDrawdown(port.equity), sharpe: sharpe(dailyReturns(port.times, port.equity)),
    obj: objective(e.trades),
  };
};

// ===================================================================== SELECT
function select() {
  const out: any = { generatedAt: new Date().toISOString(), split: SPLIT, trials: 0, rows: [] as any[] };
  for (const tf of TIMEFRAMES) {
    const full = load(tf);
    const span = full.t1 - full.t0;
    const tTrain = full.t0 + span * SPLIT.train, tVal = full.t0 + span * SPLIT.val;
    // ISOLAMENTO: o teste final é removido da memória nesta fase
    const data: Series = {};
    for (const p of PAIRS) data[p] = full.data[p].filter((k) => k.t < tVal);
    for (const fam of FAMILIES) {
      const sigs: Record<string, Signals>[] = fam.grid.map((params) => Object.fromEntries(PAIRS.map((p) => [p, fam.build(data[p], params)])));
      out.trials += fam.grid.length;
      // treino completo
      const train = fam.grid.map((params, i) => ({ params, i, ...summarize(evalRange(data, sigs[i], full.t0, tTrain)) }));
      const ranked = [...train].sort((a, b) => b.obj - a.obj);
      const top = ranked.slice(0, 3);
      // walk-forward dentro do treino: otimiza 9 meses, testa 3 seguintes, avança 3
      const folds: any[] = [];
      const wfTrades: Trade[] = [];
      for (let s = full.t0; s + 12 * MONTH <= tTrain; s += 3 * MONTH) {
        const isFrom = s, isTo = s + 9 * MONTH, oosTo = Math.min(isTo + 3 * MONTH, tTrain);
        let best = -1, bestObj = -1;
        fam.grid.forEach((_, i) => { const o = summarize(evalRange(data, sigs[i], isFrom, isTo)).obj; if (o > bestObj) { bestObj = o; best = i; } });
        const oos = evalRange(data, sigs[best], isTo, oosTo);
        wfTrades.push(...oos.trades);
        const sm = summarize(oos);
        folds.push({ isFrom: new Date(isFrom).toISOString().slice(0, 10), oosFrom: new Date(isTo).toISOString().slice(0, 10), oosTo: new Date(oosTo).toISOString().slice(0, 10), params: fam.grid[best], isObj: bestObj, oosPf: sm.pf, oosTrades: sm.trades, oosRet: sm.ret });
      }
      const wf = { folds, pooledPf: profitFactor(wfTrades), trades: wfTrades.length, profitableFolds: folds.filter((f) => f.oosRet > 0).length };
      // validação dos 3 melhores do treino
      const val = top.map((t) => ({ params: t.params, train: strip(t), val: summarize(evalRange(data, sigs[t.i], tTrain, tVal)) }));
      const chosen = [...val].sort((a, b) => b.val.obj - a.val.obj)[0];
      out.rows.push({ family: fam.id, name: fam.name, tf, grid: fam.grid.length, wf, candidates: val, chosen });
      console.log(`${fam.id.padEnd(9)} ${tf.padEnd(3)} val PF=${fmt(chosen.val.pf)} n=${chosen.val.trades} ret=${(chosen.val.ret * 100).toFixed(1)}%  | WF PF=${fmt(wf.pooledPf)} n=${wf.trades}`);
    }
  }
  // 1 candidata por família: o timeframe com melhor desempenho na VALIDAÇÃO (decisão tomada antes de ver o teste)
  out.finalists = FAMILIES.map((f) => {
    const rows = out.rows.filter((r: any) => r.family === f.id);
    const best = rows.sort((a: any, b: any) => b.chosen.val.obj - a.chosen.val.obj)[0];
    return { family: f.id, name: f.name, tf: best.tf, params: best.chosen.params, valObj: best.chosen.val.obj };
  });
  writeFileSync('research/results/select.json', JSON.stringify(out, null, 1));
  console.log('\nfinalistas:', JSON.stringify(out.finalists.map((x: any) => `${x.family}@${x.tf}`)));
}
const strip = (t: any) => { const { params, i, ...rest } = t; return rest; };
const fmt = (x: number | null) => (x == null ? '—' : Number.isFinite(x) ? x.toFixed(2) : '∞');

// ===================================================================== TEST
function test() {
  const lock = 'research/results/test.lock.json';
  if (existsSync(lock)) { console.error('TESTE FINAL JÁ EXECUTADO (research/results/test.lock.json). Rodar de novo invalidaria a validação. Abortando.'); process.exit(1); }
  const sel = JSON.parse(readFileSync('research/results/select.json', 'utf8'));
  const res: any[] = [];
  for (const f of sel.finalists) {
    const fam = FAMILIES.find((x) => x.id === f.family)!;
    const full = load(f.tf);
    const span = full.t1 - full.t0;
    const tVal = full.t0 + span * SPLIT.val;
    const sigs = Object.fromEntries(PAIRS.map((p) => [p, fam.build(full.data[p], f.params as Params)]));
    const ev = evalRange(full.data, sigs, tVal, full.t1);
    const port = combine(ev.parts);
    const sm = summarize(ev);
    const perPair = PAIRS.map((p, i) => ({ pair: p, ...metrics({ trades: ev.trades.filter(() => false), equity: ev.parts[i].equity, times: ev.parts[i].times }), ret: ev.parts[i].equity.at(-1)! - 1 }));
    const bhParts = PAIRS.map((p) => { const c = full.data[p]; return buyHold(c, idxAt(c, tVal), c.length); });
    const bh = combine(bhParts);
    const bhSharpe = sharpe(dailyReturns(bh.times, bh.equity));
    const bhRet = bh.equity.at(-1)! - 1, bhDD = maxDrawdown(bh.equity);
    const profitablePairs = perPair.filter((p) => p.ret > 0).length;
    const checks = {
      pf: { value: sm.pf, need: '>= 1.3', ok: (sm.pf ?? 0) >= 1.3 },
      maxDD: { value: sm.maxDD, need: '<= 20%', ok: sm.maxDD <= 0.2 },
      trades: { value: sm.trades, need: '>= 100', ok: sm.trades >= 100 },
      pairs: { value: profitablePairs, need: '>= 2 de 3', ok: profitablePairs >= 2 },
      sharpe: { value: sm.sharpe, need: `> buy&hold (${bhSharpe.toFixed(2)})`, ok: sm.sharpe > bhSharpe },
    };
    const approved = Object.values(checks).every((c) => c.ok);
    res.push({ ...f, test: sm, perPair, buyHold: { ret: bhRet, maxDD: bhDD, sharpe: bhSharpe }, checks, approved,
      from: new Date(tVal).toISOString().slice(0, 10), to: new Date(full.t1).toISOString().slice(0, 10) });
    console.log(`${f.family.padEnd(9)} @${f.tf}  PF=${fmt(sm.pf)} DD=${(sm.maxDD * 100).toFixed(1)}% n=${sm.trades} pares+=${profitablePairs} Sharpe=${sm.sharpe.toFixed(2)} (B&H ${bhSharpe.toFixed(2)})  => ${approved ? 'APROVADA' : 'reprovada'}`);
  }
  writeFileSync('research/results/test.json', JSON.stringify({ ranAt: new Date().toISOString(), results: res }, null, 1));
  writeFileSync(lock, JSON.stringify({ ranAt: new Date().toISOString(), note: 'O teste final foi executado uma única vez por estratégia.' }));
}

if (phase === 'select') select();
else if (phase === 'test') test();
else { console.error('uso: run.ts select | test'); process.exit(1); }
