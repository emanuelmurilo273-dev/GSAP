import { computeStats } from '@desk/core';
import { Logo } from '@/components/Logo';
import StatsView from '@/components/StatsView';
import { loadRealTrades, ownerIds } from '@/lib/stats';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const revalidate = 300;
export const metadata = { title: 'Resultados reais' };

/** Página pública: histórico COMPLETO das operações reais do robô (contas do dono), desde a primeira, sem filtrar períodos nem dias negativos. */
export default async function Page() {
  let s: ReturnType<typeof computeStats> | null = null, excluded = 0, since: string | null = null;
  try { const admin = supabaseAdmin(); const r = await loadRealTrades(admin, { owners: await ownerIds(admin) }); s = computeStats(r.trades); excluded = r.excluded; since = s.firstTradeAt; } catch { /* sem banco */ }
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Logo />
      <h1 className="text-3xl font-semibold tracking-tight">Resultados reais</h1>
      <p className="max-w-2xl text-sm text-dim">São as operações reais do próprio robô, executadas na corretora, cada uma com o ID da ordem. <b className="text-ink">Nada é omitido</b>: todos os dias aparecem, os negativos também; nada de teste, simulação ou laboratório entra aqui.</p>
      <StatsView stats={s as any} excluded={excluded} since={since} />
      <p className="text-center text-xs text-dim">Operações em renda variável podem gerar perdas. Resultados passados não garantem resultados futuros.</p>
    </main>
  );
}
