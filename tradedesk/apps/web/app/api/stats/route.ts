import { computeStats } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';
import { loadRealTrades, startEquity } from '@/lib/stats';

export const runtime = 'nodejs';

/** Estatísticas reais do próprio usuário. ?mercado=b3|cripto filtra; sem filtro mostra tudo. Nada é filtrado por resultado. */
export async function GET(req: Request) {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin, isOwner } = g.data as any;
  const { trades, excluded } = await loadRealTrades(admin, { userId, includeB3: !!isOwner });
  const m = new URL(req.url).searchParams.get('mercado');
  const sel = m === 'b3' || m === 'cripto' ? trades.filter((t) => t.market === m) : trades;
  const se = await startEquity(admin, userId);
  return NextResponse.json({ stats: computeStats(sel, { startEquity: m === 'b3' ? null : se }), excluded, mercado: m ?? 'todos', hasB3: !!isOwner }, { headers: { 'cache-control': 'no-store' } });
}
