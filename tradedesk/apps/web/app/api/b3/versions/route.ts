import { compare } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

/** Promover um desafiante a campeão (um clique do dono) — o SERVIDOR confere as regras e RECUSA se não passar. Nada é automático. */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const who = { id: g.data.userId, email: g.data.email };
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  const { data: v } = await admin.from('strategy_versions').select('*').eq('id', id).maybeSingle();
  if (!v) return NextResponse.json({ error: 'versão não encontrada' }, { status: 404 });

  if (b.action === 'retire') {
    if (v.role === 'champion') return NextResponse.json({ error: 'o campeão não pode ser aposentado sem um substituto' }, { status: 409 });
    await admin.from('strategy_versions').update({ role: 'retired' }).eq('id', id);
    await auditOwner(admin, who, 'b3.version.retire', { id }, req);
    return NextResponse.json({ ok: true });
  }
  if (b.action !== 'promote' || v.role !== 'challenger') return NextResponse.json({ error: 'ação inválida' }, { status: 400 });

  const { data: champ } = await admin.from('strategy_versions').select('*').eq('role', 'champion').maybeSingle();
  if (!champ) return NextResponse.json({ error: 'sem campeão atual' }, { status: 409 });
  const [a, c] = await Promise.all([
    admin.from('b3_shadow_trades').select('day,pnl').eq('version_id', champ.id).eq('source', 'mt5').limit(20000),
    admin.from('b3_shadow_trades').select('day,pnl').eq('version_id', id).eq('source', 'mt5').limit(20000),
  ]);
  const r = compare((a.data ?? []).map((t: any) => ({ day: t.day, pnl: Number(t.pnl) })), (c.data ?? []).map((t: any) => ({ day: t.day, pnl: Number(t.pnl) })));
  if (!r.canPromote) {
    await auditOwner(admin, who, 'b3.version.promote.denied', { id, reasons: r.reasons }, req);
    return NextResponse.json({ error: `Não dá para promover. Falta: ${r.reasons.join('; ')}.`, reasons: r.reasons }, { status: 412 });
  }
  await admin.from('strategy_versions').update({ role: 'retired' }).eq('id', champ.id);   // índice único: só 1 campeão
  await admin.from('strategy_versions').update({ role: 'champion' }).eq('id', id);
  await admin.from('b3_logs').insert({ level: 'info', agent: 'analyst', message: `Versão "${v.name}" promovida a CAMPEÃ pelo dono (substitui "${champ.name}"). O conector carrega em até 30 s.` });
  await auditOwner(admin, who, 'b3.version.promote', { id, from: champ.id, comparison: r }, req);
  return NextResponse.json({ ok: true });
}
