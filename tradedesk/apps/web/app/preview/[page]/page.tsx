import { DEFAULT_PARAMS, fetchHistory, makeExchange, runBacktest } from '@desk/core';
import { notFound } from 'next/navigation';
import { MetricsView } from '@/components/BacktestRunner';
import LandingView from '@/components/LandingView';
import { Logo, Panel } from '@/components/ui';
import Dashboard from '../../app/Dashboard';
import B3Dashboard from '../../b3/B3Dashboard';
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
    const now = Date.now(); let v = 10000;
    const ts = (m: number) => new Date(now - m * 60_000).toISOString();
    const equity = Array.from({ length: 80 }, (_, i) => { v += Math.sin(i / 6) * 9 + (i > 50 ? -3 : 2); return { t: now - (80 - i) * 4 * 60_000, v: Math.round(v * 100) / 100 }; });
    const demo = {
      settings: { enabled: true, mode: real ? 'real' : 'sim', real_unlocked: real, symbols: ['WIN', 'WDO'], profile: 'conservador', daily_loss_brl: 150, max_trades_per_day: 6, open_from: '09:05', open_until: '17:00', flat_at: '17:30' },
      status: { state: 'trading', account_mode: real ? 'real' : 'demo', account_server: real ? 'Clear-Real' : 'ClearInvestimentos-DEMO', account_login: '***567', balance: 10000, equity: Math.round(v * 100) / 100, day_pnl: Math.round((v - 10000) * 100) / 100, trades_today: 3, contracts: { WIN: 'WINZ26', WDO: 'WDOZ26' },
        positions: [{ symbol: 'WINZ26', side: 'buy', volume: 2, price_open: 130005, sl: 129855, tp: 130230, profit: 18.4 }] },
      connectorAgeSec: 3,
      open: [], equity,
      logs: [['trade', 'executor', 'ENTRADA BUY 2x WINZ26 @ 130005 · stop 129855 · alvo 130230 (servidor da corretora)', 3], ['info', 'analyst', 'SINAL WINZ26: cruzamento EMA9/21 (estratégia de base, NÃO validada)', 3], ['refuse', 'filter', 'RECUSA WDOZ26: preços parados/sem cotação.', 22], ['trade', 'executor', 'SAÍDA ticket 102: stop/alvo na corretora · P&L -60.0 R$', 41], ['info', 'scout', 'Contrato vigente de WIN: WINZ26', 120]].map(([level, agent, message, m], i) => ({ id: i, level, agent, message, ts: ts(m as number) })),
      trades: [[-60, 'stop/alvo na corretora', 'WINZ26', 'sell'], [45, 'stop/alvo na corretora', 'WDOZ26', 'buy'], [90, 'zeragem fim de dia', 'WINZ26', 'buy']].map(([pnl, close_reason, contract, side], i) => ({ id: i, pnl, close_reason, contract, side, closed_at: ts(40 + i * 90) })),
      checklist: { strategyApproved: false, simSessions: 7, simSessionsOk: false, needSessions: 20 },
    };
    return (
      <div>
        <ModeBanner initial={real ? 'real' : 'sim'} demo />
        <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-6">
          <header className="flex items-center justify-between py-4"><Logo /><span className="text-xs text-dim">Day trade B3</span></header>
          <div className="mb-3 rounded-lg border border-analyst/40 bg-analyst/10 px-3 py-2 text-xs text-analyst">PRÉVIA — DADOS DE EXEMPLO (não são resultados reais)</div>
          <B3Dashboard demo={demo} />
        </div>
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
