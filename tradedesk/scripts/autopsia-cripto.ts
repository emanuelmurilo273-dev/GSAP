/**
 * Autópsia das SUAS operações reais de cripto (lê o banco, não altera nada) → DIAGNOSTICO-CRIPTO-SEUS-DADOS.md
 *   docker compose run --rm --no-deps -v "%cd%:/out" web npx tsx scripts/autopsia-cripto.ts   (ou fora do Docker, com SUPABASE_URL e SUPABASE_KEY)
 */
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { cryptoAutopsy } from '../packages/core/src';

(async () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY;
  if (!url || !key) { console.error('Faltam SUPABASE_URL e SUPABASE_KEY.'); process.exit(1); }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows, error } = await sb.from('trades').select('*').order('entry_at', { ascending: true }).limit(100000);
  if (error) { console.error('Erro ao ler o banco:', error.message); process.exit(1); }
  const [{ data: st }, { data: snaps }] = await Promise.all([sb.from('bot_settings').select('position_pct').limit(1).maybeSingle(), sb.from('equity_snapshots').select('ts,equity').order('ts', { ascending: true }).limit(100000)]);
  const sn = (snaps ?? []).map((s: any) => [new Date(s.ts).getTime(), Number(s.equity)] as const);
  const equityAt = (iso: string) => { const t = new Date(iso).getTime(); let best: number | null = null; for (const [ts, e] of sn) { if (ts <= t) best = e; else break; } return best; };
  const md = `# Autópsia dos seus dados reais — cripto\n\nGerado em ${new Date().toLocaleString('pt-BR')}.\n\n` + cryptoAutopsy((rows ?? []) as any, { positionPct: Number(st?.position_pct ?? 0.05), maxTradesPerDay: Number(process.env.CRYPTO_MAX_TRADES_PER_DAY ?? 3), equityAt });
  const out = process.env.OUT ?? 'DIAGNOSTICO-CRIPTO-SEUS-DADOS.md';
  writeFileSync(out, md, 'utf8');
  console.log(`Pronto: ${out}`);
})();
