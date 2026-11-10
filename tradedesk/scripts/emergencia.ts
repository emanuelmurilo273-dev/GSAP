/**
 * EMERGÊNCIA pela linha de comando (não precisa do site): desliga TODOS os robôs, trava o real, manda a B3 zerar e vende a mercado as posições
 * de cripto de cada cliente.   docker compose run --rm --no-deps web npx tsx scripts/emergencia.ts "motivo"
 * (ou, fora do Docker, com SUPABASE_URL, SUPABASE_KEY e ENCRYPTION_KEY no ambiente: npx tsx scripts/emergencia.ts "motivo")
 */
import { createClient } from '@supabase/supabase-js';
import { haltEverything } from '../packages/core/src';

(async () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY;
  if (!url || !key) { console.error('Faltam SUPABASE_URL e SUPABASE_KEY.'); process.exit(1); }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const reason = process.argv.slice(2).join(' ') || 'emergência acionada pelo dono';
  console.log('Desligando tudo e zerando posições...');
  const r = await haltEverything(sb, reason);
  console.log(`Chave geral LIGADA. Robôs desligados. Posições de cripto fechadas: ${r.closed} · falhas: ${r.failed}`);
  for (const e of r.errors) console.log('  FALHA:', e);
  if (r.failed) console.log('\nATENÇÃO: o que falhou precisa ser fechado NA MÃO no app/site da corretora.');
  console.log('A B3: o conector zera as posições em poucos segundos (se estiver rodando). Se não estiver, feche no app da Clear.');
})();
