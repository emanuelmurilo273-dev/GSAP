import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { REAL_PHRASE, realChecklist } from '@/lib/b3';
import { auditOwner } from '@/lib/owner';

/** Trocar de modo. REAL só com TODAS as condições, verificadas aqui no servidor (o painel sozinho não decide). */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const b = await req.json().catch(() => ({}));
  const who = { id: g.data.userId, email: g.data.email };

  if (b.action === 'back_to_sim') {
    await admin.from('b3_settings').update({ mode: 'sim', real_unlocked: false, enabled: false, updated_at: new Date().toISOString() }).eq('id', 1);
    await admin.from('b3_commands').insert({ command: 'panic' });
    await admin.from('b3_logs').insert({ level: 'warn', agent: 'risk', message: 'Voltando ao SIMULADOR: robô desligado e posições sendo zeradas.' });
    await auditOwner(admin, who, 'b3.back_to_sim', {}, req);
    return NextResponse.json({ ok: true, mode: 'sim' });
  }

  if (b.action === 'unlock_real') {
    const c = await realChecklist(admin);
    const missing: string[] = [];
    if (!c.strategyApproved) missing.push('nenhuma estratégia foi aprovada nos testes (STRATEGY_APPROVED=false)');
    if (!c.simSessionsOk) missing.push(`só ${c.simSessions} de ${c.needSessions} pregões válidos no simulador`);
    if (b.confirm1 !== true || b.confirm2 !== true) missing.push('as duas confirmações na tela');
    if (b.phrase !== REAL_PHRASE) missing.push(`digitar exatamente "${REAL_PHRASE}"`);
    if (missing.length) {
      await auditOwner(admin, who, 'b3.unlock_real.denied', { missing }, req);
      return NextResponse.json({ error: `Modo REAL bloqueado. Falta: ${missing.join('; ')}.`, missing }, { status: 412 });
    }
    await admin.from('b3_settings').update({ mode: 'real', real_unlocked: true, real_unlocked_at: new Date().toISOString(), enabled: false, updated_at: new Date().toISOString() }).eq('id', 1);
    await admin.from('b3_logs').insert({ level: 'warn', agent: 'risk', message: 'MODO REAL liberado pelo dono. Robô DESLIGADO: ligue manualmente.' });
    await auditOwner(admin, who, 'b3.unlock_real', {}, req);
    return NextResponse.json({ ok: true, mode: 'real' });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
