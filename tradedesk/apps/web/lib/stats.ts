import 'server-only';
import type { StatTrade } from '@desk/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Carrega SÓ operações REAIS fechadas, cada uma com o ID da ordem na corretora. Fora das estatísticas, sempre:
 * testnet, simulador interno, conta demo, laboratório, e qualquer operação sem ID de ordem (reportado em `excluded`).
 * scope = 'user' (cripto do cliente + B3 se for o dono) | 'public' (operações reais das contas do dono: o histórico do próprio robô).
 */
export async function loadRealTrades(admin: SupabaseClient, scope: { userId: string; includeB3: boolean } | { owners: string[] }) {
  const out: StatTrade[] = [];
  let excluded = 0;
  const owners = 'owners' in scope ? scope.owners : [];
  let q = admin.from('trades').select('id,symbol,entry_at,exit_at,pnl,fees,entry_order_id,exit_order_id,testnet,user_id').eq('status', 'closed').eq('testnet', false).not('pnl', 'is', null).limit(50000);
  q = 'owners' in scope ? q.in('user_id', owners.length ? owners : ['00000000-0000-0000-0000-000000000000']) : q.eq('user_id', scope.userId);
  const { data: ct } = await q;
  for (const t of ct ?? []) {
    if (!t.entry_order_id) { excluded++; continue; }
    out.push({ id: t.id, market: 'cripto', symbol: t.symbol, side: 'buy', openedAt: t.entry_at, closedAt: t.exit_at, pnl: Number(t.pnl), fees: Number(t.fees ?? 0), orderId: t.exit_order_id ? `${t.entry_order_id}→${t.exit_order_id}` : t.entry_order_id });
  }
  if ('owners' in scope || scope.includeB3) {
    const { data: bt } = await admin.from('b3_trades').select('id,contract,side,opened_at,closed_at,pnl,fees,ticket,source,mode').eq('status', 'closed').eq('mode', 'real').neq('source', 'internal').not('pnl', 'is', null).limit(50000);
    for (const t of bt ?? []) {
      if (t.ticket == null) { excluded++; continue; }
      out.push({ id: `b3-${t.id}`, market: 'b3', symbol: t.contract, side: t.side, openedAt: t.opened_at, closedAt: t.closed_at, pnl: Number(t.pnl), fees: Number(t.fees ?? 0), orderId: String(t.ticket) });
    }
  }
  return { trades: out, excluded };
}

export async function startEquity(admin: SupabaseClient, userId: string): Promise<number | null> {
  const { data } = await admin.from('equity_snapshots').select('equity').eq('user_id', userId).order('ts', { ascending: true }).limit(1).maybeSingle();
  return data?.equity ? Number(data.equity) : null;
}

export async function ownerIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.from('profiles').select('id').eq('role', 'owner');
  return (data ?? []).map((r) => r.id);
}
