import { statementCsv } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';
import { loadRealTrades } from '@/lib/stats';

export const runtime = 'nodejs';

/** Extrato em CSV com o ID de cada ordem, para conferir com as notas da corretora. */
export async function GET() {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin, isOwner } = g.data as any;
  const { trades } = await loadRealTrades(admin, { userId, includeB3: !!isOwner });
  return new NextResponse(statementCsv(trades), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="extrato-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
}
