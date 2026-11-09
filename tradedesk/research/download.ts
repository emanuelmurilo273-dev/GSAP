// Baixa 3 anos de candles de 15m (BTC/ETH/SOL x USDT) de data-api.binance.vision e reamostra p/ 1h e 4h.
// Uso: npx tsx research/download.ts
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const YEARS = 3;
const BASE = 'https://data-api.binance.vision/api/v3/klines';
type C = [number, number, number, number, number, number]; // t,o,h,l,c,v

async function klines(symbol: string, start: number, end: number): Promise<C[]> {
  const out: C[] = [];
  let t = start;
  while (t < end) {
    const url = `${BASE}?symbol=${symbol}&interval=15m&startTime=${t}&limit=1000`;
    let rows: any[] | null = null;
    for (let a = 0; a < 5 && !rows; a++) {
      const r = await fetch(url);
      if (r.ok) rows = await r.json();
      else await new Promise((s) => setTimeout(s, 1500 * (a + 1)));
    }
    if (!rows) throw new Error(`falha ao baixar ${symbol} em ${new Date(t).toISOString()}`);
    if (!rows.length) break;
    for (const k of rows) out.push([k[0], +k[1], +k[2], +k[3], +k[4], +k[5]]);
    t = rows[rows.length - 1][0] + 15 * 60_000;
    await new Promise((s) => setTimeout(s, 120));
  }
  return out;
}

function resample(c: C[], ms: number): C[] {
  const out: C[] = [];
  let cur: C | null = null;
  let bucket = -1;
  let n = 0;
  const need = ms / (15 * 60_000);
  for (const k of c) {
    const b = Math.floor(k[0] / ms);
    if (b !== bucket) {
      if (cur && n === need) out.push(cur); // só buckets completos
      bucket = b; n = 0;
      cur = [b * ms, k[1], k[2], k[3], k[4], 0];
    }
    cur![2] = Math.max(cur![2], k[2]); cur![3] = Math.min(cur![3], k[3]); cur![4] = k[4]; cur![5] += k[5]; n++;
  }
  if (cur && n === need) out.push(cur);
  return out;
}

async function main() {
  mkdirSync('research/data', { recursive: true });
  const end = Math.floor(Date.now() / (4 * 3600_000)) * 4 * 3600_000; // alinhado a 4h, só candles fechados
  const start = end - YEARS * 365 * 86_400_000;
  for (const p of PAIRS) {
    if (existsSync(`research/data/${p}_4h.json`)) { console.log('já existe', p); continue; }
    const c = await klines(p, start, end);
    const clean = c.filter((k, i) => i === 0 || k[0] > c[i - 1][0]).filter((k) => k[0] < end);
    writeFileSync(`research/data/${p}_15m.json`, JSON.stringify(clean));
    writeFileSync(`research/data/${p}_1h.json`, JSON.stringify(resample(clean, 3600_000)));
    writeFileSync(`research/data/${p}_4h.json`, JSON.stringify(resample(clean, 4 * 3600_000)));
    console.log(p, '15m:', clean.length, new Date(clean[0][0]).toISOString().slice(0, 10), '→', new Date(clean[clean.length - 1][0]).toISOString().slice(0, 10));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
