import { haltEverything, killSwitchOn, releaseKillSwitch, strategyApproved } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Só o dono. halt = DESLIGAR TUDO e zerar posições (cripto de todos os clientes + B3). release = tirar a chave geral (exige estratégia aprovada). */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data; const who = { id: g.data.userId, email: g.data.email };
  const b = await req.json().catch(() => ({}));
  if (b.action === 'halt') {
    const r = await haltEverything(admin, String(b.reason ?? 'acionada pelo dono').slice(0, 120));
    await auditOwner(admin, who, 'emergencia.halt', r, req);
    return NextResponse.json({ ok: true, ...r });
  }
  if (b.action === 'release') {
    const { data: ap } = await admin.from('app_settings').select('value').eq('key', 'b3_approval').maybeSingle();
    const approved = strategyApproved() || !!(ap?.value as any)?.approved;
    const r = await releaseKillSwitch(admin, { approved, phrase: String(b.phrase ?? '') });
    await auditOwner(admin, who, r.ok ? 'emergencia.release' : 'emergencia.release.denied', { error: r.error }, req);
    return NextResponse.json(r, { status: r.ok ? 200 : 412 });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}

export async function GET() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  return NextResponse.json(await killSwitchOn(g.data.admin));
}
