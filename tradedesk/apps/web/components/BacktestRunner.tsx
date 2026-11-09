'use client';
import { useState } from 'react';
import ParamFields from '@/components/ParamFields';
import { fromForm, type PForm } from '@/lib/pform';
import { LineChart, Panel, Stat, btn, dateOnly, num, pct, tone } from '@/components/ui';

type Any = Record<string, any>;

export function MetricsView({ m, equity, symbol, days, tf }: { m: Any; equity: { t: number; v: number }[]; symbol: string; days: number; tf: string }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Lucro/prejuízo total" value={pct(m.totalPnlPct)} tone={tone(m.totalPnlPct)} sub={`${num(m.totalPnl)} sobre ${num(m.initialEquity, 0)}`} />
        <Stat label="Taxa de acerto" value={m.winRate == null ? '—' : `${(m.winRate * 100).toFixed(1)}%`} />
        <Stat label="Fator de lucro" value={m.profitFactor == null ? '—' : num(m.profitFactor)} sub="ganhos ÷ perdas" />
        <Stat label="Nº de trades" value={m.trades} />
        <Stat label="Maior sequência de perdas" value={m.maxLossStreak} tone="neg" />
        <Stat label="Drawdown máximo" value={`-${(m.maxDrawdownPct * 100).toFixed(1)}%`} tone="neg" />
        <Stat label="Média por trade" value={pct(m.avgTradePct)} tone={tone(m.avgTradePct)} />
        <Stat label="Comprar e segurar" value={pct(m.buyHoldPct)} tone={tone(m.buyHoldPct)} sub="referência" />
      </div>
      <Panel title="curva de equity (backtest)" accent="#3aa8ff"><LineChart data={equity} color="#3aa8ff" /></Panel>
      <p className="text-[11px] text-dim">{symbol} · {days} dias · {tf} · dados reais de {dateOnly(m.from)} a {dateOnly(m.to)} ({m.candles} candles) · taxa {(m.feePct * 100).toFixed(2)}% e slippage {(m.slippagePct * 100).toFixed(2)}% por execução · dias com limite diário atingido: {m.haltedDays}. Simulação: não inclui o ajuste do LLM nem filtros de spread/liquidez em tempo real. Não garante resultado futuro.</p>
    </div>
  );
}

export default function BacktestRunner({ symbols, exchange, initial }: { symbols: string[]; exchange: string; initial: PForm }) {
  const [symbol, setSymbol] = useState(symbols[0] ?? 'BTC/USDT');
  const [days, setDays] = useState(90);
  const [form, setForm] = useState<PForm>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Any | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(''); setRes(null);
    const r = await fetch('/api/backtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ exchange, symbol, days, params: fromForm(form) }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error);
    setRes({ ...j, symbol, days, tf: form.timeframe });
  }

  return (
    <div className="space-y-4">
      <Panel title="parâmetros do backtest">
        <form onSubmit={run} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label>Par</label><select value={symbol} onChange={(e) => setSymbol(e.target.value)}>{symbols.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label>Período</label><select value={days} onChange={(e) => setDays(+e.target.value)}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>365 dias</option></select></div>
          </div>
          <ParamFields v={form} set={setForm} />
          <button className={btn} disabled={busy}>{busy ? 'baixando candles e simulando… (até 1 min)' : 'rodar backtest'}</button>
          {err && <p className="text-sm text-neon-pink">{err}</p>}
        </form>
      </Panel>
      {res?.dataNote && <p className="rounded-lg border border-filter/40 bg-filter/10 p-3 text-xs text-filter">{res.dataNote}</p>}
      {res && <MetricsView m={res.metrics} equity={res.equity} symbol={res.symbol} days={res.days} tf={res.tf} />}
      {res && <p className="text-sm text-neon-green">✔ Backtest registrado. Se quiser operar com estes parâmetros, salve-os em <a href="/app/settings">Config</a> e rode o backtest com a configuração salva.</p>}
    </div>
  );
}
