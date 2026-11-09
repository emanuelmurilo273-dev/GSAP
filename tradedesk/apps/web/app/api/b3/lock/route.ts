import { UNLOCK_DIAG_PHRASE } from '@desk/core';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

/** Trava do modo real por diagnóstico. Só o dono (2FA) abre, digitando a frase. Abrir NÃO liga o real: só permite pedir a liberação normal depois. */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const who = { id: g.data.userId, email: g.data.email };
  const b = await req.json().catch(() => ({}));
  if (b.action === 'lock') {
    await admin.from('b3_settings').update({ real_locked: true, mode: 'sim', real_unlocked: false, real_limited: false, enabled: false, real_locked_reason: 'Travado pelo dono.', updated_at: new Date().toISOString() }).eq('id', 1);
    await admin.from('b3_commands').insert({ command: 'panic' });
    await auditOwner(admin, who, 'b3.lock', {}, req);
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'unlock') {
    if (String(b.phrase ?? '') !== UNLOCK_DIAG_PHRASE) return NextResponse.json({ error: `Digite exatamente "${UNLOCK_DIAG_PHRASE}".` }, { status: 412 });
    await admin.from('b3_settings').update({ real_locked: false, real_locked_reason: null, updated_at: new Date().toISOString() }).eq('id', 1);
    await admin.from('b3_logs').insert({ level: 'warn', agent: 'risk', message: 'Trava do diagnóstico aberta pelo dono. O modo REAL ainda exige as demais liberações.' });
    await auditOwner(admin, who, 'b3.unlock_diag', {}, req);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
