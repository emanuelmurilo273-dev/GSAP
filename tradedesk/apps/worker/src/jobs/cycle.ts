import {
  MAX_TRADES_PER_DAY_DEFAULT, adminAlert, buildSeries, decrypt, hasAccess, isKeyError, log, makeExchange, realModeAllowed, sendEmail, emailLayout, setAgent, APP_NAME,
  type Candle, type Ex, type ExchangeId, type Quote, type StrategyParams, type SubscriptionRow, type TradeRow,
} from '@desk/core';
import { analyze } from '../agents/analyst';
import { enter } from '../agents/executor';
import { filterPair } from '../agents/filter';
import { dailyGuard, botEquity, monitorPositions, peakGuard } from '../agents/risk';
import { scout } from '../agents/scout';
import { sb } from '../lib/env';
import { brtDay } from '../lib/util';

const exCache = new Map<string, { ex: Ex; key: string; at: number }>();
async function getEx(userId: string, id: ExchangeId, keyEnc: string, secEnc: string) {
  const hit = exCache.get(userId);
  if (hit && hit.key === keyEnc && Date.now() - hit.at < 3600_000) return hit.ex;
  const ex = makeExchange(id, { apiKey: decrypt(keyEnc), secret: decrypt(secEnc) });
  await ex.loadMarkets();
  exCache.set(userId, { ex, key: keyEnc, at: Date.now() });
  return ex;
}

/** Um ciclo da mesa para um cliente (roda a cada minuto via fila). */
export async function runUserCycle(userId: string) {
  const [{ data: s }, { data: acc }, { data: sub }, { data: prof }] = await Promise.all([
    sb.from('bot_settings').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('exchange_accounts').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('subscriptions').select('status,paid_until,overdue_since,blocked_by_admin').eq('user_id', userId).maybeSingle(),
    sb.from('profiles').select('role,email').eq('id', userId).maybeSingle(),
  ]);
  if (!s?.bot_enabled || !acc) return;
  const isOwner = prof?.role === 'owner';

  // o dono nunca é bloqueado por inadimplência; clientes dependem de assinatura ativa
  if (!isOwner && !hasAccess(sub as SubscriptionRow)) {
    await sb.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
    await log(sb, userId, 'risk', 'warn', 'Assinatura sem acesso — robô pausado.');
    return;
  }
  // sem estratégia aprovada pela pesquisa: só testnet ou conta do dono
  if (!realModeAllowed(isOwner)) {
    await sb.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
    await log(sb, userId, 'risk', 'warn', 'Modo real bloqueado: nenhuma estratégia foi aprovada na pesquisa (STRATEGY_APPROVED=false).');
    return;
  }

  const p: StrategyParams = {
    minScore: +s.min_score, stopPct: +s.stop_pct, targetPct: +s.target_pct, trailingPct: +s.trailing_pct,
    positionPct: +s.position_pct, dailyLossPct: +s.daily_loss_pct, maxPositions: s.max_positions,
    timeframe: s.timeframe, maxVolPct: 0.03,
  };
  const quote = s.quote as Quote;

  try {
    const ex = await getEx(userId, acc.exchange, acc.api_key_enc, acc.api_secret_enc);
    const { data: openRows } = await sb.from('trades').select('*').eq('user_id', userId).eq('status', 'open');
    let open = (openRows ?? []) as TradeRow[];

    // RISK: posições abertas primeiro
    await setAgent(sb, userId, 'risk', 'working', `${open.length} posição(ões)`);
    const eq = await botEquity(ex, quote, open);
    await monitorPositions(sb, ex, open, eq.prices, p);
    const { data: still } = await sb.from('trades').select('*').eq('user_id', userId).eq('status', 'open');
    open = (still ?? []) as TradeRow[];

    const pk = await peakGuard(sb, userId, eq.equity, s.peak_equity == null ? null : Number(s.peak_equity), prof?.email);
    if (pk.paused) return;
    const guard = await dailyGuard(sb, userId, eq.equity, p);
    if (new Date().getUTCMinutes() % 5 === 0) await sb.from('equity_snapshots').insert({ user_id: userId, equity: eq.equity, quote });
    await setAgent(sb, userId, 'risk', guard.halted ? 'halted' : 'idle', `dia ${(guard.dayPnlPct * 100).toFixed(2)}% / limite -${(p.dailyLossPct * 100).toFixed(1)}%`);

    if (guard.halted) {
      for (const a of ['scout', 'filter', 'analyst', 'executor']) await setAgent(sb, userId, a, 'halted', 'limite de perda diária');
      return;
    }

    // SCOUT
    const symbols = (s.bases as string[]).map((b) => `${b}/${quote}`).filter((x) => ex.markets?.[x]);
    await setAgent(sb, userId, 'scout', 'working', `${symbols.length} pares`);
    const { candles, errors } = await scout(ex, symbols, p.timeframe);
    for (const e of errors) await log(sb, userId, 'scout', 'warn', e);
    await setAgent(sb, userId, 'scout', 'idle', `${candles.size}/${symbols.length} pares ok`);

    let free = eq.free;
    let analyzed = 0;
    for (const [symbol, c] of candles) {
      const last = c[c.length - 1];
      const { data: ss } = await sb.from('symbol_state').select('last_candle_ts').eq('user_id', userId).eq('symbol', symbol).maybeSingle();
      if (ss && Number(ss.last_candle_ts) >= last.t) continue; // candle já analisado
      analyzed++;
      await processSymbol(ex, userId, symbol, c, p, quote, open, eq.equity, free);
      // atualiza saldo livre após possível entrada
      free = (await ex.fetchBalance().then((b) => (b.free as any)?.[quote] ?? 0).catch(() => free)) as number;
      const { data: o2 } = await sb.from('trades').select('*').eq('user_id', userId).eq('status', 'open');
      open = (o2 ?? []) as TradeRow[];
    }
    if (analyzed === 0) {
      for (const a of ['filter', 'analyst', 'executor']) await setAgent(sb, userId, a, 'idle', 'aguardando novo candle');
    }
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 300);
    await log(sb, userId, 'executor', 'error', `Erro de API/corretora: ${msg}`);
    await sb.from('exchange_accounts').update({ last_error: msg, last_error_at: new Date().toISOString() }).eq('user_id', userId);
    exCache.delete(userId);
    if (isKeyError(msg)) {
      // chave inválida/revogada: avisa o cliente e o dono (no máx. 1 e-mail a cada 6h)
      await sb.from('bot_settings').update({ bot_enabled: false }).eq('user_id', userId);
      await adminAlert(sb, `key:${userId}`, 'Chave de API falhou', `<p>A chave da corretora de <b>${prof?.email ?? userId}</b> falhou e o robô dele foi pausado.</p><p style="color:#ff4fa3">${msg}</p>`, 360);
      if (prof?.email && !isOwner) await sendEmail(prof.email, `${APP_NAME} · sua chave de API falhou`, emailLayout('ação necessária', `<p>Seu robô foi <b>pausado</b>: a chave de API da corretora foi recusada (revogada, expirada ou sem permissão). Gere uma nova e reconecte em Configurações.</p><p style="color:#6b8f7a">${msg}</p>`));
    }
    for (const a of ['scout', 'filter', 'analyst', 'executor']) await setAgent(sb, userId, a, 'error', msg.slice(0, 80));
  }
}

async function processSymbol(
  ex: Ex, userId: string, symbol: string, c: Candle[], p: StrategyParams, quote: Quote,
  open: TradeRow[], equity: number, free: number,
) {
  const last = c[c.length - 1];
  const series = buildSeries(c);
  const i = c.length - 1;
  const mark = (score: number | null) =>
    sb.from('symbol_state').upsert({ user_id: userId, symbol, last_candle_ts: last.t, last_score: score });

  // FILTER
  await setAgent(sb, userId, 'filter', 'working', symbol);
  const f = await filterPair(ex, symbol, quote, series, i, p);
  if (!f.pass) {
    await log(sb, userId, 'filter', 'refuse', `RECUSA ${symbol}: ${f.reason}`);
    await mark(null);
    return;
  }

  // ANALYST
  await setAgent(sb, userId, 'analyst', 'working', symbol);
  const a = await analyze(symbol, c, series, p);
  if (!a) { await mark(null); return; }
  await mark(a.final);
  const detail = `nota ${a.final} (técnica ${a.technical.score}${a.llm ? ' + LLM' : ''}) · ${a.summary}`;
  if (a.final < p.minScore) {
    await log(sb, userId, 'analyst', 'refuse', `RECUSA ${symbol}: ${detail} < ${p.minScore}`, { parts: a.technical.parts });
    return;
  }
  await log(sb, userId, 'analyst', 'info', `SINAL ${symbol}: ${detail}`, { parts: a.technical.parts });

  // EXECUTOR (+ regras de risco de entrada)
  await setAgent(sb, userId, 'executor', 'working', symbol);
  if (open.some((t) => t.symbol === symbol)) {
    await log(sb, userId, 'risk', 'refuse', `RECUSA ${symbol}: já há posição aberta (o robô nunca faz preço médio).`);
    return;
  }
  if (open.length >= p.maxPositions) {
    await log(sb, userId, 'risk', 'refuse', `RECUSA ${symbol}: limite de ${p.maxPositions} posições simultâneas.`);
    return;
  }
  const maxDay = Number(process.env.CRYPTO_MAX_TRADES_PER_DAY ?? MAX_TRADES_PER_DAY_DEFAULT);   // máximo de operações por dia
  const dayStart = new Date(`${brtDay()}T00:00:00-03:00`).toISOString();
  const { count: today } = await sb.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('entry_at', dayStart);
  if ((today ?? 0) >= maxDay) {
    await log(sb, userId, 'risk', 'refuse', `RECUSA ${symbol}: limite de ${maxDay} operações por dia.`);
    return;
  }
  const price = (await ex.fetchTicker(symbol)).last ?? last.c;
  await enter(sb, ex, userId, symbol, price, equity, free, p, a.final, a.summary);
  await setAgent(sb, userId, 'executor', 'idle', `última: ${symbol}`);
}
