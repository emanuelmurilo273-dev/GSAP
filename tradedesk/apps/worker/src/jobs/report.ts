import { APP_NAME, emailLayout, hasAccess, sendEmail, type SubscriptionRow } from '@desk/core';
import { brtDay, brtDayStartUtc, sb } from '../lib/env';

/** 6 · LOGGER — relatório diário por e-mail (todos os números vêm das tabelas alimentadas pela corretora). */
export async function dailyReports() {
  const day = brtDay();
  const since = brtDayStartUtc(day).toISOString();
  const { data: users } = await sb.from('bot_settings').select('user_id, quote');
  let sent = 0;
  for (const u of users ?? []) {
    const [{ data: sub }, { data: prof }] = await Promise.all([
      sb.from('subscriptions').select('status,paid_until,overdue_since,blocked_by_admin').eq('user_id', u.user_id).maybeSingle(),
      sb.from('profiles').select('email').eq('id', u.user_id).maybeSingle(),
    ]);
    if (!prof?.email || !hasAccess(sub as SubscriptionRow)) continue;
    const [{ data: closed }, { data: logs }, { data: st }, { data: snap }] = await Promise.all([
      sb.from('trades').select('symbol,pnl,pnl_pct,exit_reason').eq('user_id', u.user_id).eq('status', 'closed').gte('exit_at', since),
      sb.from('bot_logs').select('level').eq('user_id', u.user_id).gte('ts', since),
      sb.from('daily_state').select('start_equity,halted').eq('user_id', u.user_id).eq('day', day).maybeSingle(),
      sb.from('equity_snapshots').select('equity').eq('user_id', u.user_id).order('ts', { ascending: false }).limit(1),
    ]);
    const pnl = (closed ?? []).reduce((a, t) => a + Number(t.pnl ?? 0), 0);
    const wins = (closed ?? []).filter((t) => Number(t.pnl) > 0).length;
    const count = (lv: string) => (logs ?? []).filter((l) => l.level === lv).length;
    const endEq = snap?.[0]?.equity;
    const rows = (closed ?? []).map((t) => `<tr><td>${t.symbol}</td><td>${t.exit_reason}</td><td style="text-align:right">${Number(t.pnl).toFixed(2)}</td></tr>`).join('');
    const html = emailLayout(`relatório de ${day}`, `
      <p>P&L realizado do dia: <b style="color:${pnl >= 0 ? '#39ff88' : '#ff4fa3'}">${pnl.toFixed(2)} ${u.quote}</b></p>
      <p>Trades fechados: ${closed?.length ?? 0} (${wins} no lucro) · Recusas: ${count('refuse')} · Erros: ${count('error')}</p>
      ${st ? `<p>Saldo no início do dia: ${Number(st.start_equity).toFixed(2)} · ${endEq ? `último saldo: ${Number(endEq).toFixed(2)} ${u.quote}` : ''}${st.halted ? ' · <b style="color:#ffa21f">limite diário atingido</b>' : ''}</p>` : ''}
      ${rows ? `<table style="width:100%;font-size:13px;color:#c9f7da"><tr><th align="left">Par</th><th align="left">Saída</th><th align="right">P&L</th></tr>${rows}</table>` : '<p>Nenhum trade fechado hoje.</p>'}`);
    if (await sendEmail(prof.email, `${APP_NAME} · relatório diário ${day}`, html)) sent++;
  }
  return sent;
}
