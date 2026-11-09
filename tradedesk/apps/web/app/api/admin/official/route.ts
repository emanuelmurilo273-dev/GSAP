import { runOfficialBacktests } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  try {
    const out = await runOfficialBacktests(g.data.admin);
    await auditOwner(g.data.admin, { id: g.data.userId, email: g.data.email }, 'admin.official_backtest', { out }, req);
    return NextResponse.json({ ok: true, out });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
