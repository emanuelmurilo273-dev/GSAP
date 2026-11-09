import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { applyLimitedCaps, unlockDecision } from '@desk/core';
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
    const c = await realChecklist(admin);
    const d = unlockDecision({ strategyApproved: c.strategyApproved, simSessions: c.simSessions, confirm1: b.confirm1 === true, confirm2: b.confirm2 === true, confirm3: b.confirm3 === true, phrase: String(b.phrase ?? ''), riskPhrase: String(b.riskPhrase ?? '') });
    if (!d.ok) {
      await auditOwner(admin, who, 'b3.unlock_real.denied', { missing: d.missing }, req);
      return NextResponse.json({ error: `Modo REAL bloqueado. Falta: ${d.missing.join('; ')}.`, missing: d.missing }, { status: 412 });
    }
    // sem estratégia aprovada: modo LIMITADO — os tetos já são gravados nas configurações e o conector os repete
    const { data: cur } = await admin.from('b3_settings').select('*').eq('id', 1).maybeSingle();
    const caps = d.limited && cur ? (({ profile, max_contracts, daily_loss_brl, max_trades_per_day, risk_per_trade_brl }) => ({ profile, max_contracts, daily_loss_brl, max_trades_per_day, risk_per_trade_brl }))(applyLimitedCaps(cur)) : {};
    await admin.from('b3_settings').update({ ...caps, mode: 'real', real_unlocked: true, real_limited: d.limited, real_unlocked_at: new Date().toISOString(), enabled: false, updated_at: new Date().toISOString() }).eq('id', 1);
    await admin.from('b3_logs').insert({ level: 'warn', agent: 'risk', message: d.limited ? 'MODO REAL LIMITADO liberado pelo dono (estratégia NÃO validada): 1 contrato, perda máx. R$ 100/dia, 3 operações/dia. Robô DESLIGADO: ligue manualmente.' : 'MODO REAL liberado pelo dono. Robô DESLIGADO: ligue manualmente.' });
    await auditOwner(admin, who, d.limited ? 'b3.unlock_real.limited' : 'b3.unlock_real', {}, req);
    return NextResponse.json({ ok: true, mode: 'real', limited: d.limited });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
