import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { killSwitchOn, unlockDecision } from '@desk/core';
import { realChecklist } from '@/lib/b3';
import { auditOwner } from '@/lib/owner';

/** Trocar de modo. REAL só com TODAS as condições, verificadas aqui no servidor (o painel sozinho não decide). */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const b = await req.json().catch(() => ({}));
  const who = { id: g.data.userId, email: g.data.email };

  if (b.action === 'back_to_sim') {
    await admin.from('b3_settings').update({ mode: 'sim', real_unlocked: false, real_limited: false, enabled: false, updated_at: new Date().toISOString() }).eq('id', 1);
    await admin.from('b3_commands').insert({ command: 'panic' });
    await admin.from('b3_logs').insert({ level: 'warn', agent: 'risk', message: 'Voltando ao SIMULADOR: robô desligado e posições sendo zeradas.' });
    await auditOwner(admin, who, 'b3.back_to_sim', {}, req);
    return NextResponse.json({ ok: true, mode: 'sim' });
  }

  if (b.action === 'unlock_real') {
    if ((await killSwitchOn(admin)).on) return NextResponse.json({ error: 'EMERGÊNCIA ativa: o real só volta depois da aprovação.' }, { status: 423 });
    const { data: lk } = await admin.from('b3_settings').select('real_locked').eq('id', 1).maybeSingle();
    if (lk?.real_locked !== false) {          // coluna ausente/true = TRAVADO (diagnóstico de perdas ainda não aprovado)
      await auditOwner(admin, who, 'b3.unlock_real.denied', { reason: 'real_locked' }, req);
      return NextResponse.json({ error: 'Modo REAL TRAVADO até você aprovar o diagnóstico de perdas (aba "Saúde do robô").' }, { status: 423 });
    }
    const c = await realChecklist(admin);
    const d = unlockDecision({ approval: c.approval, demo: c.demo, confirm1: b.confirm1 === true, confirm2: b.confirm2 === true, phrase: String(b.phrase ?? '') });
    if (!d.ok) {
      await auditOwner(admin, who, 'b3.unlock_real.denied', { missing: d.missing }, req);
      return NextResponse.json({ error: `Modo REAL bloqueado. Falta: ${d.missing.join('; ')}.`, missing: d.missing }, { status: 412 });
    }
    // no real o robô começa com 1 contrato (o conector impõe: realContractCap) e a trava de 10% do pico fica armada
    await admin.from('b3_settings').update({ mode: 'real', real_unlocked: true, real_limited: false, real_unlocked_at: new Date().toISOString(), enabled: false, updated_at: new Date().toISOString() }).eq('id', 1);
    await admin.from('app_settings').upsert({ key: 'b3_real_peak', value: null });
    await admin.from('b3_logs').insert({ level: 'warn', agent: 'risk', message: 'MODO REAL liberado pelo dono: começa com 1 contrato; se o saldo cair 10% abaixo do pico, volta sozinho ao simulador. Robô DESLIGADO: ligue manualmente.' });
    await auditOwner(admin, who, 'b3.unlock_real', { demo: c.demo }, req);
    return NextResponse.json({ ok: true, mode: 'real' });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
