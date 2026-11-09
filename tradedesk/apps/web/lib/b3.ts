import 'server-only';
import { MIN_DEMO_TRADES, MIN_SESSION_MINUTES, MIN_SIM_SESSIONS, NEAR_BACKTEST, type Approval, type DemoStats, unlockDecision } from '@desk/core';
import type { SupabaseClient } from '@supabase/supabase-js';


const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const hhmm = (v: unknown, d: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Sanitiza as configurações vindas do navegador. Horários: abrir ≥ 09:15, parar de abrir ≤ 17:20, zerar entre 16:00 e 17:45. */
export function cleanB3Settings(b: any, cur: any) {
  return cleanRaw(b, cur);   // (no real, o teto de contratos é aplicado no conector: 1 até provar — ver realContractCap)
}

function cleanRaw(b: any, cur: any) {
  const open_from = hhmm(b.open_from, cur.open_from);
  let open_until = hhmm(b.open_until, cur.open_until);
  let flat_at = hhmm(b.flat_at, cur.flat_at);
  const clampT = (t: string, lo: string, hi: string) => (mins(t) < mins(lo) ? lo : mins(t) > mins(hi) ? hi : t);
  const of = clampT(open_from, '09:15', '17:00');   // nada nos primeiros 15 min do pregão
  open_until = clampT(open_until, of, '17:20');
  flat_at = clampT(flat_at, '16:00', '17:45');
  if (mins(flat_at) < mins(open_until)) flat_at = open_until;
  const sym = (Array.isArray(b.symbols) ? b.symbols : cur.symbols).filter((s: string) => s === 'WIN' || s === 'WDO');
  const target = b.daily_target_brl === '' || b.daily_target_brl === null || b.daily_target_brl === undefined ? null : num(b.daily_target_brl, 10, 100000, 0) || null;
  return {
    symbols: sym.length ? sym : ['WIN'],
    profile: ['conservador', 'moderado', 'agressivo'].includes(b.profile) ? b.profile : cur.profile,
    risk_per_trade_brl: num(b.risk_per_trade_brl, 1, 5000, cur.risk_per_trade_brl),
    max_contracts: Math.round(num(b.max_contracts, 1, 50, cur.max_contracts)),
    daily_loss_brl: num(b.daily_loss_brl, 10, 50000, cur.daily_loss_brl),
    daily_target_brl: target,
    max_trades_per_day: Math.round(num(b.max_trades_per_day, 1, 50, cur.max_trades_per_day)),
    stop_points_win: num(b.stop_points_win, 20, 1000, cur.stop_points_win),
    stop_points_wdo: num(b.stop_points_wdo, 1, 50, cur.stop_points_wdo),
    rr: num(b.rr, 1.5, 5, cur.rr),                    // relação risco/retorno mínima 1:1,5
    open_from: of, open_until, flat_at,
  };
}

/** Condições para liberar o modo REAL (todas verificadas no servidor). */
export async function realChecklist(admin: SupabaseClient) {
  const [ses, ap] = await Promise.all([
    admin.from('b3_sessions').select('day,pnl,active_minutes').eq('mode', 'sim').eq('source', 'mt5').gte('active_minutes', MIN_SESSION_MINUTES),   // o simulador interno (preços artificiais) NÃO conta
    admin.from('app_settings').select('value').eq('key', 'b3_approval').maybeSingle(),
  ]);
  const days = new Set((ses.data ?? []).map((r) => String(r.day)));
  const { data: tr } = await admin.from('b3_trades').select('pnl,opened_at').eq('status', 'closed').eq('mode', 'sim').eq('source', 'mt5').not('pnl', 'is', null).limit(20000);
  const pnls = (tr ?? []).filter((t) => days.has(String(t.opened_at).slice(0, 10)) || days.has(new Date(t.opened_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))).map((t) => Number(t.pnl));
  const total = pnls.reduce((a, b) => a + b, 0);
  const demo: DemoStats = { sessions: days.size, trades: pnls.length, pnl: (ses.data ?? []).reduce((a, r) => a + Number(r.pnl ?? 0), 0) || total, expectancy: pnls.length ? total / pnls.length : 0 };
  const approval = (ap.data?.value as Approval | undefined) ?? null;
  const d = unlockDecision({ approval, demo, confirm1: true, confirm2: true, phrase: 'OPERAR REAL' });   // confirmações vêm da tela; aqui só as condições de mérito
  return { approval, demo, canUnlock: d.ok, missing: d.missing, need: { sessions: MIN_SIM_SESSIONS, trades: MIN_DEMO_TRADES, nearBacktest: NEAR_BACKTEST } };
}
