import { DEFAULT_PARAMS, fetchHistory, makeExchange, runBacktest } from '@desk/core';
import { notFound } from 'next/navigation';
import { MetricsView } from '@/components/BacktestRunner';
import LandingView from '@/components/LandingView';
import { Logo, Panel } from '@/components/ui';
import Dashboard from '../../app/Dashboard';
import B3Dashboard from '../../b3/B3Dashboard';
import Avancado from '../../b3/avancado/page';
import Comecar from '../../b3/comecar/Comecar';
import Historico from '../../b3/historico/Historico';
import ClientHome from '@/components/ClientHome';
import CryptoLive from '@/components/CryptoLive';
import StatsView from '@/components/StatsView';
import HistoricoReal from '../../app/historico/Historico';
import OnboardingNovo from '../../app/onboarding/Onboarding';
import Home from '../../b3/Home';
import { computeStats, healthOf } from '@desk/core';
import Saude from '../../b3/saude/Saude';
import Inteligencia from '../../b3/inteligencia/Inteligencia';
import LiveChart from '../../b3/live/LiveChart';
import ModeBanner from '../../b3/ModeBanner';

export const dynamic = 'force-dynamic';

/** Telas de PRÉVIA (somente com PREVIEW_PAGES=true). Backtest = números reais; painel = dados de EXEMPLO (avisado na tela). */
let cache: any[] | null = null;
async function realBacktests() {
  if (cache) return cache;
  const ex = makeExchange('binance');
  const out: any[] = [];
  for (const days of [90, 365]) {
    const c = await fetchHistory(ex, 'BTC/USDT', DEFAULT_PARAMS.timeframe, days);
    const r = runBacktest(c, { params: DEFAULT_PARAMS });
    out.push({ id: String(days), kind: 'official', symbol: 'BTC/USDT', days, timeframe: DEFAULT_PARAMS.timeframe, exchange: 'binance', metrics: r.metrics, equity: r.equity, data_from: new Date(r.metrics.from).toISOString(), data_to: new Date(r.metrics.to).toISOString(), created_at: new Date().toISOString(), result: r });
  }
  return (cache = out);
}

function demoData() {
  const now = Date.now();
  let v = 1000;
  const equity = Array.from({ length: 14 * 24 }, (_, i) => { v *= 1 + Math.sin(i / 9) * 0.0016 + 0.00035; return { t: now - (14 * 24 - i) * 3600_000, v: Math.round(v * 100) / 100 }; });
  const ts = (m: number) => new Date(now - m * 60_000).toISOString();
  const logs = [
    ['trade', 'executor', 'ENTRADA ETH/USDT · 0.121000 @ 4132.10 · nota 0.78 · stop 4008.14 · alvo 4380.02', 2], ['info', 'analyst', 'SINAL ETH/USDT: nota 0.78 (técnica 0.74 + LLM) · volume acima da média, RSI saudável', 2],
    ['refuse', 'filter', 'RECUSA SOL/USDT: spread alto: 0.31% > 0.20%', 9], ['refuse', 'analyst', 'RECUSA BTC/USDT: nota 0.61 (técnica 0.61) < 0.7', 14],
    ['trade', 'executor', 'SAÍDA BTC/USDT @ 103512.4 · alvo atingido · P&L 18.42 USDT', 55], ['info', 'risk', 'Trailing ativado em BTC/USDT (pico 103.980)', 80],
    ['warn', 'risk', 'Dia: -0.8% / limite -5.0%', 120], ['info', 'scout', '3/3 pares ok', 121],
  ].map(([level, agent, message, m], i) => ({ id: i, level, agent, message, ts: ts(m as number) }));
  return {
    equity,
    initial: {
      open: [
        { id: 'a', symbol: 'ETH/USDT', entry_price: 4132.1, qty: 0.121, stop_price: 4008.14, target_price: 4380.02, peak_price: 4161.5, trailing_active: false, score: 0.78 },
        { id: 'b', symbol: 'SOL/USDT', entry_price: 182.4, qty: 2.7, stop_price: 176.93, target_price: 193.34, peak_price: 191.2, trailing_active: true, score: 0.74 },
      ],
      closed: [[18.42, 0.036, 'alvo atingido', 'BTC/USDT'], [-14.9, -0.029, 'stop loss', 'SOL/USDT'], [9.8, 0.019, 'trailing stop', 'ETH/USDT'], [22.1, 0.043, 'alvo atingido', 'BTC/USDT'], [-15.3, -0.03, 'stop loss', 'ETH/USDT']]
        .map(([pnl, pnl_pct, exit_reason, symbol], i) => ({ id: `c${i}`, pnl, pnl_pct, exit_reason, symbol, exit_at: ts(60 * (i + 1) * 6) })),
      logs,
      agents: [['scout', 'working', '3/3 pares ok'], ['filter', 'idle', 'aguardando novo candle'], ['analyst', 'working', 'ETH/USDT'], ['executor', 'idle', 'última: ETH/USDT'], ['risk', 'idle', 'dia -0.80% / limite -5.0%'], ['logger', 'working', '']].map(([agent, state, detail]) => ({ agent, state, detail })),
    },
  };
}


function liveDemo() {
    const now = Date.now(); const t0 = Math.floor(now / 1000 / 60) * 60;
    let p = 130000, seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    const m1 = Array.from({ length: 200 }, (_, i) => { const o = p; p += rnd() * 60 + Math.sin(i / 14) * 12; const h = Math.max(o, p) + Math.abs(rnd()) * 25, l = Math.min(o, p) - Math.abs(rnd()) * 25; return [t0 - (199 - i) * 60, o, h, l, p, Math.round(200 + Math.abs(rnd()) * 900)]; });
    const agg = (n: number) => { const out: number[][] = []; for (const b of m1) { const k = Math.floor(b[0] / (60 * n)) * 60 * n; const l = out[out.length - 1]; if (l && l[0] === k) { l[2] = Math.max(l[2], b[2]); l[3] = Math.min(l[3], b[3]); l[4] = b[4]; l[5] += b[5]; } else out.push([k, b[1], b[2], b[3], b[4], b[5]]); } return out; };
    const last = m1[m1.length - 1][4];
    const book = [...Array.from({ length: 8 }, (_, i) => ({ side: 'sell', price: last + 5 * (i + 1), vol: 20 + ((i * 37) % 90) })), ...Array.from({ length: 8 }, (_, i) => ({ side: 'buy', price: last - 5 * i, vol: 15 + ((i * 53) % 110) }))];
    const trades = Array.from({ length: 30 }, (_, i) => ({ t: now - i * 1700, p: last + (i % 3) * 5 - 5, v: 1 + ((i * 7) % 25), side: i % 3 ? 'buy' : 'sell' }));
    const snapshot = { real_ms: now, symbols: { WIN: { last: { t: now, bid: last - 5, ask: last, last }, last_tick_real_ms: now - 400, book, trades: trades.reverse(), bars: { M1: m1, M5: agg(5), M15: agg(15) }, flow: { buy: 640, sell: 410, delta: 230, imbalance: 0.22, big_lots: 3, trades: 180, book_imbalance: 0.1 } } },
      __trades: [{ id: 1, root: 'WIN', contract: 'WINZ26', side: 'buy', status: 'open', price_open: last - 40, sl: last - 190, tp: last + 185, opened_at: new Date(now - 12 * 60_000).toISOString() }, { id: 2, root: 'WIN', contract: 'WINZ26', side: 'sell', status: 'closed', price_open: m1[120][1], pnl: -60, opened_at: new Date(m1[120][0] * 1000).toISOString(), closed_at: new Date(m1[135][0] * 1000).toISOString() }] };
    return snapshot;
}

export default async function Preview({ params }: { params: Promise<{ page: string }> }) {
  if (process.env.PREVIEW_PAGES !== 'true') notFound();
  const { page } = await params;
  if (page === 'landing') return <LandingView price={7000} bts={await realBacktests()} />;
  if (page === 'backtest') {
    const b = (await realBacktests())[0];
    return <div className="mx-auto max-w-6xl px-3 py-4"><div className="mb-4 flex items-center justify-between"><Logo /></div><h1 className="mb-3 text-lg font-semibold text-scout">Backtest</h1><MetricsView m={b.metrics} equity={b.equity} symbol={b.symbol} days={b.days} tf={b.timeframe} /></div>;
  }
  if (page === 'b3' || page === 'b3-real') {
    const real = page === 'b3-real';
    const internal = !real;
    const now = Date.now(); let v = 10000;
    const ts = (m: number) => new Date(now - m * 60_000).toISOString();
    const equity = Array.from({ length: 80 }, (_, i) => { v += Math.sin(i / 6) * 9 + (i > 50 ? -3 : 2); return { t: now - (80 - i) * 4 * 60_000, v: Math.round(v * 100) / 100 }; });
    const demo = {
      settings: { enabled: true, mode: real ? 'real' : 'sim', real_unlocked: real, symbols: ['WIN', 'WDO'], profile: 'conservador', daily_loss_brl: 150, max_trades_per_day: 6, open_from: '09:05', open_until: '17:00', flat_at: '17:30' },
      status: { state: 'trading', account_mode: real ? 'real' : 'demo', account_server: real ? 'Clear-Real' : 'SIMULADOR-INTERNO', source: real ? 'mt5' : 'internal', account_login: '***567', balance: 10000, equity: Math.round(v * 100) / 100, day_pnl: Math.round((v - 10000) * 100) / 100, trades_today: 3, contracts: { WIN: 'WINZ26', WDO: 'WDOZ26' },
        positions: [{ symbol: 'WINZ26', side: 'buy', volume: 2, price_open: 130005, sl: 129855, tp: 130230, profit: 18.4 }] },
      connectorAgeSec: 3,
      open: [], equity,
      logs: [['trade', 'executor', 'ENTRADA BUY 2x WINZ26 @ 130005 · stop 129855 · alvo 130230 (servidor da corretora)', 3], ['info', 'analyst', 'SINAL WINZ26: cruzamento EMA9/21 (estratégia de base, NÃO validada)', 3], ['refuse', 'filter', 'RECUSA WDOZ26: preços parados/sem cotação.', 22], ['trade', 'executor', 'SAÍDA ticket 102: stop/alvo na corretora · P&L -60.0 R$', 41], ['info', 'scout', 'Contrato vigente de WIN: WINZ26', 120]].map(([level, agent, message, m], i) => ({ id: i, level, agent, message, ts: ts(m as number) })),
      trades: [[-60, 'stop/alvo na corretora', 'WINZ26', 'sell'], [45, 'stop/alvo na corretora', 'WDOZ26', 'buy'], [90, 'zeragem fim de dia', 'WINZ26', 'buy']].map(([pnl, close_reason, contract, side], i) => ({ id: i, pnl, close_reason, contract, side, closed_at: ts(40 + i * 90) })),
      checklist: { approval: null, demo: { sessions: 2, trades: 14, pnl: -30, expectancy: -2.1 }, canUnlock: false, missing: ['estratégia ainda NÃO aprovada'], need: { sessions: 20, trades: 30 } },
    };
    return (
      <div>
        <ModeBanner initial={real ? 'real' : 'sim'} demo demoInternal={internal} />
        <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-6">
          <header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">Day trade B3</span></header>
          <div className="mb-3 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
          <B3Dashboard demo={demo} />
        </div>
      </div>
    );
  }
  if (page === 'c-home' || page === 'c-stats' || page === 'c-live' || page === 'c-hist' || page === 'c-onb') {
    const now = Date.now(); let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    const tr = Array.from({ length: 60 }, (_, i) => { const t = now - (60 - i) * 14 * 3600_000; const pnl = Math.round((rnd() * 140 + 4) * 100) / 100; return { id: `x${i}`, market: (i % 5 === 0 ? 'b3' : 'cripto') as 'b3' | 'cripto', symbol: i % 5 === 0 ? 'WINZ26' : ['BTC/BRL', 'ETH/BRL', 'SOL/BRL'][i % 3], side: 'buy' as const, openedAt: new Date(t - 5 * 3600_000).toISOString(), closedAt: new Date(t).toISOString(), pnl, fees: 6 + Math.abs(rnd()) * 6, orderId: `ord-${1000 + i}` }; });
    const stats = computeStats(tr, { startEquity: 10000 });
    let p = 415000; const candles = Array.from({ length: 160 }, (_, i) => { const o = p; p += rnd() * 700; return { t: Math.floor(now / 300_000) * 300_000 - (159 - i) * 300_000, o, h: Math.max(o, p) + Math.abs(rnd()) * 250, l: Math.min(o, p) - Math.abs(rnd()) * 250, c: p, v: 0.2 + Math.abs(rnd()) * 3 }; });
    const open = [{ id: 'o1', market: 'cripto', symbol: 'BTC/BRL', side: 'buy', status: 'open', entry: candles[120].c, stop: candles[120].c * 0.97, target: candles[120].c * 1.06, openedAt: new Date(candles[120].t).toISOString(), closedAt: null, pnl: null, orderId: 'ord-9001', why: 'Comprei BTC porque a nota técnica ficou em 0,78: tendência de alta, volume acima da média e RSI saudável. Stop 3% e alvo 6%.' },
      { id: 'o2', market: 'cripto', symbol: 'BTC/BRL', side: 'buy', status: 'closed', entry: candles[60].c, exit: candles[80].c, stop: 0, target: 0, openedAt: new Date(candles[60].t).toISOString(), closedAt: new Date(candles[80].t).toISOString(), pnl: 54.3, orderId: 'ord-8800', reason: 'alvo atingido', why: null }];
    const home = { connected: true, exchange: 'foxbit', enabled: true, pausedReason: null, quote: 'BRL', equity: 10412.35, live: true, error: null, dayPnl: 120.4, dayPct: 0.0117, halted: false, haltedReason: null, open: [{ symbol: 'BTC/BRL' }], logs: [], health: healthOf(tr.slice(-30).map((t) => t.pnl)), b3: { enabled: true, mode: 'real', positions: [], dayPnl: 0 }, hasB3: true };
    return (
      <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6"><header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">{page}</span></header>
        <div className="mb-4 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
        {page === 'c-home' && <ClientHome demo={home} />}
        {page === 'c-stats' && <><h1 className="mb-4 text-2xl font-semibold tracking-tight">Estatísticas</h1><StatsView stats={stats} since={tr[0].closedAt} /></>}
        {page === 'c-live' && <><h1 className="mb-4 text-2xl font-semibold tracking-tight">Ao vivo</h1><CryptoLive demo={{ candles, trades: open }} /></>}
        {page === 'c-hist' && <><h1 className="mb-4 text-2xl font-semibold tracking-tight">Histórico</h1><HistoricoReal demo={[...open, ...tr.slice(-8).map((t) => ({ ...t, status: 'closed', volume: 1, reason: 'alvo atingido', why: null }))].map((t: any) => ({ ...t, pnl: t.pnl }))} /></>}
        {page === 'c-onb' && <OnboardingNovo acc={{ exchange: 'foxbit', hint: '9f3a', verified: false }} risk={false} enabled={false} exchanges={['foxbit']} testnet={false} equity={10000} />}
      </div>);
  }
  if (page === 'b3-historico' || page === 'b3-comecar' || page === 'b3-avancado') {
    const now = Date.now();
    const trades = Array.from({ length: 14 }, (_, i) => ({ id: i, side: i % 3 ? 'buy' : 'sell', contract: i % 4 ? 'WINZ26' : 'WDOZ26', volume: 1, opened_at: new Date(now - (i * 70 + 30) * 60_000).toISOString(), closed_at: new Date(now - (i * 70 + 10) * 60_000).toISOString(), pnl: [54, -38.5, 104.9, -57, 22, -31, 61.5][i % 7], close_reason: i % 5 === 0 ? 'zeragem de fim de dia' : 'stop/alvo na corretora' }));
    const days = Array.from({ length: 22 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, pnl: Math.sin(i / 2.3) * 90 - 8, n: 3 }));
    return (
      <div><ModeBanner initial="sim" demo demoInternal />
        <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6"><header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">{page.replace('b3-', '')}</span></header>
          <div className="mb-4 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
          {page === 'b3-historico' && <><h1 className="mb-4 text-2xl font-semibold tracking-tight">Histórico</h1><Historico demo={{ origem: 'internal', trades, days }} /></>}
          {page === 'b3-comecar' && <><h1 className="mb-4 text-2xl font-semibold tracking-tight">Começar</h1><Comecar demo={{ connectorAgeSec: 3, status: { balance: 10000 } }} /></>}
          {page === 'b3-avancado' && <Avancado />}</div></div>);
  }
  if (page === 'b3-home' || page === 'b3-saude' || page === 'b3-saude-verde') {
    const now = Date.now(); const ts = (m: number) => new Date(now - m * 60_000).toISOString();
    const demoHome = {
      settings: { enabled: true, mode: 'sim' }, connectorAgeSec: 2,
      status: { state: 'trading', equity: 10248.6, balance: 10130, day_pnl: 120.4, halted: false, source: 'internal' },
      open: [{ id: 1, side: 'buy', volume: 1, contract: 'WINZ26', status: 'open', opened_at: ts(14), pnl: null, why: 'Comprei porque a média rápida cruzou para cima da lenta e o mercado estava em tendência. Stop 120 pontos (técnico, pelo ATR e pela última região de preço) e alvo 1,5× maior.' }],
      trades: [{ id: 2, side: 'sell', volume: 1, contract: 'WINZ26', status: 'closed', opened_at: ts(95), pnl: 54, why: null, close_reason: 'stop/alvo na corretora' }, { id: 3, side: 'buy', volume: 1, contract: 'WDOZ26', status: 'closed', opened_at: ts(190), pnl: -38.5, close_reason: 'stop/alvo na corretora' }, { id: 4, side: 'buy', volume: 1, contract: 'WINZ26', status: 'closed', opened_at: ts(260), pnl: 104.9, close_reason: 'zeragem de fim de dia' }],
      decisions: [], logs: [], onboarded: false, __saude: { current: 'internal', groups: [{ id: 'internal', health: { light: 'vermelho', headline: 'Perdendo dinheiro — recomendo parar', expectancy: -7.4, n: 148 } }] }, __live: undefined as any,
    };
    if (page === 'b3-home') {
      const lv: any = liveDemo();
      return (
        <div><ModeBanner initial="sim" demo demoInternal />
          <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6"><header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">Início</span></header>
            <div className="mb-4 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
            <Home demo={{ ...demoHome, __live: lv }} /></div></div>);
    }
    const mk = (n: number, e: number, light: string, headline: string, reasons: string[]) => ({ n, wins: Math.round(n * 0.4), winRate: 0.4, avgWin: 57, avgLoss: 41, expectancy: e, profitFactor: e > 0 ? 1.4 : 0.82, total: n * e, lastExpectancy: e, ci: [e - 9, e + 9], light, headline, reasons });
    const bad = mk(148, -7.4, 'vermelho', 'Perdendo dinheiro — recomendo parar', ['A média por operação é zero ou negativa: não há sinal de vantagem.']);
    const good = mk(160, 11.2, 'verde', 'Com vantagem e lucrando', ['Lucro médio positivo e acima da margem de erro, com amostra suficiente.']);
    const h = page === 'b3-saude' ? bad : good;
    const data = { current: 'internal', lock: { locked: true, reason: 'Travado até o diagnóstico de perdas (DIAGNOSTICO.md) ser aprovado pelo dono.', mode: 'sim' },
      groups: [{ id: 'internal', label: 'Simulador interno (preços artificiais)', health: h, costs: { gross: h.n * h.expectancy + 410, fees: 410, net: h.n * h.expectancy } }, { id: 'demo', label: 'Conta demo do MT5 (preços reais)', health: mk(6, 3, 'cinza', 'Ainda poucas operações para avaliar', []), costs: { gross: 20, fees: 2, net: 18 } }, { id: 'real', label: 'Conta real (dinheiro de verdade)', health: mk(0, 0, 'cinza', 'Ainda poucas operações para avaliar', []), costs: { gross: 0, fees: 0, net: 0 } }] };
    return (
      <div><ModeBanner initial="sim" demo demoInternal />
        <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6"><header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">Saúde do robô</span></header>
          <div className="mb-4 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">Saúde do robô</h1><Saude demo={data} /></div></div>);
  }
  if (page === 'b3-live' || page === 'b3-intel') {
    const snapshot = liveDemo(); const now = Date.now();
    const ts = (m: number) => new Date(now - m * 60_000).toISOString();
    const curve = (k: number) => { let e = 0; return Array.from({ length: 30 }, (_, i) => ({ t: now - (30 - i) * 86_400_000, v: (e += Math.sin(i / 3) * 40 + k) })); };
    const mt = (trades: number, sessions: number, pf: number, dd: number, sh: number, pnl: number) => ({ trades, sessions, profitFactor: pf, maxDrawdown: dd, sharpe: sh, pnl });
    const intel = { champion: { id: 1, name: 'Base (EMA 9/21, sem camadas)' }, rules: { minSessions: 10, minTrades: 30 },
      decisions: [['nao_entrou', 'Mercado lateral (ADX 14 < 20)', 'range', null, 2], ['nao_entrou', 'Copom em 10 min', 'trend', null, 25], ['entrou', 'Cruzamento EMA9/21 confirmado pelo fluxo', 'trend', 0.58, 80], ['nao_entrou', 'Volatilidade alta demais (ATR no percentil 95)', 'volatile', null, 150]].map(([decision, reason, regime, prob, m], i) => ({ id: i, ts: ts(m as number), symbol: 'WINZ26', decision, reason, regime, prob })),
      challengers: [{ version: { id: 2, name: 'Desafiante: regime + fluxo' }, comparison: { champion: mt(64, 11, 0.9, 420, -0.4, -180), challenger: mt(41, 11, 1.12, 260, 0.5, 210), canPromote: false, reasons: ['lucro (fator de lucro) ainda não é significativamente melhor em amostra tão pequena'] }, curves: { champion: curve(-4), challenger: curve(3) } }],
      analyst: { text: 'Abertura com gap de +0,3% e mercado lateral até 10h30. O robô não entrou por falta de tendência. Atenção: Copom às 18h30, sem novas entradas na janela.', at: ts(5), model: 'claude-opus-5-5' } };
    return (
      <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-6">
        <header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">{page === 'b3-live' ? 'Ao vivo' : 'Inteligência'}</span></header>
        <div className="mb-3 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
        {page === 'b3-live' ? <LiveChart demo={snapshot} /> : <Inteligencia demo={{ ...intel, events: [{ id: 1, starts_at: ts(-600), title: 'Copom — decisão da Selic', impact: 'alto' }, { id: 2, starts_at: ts(-1500), title: 'Payroll (EUA)', impact: 'alto' }] }} />}
      </div>
    );
  }
  if (page === 'dashboard') {
    const d = demoData();
    return (
      <div className="mx-auto max-w-6xl px-3 pb-10">
        <header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">Dashboard</span></header>
        <div className="mb-3 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
        <Dashboard userId="demo" settings={{ bot_enabled: true, quote: 'USDT' }} account={{ exchange: 'binance' }} initial={d.initial} equity={d.equity} pnl={{ day: 21.4, week: 96.8, month: 212.3 }}
          demo={{ balance: { equity: 1212.34, free: 733.9, exchange: 'binance' } }} />
      </div>
    );
  }
  return <main className="mx-auto max-w-md px-4 py-6"><Logo /><Panel title="prévia" className="mt-6"><p className="text-sm text-dim">Use /preview/landing, /preview/dashboard ou /preview/backtest.</p></Panel></main>;
}
