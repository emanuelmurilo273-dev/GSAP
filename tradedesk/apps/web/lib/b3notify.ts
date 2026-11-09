import 'server-only';
import { APP_NAME, emailLayout, healthOf, sendEmail } from '@desk/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const brl = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const LIGHT: Record<string, string> = { verde: '🟢 verde', amarelo: '🟡 amarelo', vermelho: '🔴 vermelho', cinza: '⚪ sem dados suficientes' };

/** Envia ao dono (e-mail) os alertas enfileirados pelo conector: cada operação, limites, volta ao simulador. Chamado pelo cron a cada 5 min. */
export async function flushAlerts(admin: SupabaseClient): Promise<{ sent: number }> {
  const to = process.env.OWNER_EMAIL;
  if (!to) return { sent: 0 };
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await admin.from('b3_alerts').select('*').is('sent_at', null).gte('ts', since).order('ts', { ascending: true }).limit(50);
  const rows = data ?? [];
  if (!rows.length) return { sent: 0 };
  const urgent = rows.filter((r) => r.kind === 'real_revert' || r.kind === 'limit');
  const rest = rows.filter((r) => !urgent.includes(r));
  let sent = 0;
  for (const r of urgent) {
    if (await sendEmail(to, `[${APP_NAME}] ${r.title}`, emailLayout(r.kind === 'real_revert' ? 'ATENÇÃO' : 'aviso', `<p>${esc(r.title)}</p><p style="color:#8392a1">${esc(r.body)}</p>`))) { await admin.from('b3_alerts').update({ sent_at: new Date().toISOString() }).eq('id', r.id); sent++; }
  }
  if (rest.length) {   // operações do período num e-mail só (sem spam)
    const li = rest.map((r) => `<li><span style="color:#8392a1">${new Date(r.ts).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span> · ${esc(r.title)}${r.body ? ` <span style="color:#8392a1">— ${esc(r.body)}</span>` : ''}</li>`).join('');
    if (await sendEmail(to, `[${APP_NAME}] ${rest.length} atualização(ões) do robô`, emailLayout('operações', `<ul style="padding-left:18px">${li}</ul>`))) {
      await admin.from('b3_alerts').update({ sent_at: new Date().toISOString() }).in('id', rest.map((r) => r.id)); sent += rest.length;
    }
  }
  return { sent };
}

/** Resumo diário às 18:00 (horário de Brasília): resultado do dia + saúde do robô. Uma vez por dia útil. */
export async function dailySummary(admin: SupabaseClient, now = new Date()): Promise<boolean> {
  const sp = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const g = (t: string) => sp.find((p) => p.type === t)?.value ?? '';
  const mins = (Number(g('hour')) % 24) * 60 + Number(g('minute'));
  if (['Sat', 'Sun'].includes(g('weekday')) || mins < 18 * 60 || mins > 18 * 60 + 40) return false;
  const day = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const key = `b3-summary-${day}`;
  const { data: done } = await admin.from('alerts_sent').select('ts').eq('key', key).maybeSingle();
  if (done) return false;
  await admin.from('alerts_sent').upsert({ key, ts: now.toISOString() });
  const [{ data: st }, { data: set }, { data: tr }] = await Promise.all([
    admin.from('b3_status').select('day_pnl,equity,trades_today,source').eq('id', 1).maybeSingle(),
    admin.from('b3_settings').select('mode').eq('id', 1).maybeSingle(),
    admin.from('b3_trades').select('pnl,source,mode').eq('status', 'closed').not('pnl', 'is', null).limit(20000),
  ]);
  const real = set?.mode === 'real';
  const mine = (tr ?? []).filter((t) => (real ? t.mode === 'real' && t.source !== 'internal' : t.source === (st?.source ?? 'internal')));
  const h = healthOf(mine.map((t) => Number(t.pnl)));
  const day_pnl = Number(st?.day_pnl ?? 0);
  const body = `<p>Resultado de hoje: <b style="color:${day_pnl >= 0 ? '#3ddc84' : '#ff5c6c'}">${brl(day_pnl)}</b> · ${st?.trades_today ?? 0} operação(ões) · modo <b>${real ? 'DINHEIRO REAL' : 'SIMULADOR'}</b></p>
<p>Saúde do robô: <b>${LIGHT[h.light]}</b> — ${esc(h.headline)}</p>
<p>Média por operação: <b>${h.n ? brl(h.expectancy) : '—'}</b> · acerto ${h.n ? (h.winRate * 100).toFixed(0) + '%' : '—'} · ${h.n} operações no total.</p>
<p style="color:#8392a1">${h.reasons.map(esc).join(' ')}</p>`;
  await admin.from('b3_alerts').insert({ kind: 'summary', title: `Resumo do dia: ${brl(day_pnl)}`, body: `${h.headline}`, sent_at: now.toISOString() });
  const to = process.env.OWNER_EMAIL;
  return to ? sendEmail(to, `[${APP_NAME}] Resumo do dia: ${brl(day_pnl)} · ${LIGHT[h.light]}`, emailLayout('resumo do dia', body)) : false;
}
