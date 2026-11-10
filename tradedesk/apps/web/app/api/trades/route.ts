import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';

export const runtime = 'nodejs';

/** Operações REAIS do usuário (abertas e fechadas) para o gráfico e o histórico. Nada de testnet. */
export async function GET() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin, isOwner } = g.data as any;
  const { data: c } = await admin.from('trades').select('id,symbol,status,qty,entry_price,exit_price,stop_price,target_price,entry_at,exit_at,pnl,pnl_pct,exit_reason,analysis,fees,entry_order_id,exit_order_id').eq('user_id', userId).eq('testnet', false).not('entry_order_id', 'is', null).order('entry_at', { ascending: false }).limit(300);
  let b: any[] = [];
  if (isOwner) {
    const r = await admin.from('b3_trades').select('id,contract,side,volume,price_open,price_close,sl,tp,opened_at,closed_at,pnl,close_reason,why,status,ticket,fees').eq('mode', 'real').neq('source', 'internal').not('ticket', 'is', null).order('opened_at', { ascending: false }).limit(300);
    b = r.data ?? [];
  }
  const rows = [
    ...((c ?? []) as any[]).map((t: any) => ({ id: t.id, market: 'cripto', symbol: t.symbol, side: 'buy', status: t.status, volume: Number(t.qty), entry: Number(t.entry_price), exit: t.exit_price == null ? null : Number(t.exit_price), stop: Number(t.stop_price), target: Number(t.target_price), openedAt: t.entry_at, closedAt: t.exit_at, pnl: t.pnl == null ? null : Number(t.pnl), reason: t.exit_reason, why: t.analysis, fees: Number(t.fees ?? 0), orderId: t.entry_order_id })),
    ...b.map((t: any) => ({ id: `b3-${t.id}`, market: 'b3', symbol: t.contract, side: t.side, status: t.status, volume: Number(t.volume), entry: Number(t.price_open), exit: t.price_close == null ? null : Number(t.price_close), stop: t.sl == null ? null : Number(t.sl), target: t.tp == null ? null : Number(t.tp), openedAt: t.opened_at, closedAt: t.closed_at, pnl: t.pnl == null ? null : Number(t.pnl), reason: t.close_reason, why: t.why, fees: Number(t.fees ?? 0), orderId: String(t.ticket) })),
  ].sort((a, z) => z.openedAt.localeCompare(a.openedAt));
  return NextResponse.json({ trades: rows }, { headers: { 'cache-control': 'no-store' } });
}
