import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';

export const runtime = 'nodejs';

/** Snapshot completo do ao vivo (estado inicial da tela e contingência quando o canal em tempo real cai). Só o dono. */
export async function GET() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { data } = await g.data.admin.from('b3_live').select('ts,data').eq('id', 1).maybeSingle();
  return NextResponse.json({ ts: data?.ts ?? null, snapshot: data?.data ?? null }, { headers: { 'cache-control': 'no-store' } });
}
