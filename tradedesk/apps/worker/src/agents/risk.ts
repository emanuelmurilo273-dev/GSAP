import { APP_NAME, MAX_LOSSES_IN_ROW, emailLayout, sendEmail, closeTrade, log, lossStreak, peakCheck, stopOrderParams, type Ex, type StrategyParams, type TradeRow } from '@desk/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { brtDay } from '../lib/util';

/** Equity que o robô enxerga: saldo da moeda de cotação + posições abertas do próprio robô a mercado. */
export async function botEquity(ex: Ex, quote: string, open: TradeRow[]) {
  const bal = await ex.fetchBalance();
  const free = ((bal.free ?? {}) as unknown as Record<string, number>)[quote] ?? 0;
  const total = ((bal.total ?? {}) as unknown as Record<string, number>)[quote] ?? 0;
  const prices = new Map<string, number>();
  let positions = 0;
  for (const t of open) {
    const last = (await ex.fetchTicker(t.symbol)).last ?? t.entry_price;
    prices.set(t.symbol, last);
    positions += t.qty * last;
  }
  return { equity: total + positions, free, prices };
}

/** 5 · RISK — monitora stop / alvo / trailing das posições abertas. */
export async function monitorPositions(sb: SupabaseClient, ex: Ex, open: TradeRow[], prices: Map<string, number>, p: StrategyParams) {
  for (const t of open) {
    const price = prices.get(t.symbol);
    if (!price) continue;
    try {
      if (t.stop_order_id) {
        const o: any = await ex.fetchOrder(t.stop_order_id, t.symbol, stopOrderParams(ex)).catch(() => null);
        if (o?.status === 'closed' && (o.filled ?? 0) > 0) { await closeTrade(sb, ex, t, 'stop'); continue; }
      }
      const peak = Math.max(t.peak_price, price);
      const trailingActive = t.trailing_active || peak >= t.entry_price * (1 + p.targetPct / 2);
      const trailLevel = trailingActive && p.trailingPct > 0 ? peak * (1 - p.trailingPct) : 0;
      const stopLevel = Math.max(t.stop_price, trailLevel);
      if (price <= stopLevel) {
        await closeTrade(sb, ex, t, trailLevel > t.stop_price ? 'trailing stop' : 'stop loss');
      } else if (price >= t.target_price) {
        await closeTrade(sb, ex, t, 'alvo atingido');
      } else if (peak !== t.peak_price || trailingActive !== t.trailing_active) {
        await sb.from('trades').update({ peak_price: peak, trailing_active: trailingActive }).eq('id', t.id);
      }
    } catch (e: any) {
      await log(sb, t.user_id, 'risk', 'error', `Erro ao monitorar ${t.symbol}: ${String(e?.message ?? e).slice(0, 150)}`);
    }
  }
}

/** Limite de perda diária. Atingiu → para de abrir posições até o dia seguinte (posições abertas mantêm stop). */
export async function dailyGuard(sb: SupabaseClient, userId: string, equity: number, p: StrategyParams) {
  const day = brtDay();
  let { data: st } = await sb.from('daily_state').select('*').eq('user_id', userId).eq('day', day).maybeSingle();
  if (!st) {
    const ins = await sb.from('daily_state').insert({ user_id: userId, day, start_equity: equity }).select('*').single();
    st = ins.data;
  }
  if (!st) return { halted: false, dayPnlPct: 0 };
  const dayPnlPct = (equity - st.start_equity) / st.start_equity;
  if (!st.halted && dayPnlPct <= -p.dailyLossPct) {
    await sb.from('daily_state').update({ halted: true, halted_reason: `perda do dia ${(dayPnlPct * 100).toFixed(2)}%` }).eq('user_id', userId).eq('day', day);
    await log(sb, userId, 'risk', 'warn', `LIMITE DIÁRIO ATINGIDO (${(dayPnlPct * 100).toFixed(2)}%). Robô não abre novas posições até amanhã.`);
    return { halted: true, dayPnlPct };
  }
  if (!st.halted) {   // parada do dia após 2 perdas seguidas
    const since = new Date(`${day}T00:00:00-03:00`).toISOString();
    const { data: today } = await sb.from('trades').select('pnl,exit_at').eq('user_id', userId).eq('status', 'closed').gte('exit_at', since).order('exit_at', { ascending: true });
    const streak = lossStreak((today ?? []).map((t: any) => Number(t.pnl ?? 0)));
    if (streak >= MAX_LOSSES_IN_ROW) {
      await sb.from('daily_state').update({ halted: true, halted_reason: `${streak} perdas seguidas` }).eq('user_id', userId).eq('day', day);
      await log(sb, userId, 'risk', 'warn', `${streak} PERDAS SEGUIDAS: o robô para por hoje (sem novas entradas até amanhã).`);
      return { halted: true, dayPnlPct };
    }
  }
  return { halted: !!st.halted, dayPnlPct };
}

/** Trava de 10% do pico: se o patrimônio cair 10% desde o maior valor visto, PAUSA o robô e avisa o cliente (as posições abertas mantêm o stop na corretora). */
export async function peakGuard(sb: SupabaseClient, userId: string, equity: number, storedPeak: number | null, email?: string | null): Promise<{ paused: boolean }> {
  const c = peakCheck(storedPeak, equity);
  if (c.peak !== storedPeak) await sb.from('bot_settings').update({ peak_equity: c.peak }).eq('user_id', userId);
  if (!c.breached) return { paused: false };
  await sb.from('bot_settings').update({ bot_enabled: false, paused_reason: `Pausado: a conta caiu ${(c.dropPct * 100).toFixed(1)}% desde o pico (R$ ${c.peak.toFixed(2)} → R$ ${equity.toFixed(2)}).` }).eq('user_id', userId);
  await log(sb, userId, 'risk', 'error', `TRAVA DOS 10%: patrimônio ${equity.toFixed(2)} está ${(c.dropPct * 100).toFixed(1)}% abaixo do pico ${c.peak.toFixed(2)}. Robô PAUSADO.`);
  if (email) await sendEmail(email, `[${APP_NAME}] Robô pausado: conta caiu 10% do pico`, emailLayout('robô pausado', `<p>O patrimônio da sua conta caiu <b>${(c.dropPct * 100).toFixed(1)}%</b> desde o pico e o robô foi <b>pausado</b>. As posições abertas mantêm o stop na corretora. Para voltar, reative no app depois de conferir o que aconteceu.</p>`)).catch(() => {});
  return { paused: true };
}
