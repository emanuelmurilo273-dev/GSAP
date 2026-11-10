// Baixa candles de 15 min da Foxbit (BTC/ETH/SOL em reais) e reamostra para 1h e 4h. Uso: npx tsx research/baixar_foxbit.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import ccxt from 'ccxt';

type C = [number, number, number, number, number, number];
const MAP: Record<string, string> = { BTCBRL: 'BTC/BRL', ETHBRL: 'ETH/BRL', SOLBRL: 'SOL/BRL' };
const resample = (c: C[], ms: number): C[] => {
  const out: C[] = []; let cur: C | null = null, bucket = -1, n = 0; const need = ms / 900_000;
  for (const k of c) { const b = Math.floor(k[0] / ms); if (b !== bucket) { if (cur && n === need) out.push(cur); bucket = b; n = 0; cur = [b * ms, k[1], k[2], k[3], k[4], 0]; } cur![2] = Math.max(cur![2], k[2]); cur![3] = Math.min(cur![3], k[3]); cur![4] = k[4]; cur![5] += k[5]; n++; }
  if (cur && n === need) out.push(cur); return out;
};
(async () => {
  mkdirSync('research/data', { recursive: true });
  const ex = new (ccxt as any).foxbit({ enableRateLimit: true });
  const end = Math.floor(Date.now() / (4 * 3600_000)) * 4 * 3600_000, start = end - 3 * 365 * 86_400_000;
  for (const [file, sym] of Object.entries(MAP)) {
    const all = new Map<number, C>(); let since = start;
    for (let g = 0; g < 400 && since < end; g++) {
      const rows = (await ex.fetchOHLCV(sym, '15m', since, 1000)) as number[][];
      if (!rows?.length) { since += 1000 * 900_000; continue; }
      for (const r of rows) if (r[0] < end) all.set(r[0], [r[0], r[1], r[2], r[3], r[4], r[5]]);
      const last = rows[rows.length - 1][0]; if (last + 900_000 <= since) break; since = last + 900_000;
    }
    const c = [...all.values()].sort((a, b) => a[0] - b[0]);
    writeFileSync(`research/data/${file}_15m.json`, JSON.stringify(c));
    writeFileSync(`research/data/${file}_1h.json`, JSON.stringify(resample(c, 3600_000)));
    writeFileSync(`research/data/${file}_4h.json`, JSON.stringify(resample(c, 4 * 3600_000)));
    console.log(file, '15m:', c.length, c.length ? new Date(c[0][0]).toISOString().slice(0, 10) : '-', '→', c.length ? new Date(c[c.length - 1][0]).toISOString().slice(0, 10) : '-');
  }
})();
