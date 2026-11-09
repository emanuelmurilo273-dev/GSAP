import { runOfficialBacktests } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  try {
    return NextResponse.json({ ok: true, out: await runOfficialBacktests(g.data.admin) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
