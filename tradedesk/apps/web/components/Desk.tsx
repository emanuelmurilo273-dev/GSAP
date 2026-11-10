'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LineChart } from '@/components/ui';

type Any = Record<string, any>;
const AG = [
  { id: 'scout', nome: 'SCOUT', verbo: 'ENCONTRA', cor: '#4da3ff', ic: '◎' }, { id: 'filter', nome: 'FILTER', verbo: 'ELIMINA', cor: '#ffa94d', ic: '▽' },
  { id: 'analyst', nome: 'ANALYST', verbo: 'PONTUA', cor: '#a478ff', ic: '◈' }, { id: 'executor', nome: 'EXECUTOR', verbo: 'COMPRA', cor: '#3ddc84', ic: '▶' },
  { id: 'risk', nome: 'RISK', verbo: 'PROTEGE', cor: '#ff5c9a', ic: '◆' }, { id: 'logger', nome: 'LOGGER', verbo: 'EXPLICA', cor: '#2dd4bf', ic: '≡' },
] as const;
const COR: Record<string, string> = Object.fromEntries(AG.map((a) => [a.id, a.cor]));
const brl = (v: number | null | undefined, sign = false) => (v == null ? '—' : `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const LAMP: Record<string, { c: string; t: string }> = { verde: { c: '#3ddc84', t: 'Com vantagem e lucrando' }, amarelo: { c: '#ffcf4d', t: 'Atenção: sem prova de vantagem' }, vermelho: { c: '#ff5c6c', t: 'Robô perdendo: recomendo manter desligado' }, cinza: { c: '#8392a1', t: 'Poucas operações para avaliar' } };

/** Velas REAIS (Foxbit) desfocadas ao fundo: só ambiente, sem valor numérico. */
function Backdrop({ candles }: { candles: Any[] }) {
  if (!candles.length) return null;
  const hi = Math.max(...candles.map((c) => c.h)), lo = Math.min(...candles.map((c) => c.l)), w = 1000 / candles.length;
  const y = (v: number) => 380 - ((v - lo) / (hi - lo || 1)) * 340;
  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[.22] blur-[3px]" viewBox="0 0 1000 400" preserveAspectRatio="none">
      {candles.map((c, i) => <g key={i} stroke={c.c >= c.o ? '#3ddc84' : '#ff5c6c'} fill={c.c >= c.o ? '#3ddc84' : '#ff5c6c'}><line x1={i * w + w / 2} x2={i * w + w / 2} y1={y(c.h)} y2={y(c.l)} /><rect x={i * w + w * 0.2} width={w * 0.6} y={Math.min(y(c.o), y(c.c))} height={Math.max(2, Math.abs(y(c.o) - y(c.c)))} /></g>)}
    </svg>
  );
}

/** Bolinha que percorre Scout → Filter → Analyst → Executor → Risk → Logger a cada operação. */
function Flow({ fire, active }: { fire: number; active?: string }) {
  const [step, setStep] = useState(-1);
  useEffect(() => { if (!fire) return; let i = 0; setStep(0); const id = setInterval(() => { i++; if (i >= AG.length) { clearInterval(id); setTimeout(() => setStep(-1), 500); } else setStep(i); }, 380); return () => clearInterval(id); }, [fire]);
  return (
    <div className="relative mx-auto flex max-w-2xl items-center justify-between px-2 py-4" aria-hidden>
      <div className="absolute left-6 right-6 top-1/2 h-px bg-white/10" />
      {AG.map((a, i) => { const on = step === i || active === a.id; return (
        <div key={a.id} className="relative z-10 flex flex-col items-center gap-1">
          <motion.span animate={{ scale: on ? 1.25 : 1, boxShadow: on ? `0 0 22px ${a.cor}` : '0 0 0 transparent' }} className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: a.cor, color: a.cor, background: on ? a.cor + '30' : '#05070a' }}>{a.ic}</motion.span>
          <span className="hidden text-[9px] tracking-widest sm:block" style={{ color: on ? a.cor : '#8392a1' }}>{a.nome}</span>
        </div>); })}
      {step >= 0 && <motion.span key={step} layoutId="ball" className="absolute top-1/2 z-20 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_0_16px_#fff]" style={{ left: `calc(1.5rem + ${(step / (AG.length - 1)) * 100}% * 0.92)` }} />}
    </div>
  );
}

function Gauge({ v, thr }: { v: number | null; thr: number }) {
  const ang = (x: number) => Math.PI * (1 - x), pt = (x: number, r: number) => [150 + r * Math.cos(ang(x)), 150 - r * Math.sin(ang(x))];
  const [nx, ny] = pt(v ?? 0, 95), [tx1, ty1] = pt(thr, 105), [tx2, ty2] = pt(thr, 125);
  return (
    <svg viewBox="0 0 300 175" className="mx-auto w-full max-w-sm" role="img" aria-label={`Nota ${v ?? 'sem sinal'} de 0 a 1`}>
      <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#ff5c6c" /><stop offset=".5" stopColor="#ffcf4d" /><stop offset="1" stopColor="#3ddc84" /></linearGradient></defs>
      <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="url(#g)" strokeWidth="16" strokeLinecap="round" opacity=".9" />
      <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#fff" strokeWidth="3" /><text x={tx2} y={ty2 - 6} fill="#fff" fontSize="10" textAnchor="middle">mín {thr.toFixed(2).replace('.', ',')}</text>
      {v != null && <motion.line initial={{ x2: 150, y2: 55 }} animate={{ x2: nx, y2: ny }} transition={{ type: 'spring', stiffness: 60, damping: 12 }} x1="150" y1="150" stroke="#a478ff" strokeWidth="4" strokeLinecap="round" />}
      <circle cx="150" cy="150" r="7" fill="#a478ff" /><text x="30" y="170" fill="#8392a1" fontSize="11">0</text><text x="262" y="170" fill="#8392a1" fontSize="11">1</text>
      <text x="150" y="130" fill="#e6edf3" fontSize="30" fontWeight="800" textAnchor="middle" fontFamily="JetBrains Mono Variable, monospace">{v == null ? '—' : v.toFixed(2).replace('.', ',')}</text>
    </svg>
  );
}

function Radar({ symbols, working }: { symbols: string[]; working: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-xs" role="img" aria-label="Radar de ativos monitorados">
      <svg viewBox="-100 -100 200 200" className="h-full w-full">
        {[30, 60, 90].map((r) => <circle key={r} r={r} fill="none" stroke="#4da3ff" strokeOpacity=".25" />)}
        <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}><path d="M0 0 L90 0 A90 90 0 0 0 63 -64 Z" fill="#4da3ff" opacity=".25" /><line x1="0" y1="0" x2="90" y2="0" stroke="#4da3ff" strokeWidth="1.5" /></motion.g>
        {symbols.map((s, i) => { const a = (i / Math.max(symbols.length, 1)) * Math.PI * 2 - 1, r = 40 + (i % 3) * 20; return (
          <g key={s}><motion.circle cx={r * Math.cos(a)} cy={r * Math.sin(a)} r="3.5" fill="#4da3ff" animate={{ opacity: [1, 0.25, 1], scale: [1, 1.6, 1] }} transition={{ repeat: Infinity, duration: 2 + (i % 3) * 0.5, delay: i * 0.3 }} />
            <text x={r * Math.cos(a) + 6} y={r * Math.sin(a) + 3} fill="#9ec9ff" fontSize="7" fontFamily="JetBrains Mono Variable, monospace">{s.replace('/', '')}</text></g>); })}
      </svg>
      <p className="mt-2 text-center text-xs text-scout">{working ? 'varrendo… par novo na fila' : 'monitorando'} · {symbols.length} ativos</p>
    </div>
  );
}

function RiskChart({ t, price }: { t: Any | null; price: number | null }) {
  if (!t) return <p className="py-8 text-center text-sm text-dim">Sem risco aberto. Nada para proteger agora.</p>;
  const trail = t.trailing_active ? t.peak_price * 0.98 : null;
  const vals = [t.entry_price, t.stop_price, t.target_price, price ?? t.entry_price, trail ?? t.stop_price], hi = Math.max(...vals) * 1.004, lo = Math.min(...vals) * 0.996;
  const y = (v: number) => 20 + (1 - (v - lo) / (hi - lo)) * 160;
  const L = (v: number, c: string, lab: string, dash = '5 4') => <g><line x1="10" x2="290" y1={y(v)} y2={y(v)} stroke={c} strokeDasharray={dash} /><text x="292" y={y(v) + 3} fill={c} fontSize="9" fontFamily="JetBrains Mono Variable, monospace">{lab}</text></g>;
  return (
    <svg viewBox="0 0 360 200" className="w-full" role="img" aria-label="Entrada, stop, trailing e preço">
      {L(t.target_price, '#3ddc84', 'alvo')}{L(t.entry_price, '#9aa3b2', 'entrada')}{L(t.stop_price, '#ff5c9a', 'stop')}{trail && L(trail, '#ffa94d', 'trailing', '2 3')}
      {price != null && <motion.g animate={{ y: 0 }}><motion.line x1="10" x2="290" animate={{ y1: y(price), y2: y(price) }} transition={{ type: 'spring', stiffness: 70 }} stroke="#fff" strokeWidth="2" /><text x="292" y={y(price) + 3} fill="#fff" fontSize="9" fontFamily="JetBrains Mono Variable, monospace">preço</text></motion.g>}
    </svg>
  );
}

export default function Desk({ demo }: { demo?: Any }) {
  const [d, setD] = useState<Any | null>(demo ?? null); const [err, setErr] = useState(''); const [tab, setTab] = useState<string>('desk'); const [candles, setCandles] = useState<Any[]>(demo?.__candles ?? []);
  const [fire, setFire] = useState(0); const seen = useRef<string | null>(null); const [price, setPrice] = useState<number | null>(demo?.__price ?? null); const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch('/api/desk').then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
    if (!r) return setErr('Sem conexão com o servidor.'); if (!r.ok) return setErr(r.j.error ?? 'erro'); setErr(''); setD(r.j);
  }, [demo]);
  useEffect(() => { load(); if (demo) return; const id = setInterval(load, 4000); return () => clearInterval(id); }, [load, demo]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (demo) return; fetch('/api/cripto/candles?symbol=BTC/BRL&tf=15m').then((x) => x.json()).then((j) => j.candles && setCandles(j.candles.slice(-90))).catch(() => {}); }, [demo]);
  useEffect(() => { // dispara a bolinha quando entra uma NOVA ordem (log do executor)
    const t = (d?.logs ?? []).find((l: Any) => l.agent === 'executor' && l.level === 'trade'); if (!t) return;
    if (seen.current === null) { seen.current = String(t.id); return; } if (seen.current !== String(t.id)) { seen.current = String(t.id); setFire((f) => f + 1); }
  }, [d]);
  useEffect(() => { // preço ao vivo da posição aberta (WebSocket oficial da Foxbit), só para o gráfico do Risk
    const sym = d?.open?.[0]?.symbol; if (demo || !sym || typeof WebSocket === 'undefined') return; const ms = String(sym).replace('/', '').toLowerCase();
    const ws = new WebSocket('wss://api.foxbit.com.br/ws/v3/public'); ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', params: [{ channel: 'ticker', market_symbol: ms }] }));
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.params?.channel === 'ticker' && m.data?.last_traded?.price) setPrice(Number(m.data.last_traded.price)); } catch { /* ignora */ } };
    return () => ws.close();
  }, [d?.open?.[0]?.symbol, demo]);

  if (err && !d) return <p role="alert" className="rounded-2xl border border-risk/40 bg-risk/10 p-4 text-sm text-risk">{err}</p>;
  if (!d) return <div className="space-y-3"><div className="skeleton h-40 w-full rounded-3xl" /><div className="skeleton h-72 w-full rounded-3xl" /></div>;
  const ago = (iso?: string) => (iso ? (now - new Date(iso).getTime()) / 1000 : 1e9);
  const st = (id: string) => (d.agents ?? []).find((a: Any) => a.agent === id) ?? { state: 'idle', detail: '' };
  const activeId = AG.find((a) => st(a.id).state === 'working' && ago(st(a.id).updated_at) < 90)?.id;
  const live = !err && (demo || now - d.at < 15000); const L = LAMP[d.health?.light ?? 'cinza'];
  const row = (id: string): string => {
    const a = st(id), c = d.counters;
    if (id === 'scout') return `${a.detail || (d.symbols ?? []).join(', ')}`;
    if (id === 'filter') return d.filterRefusals?.[0]?.message ? d.filterRefusals[0].message.replace(/^RECUSA /, '').slice(0, 60) : a.detail || 'sem descartes recentes';
    if (id === 'analyst') return d.lastScoreText ? d.lastScoreText.replace(/^(SINAL|RECUSA) /, '').slice(0, 60) : a.detail || 'aguardando sinal';
    if (id === 'executor') return d.lastClosed ? `última: ${brl(d.lastClosed.pnl, true)} · ${String(d.lastClosed.symbol).split('/')[0]}` : a.detail || 'nenhuma operação ainda';
    if (id === 'risk') return d.open?.[0] ? `stop ${Number(d.open[0].stop_price).toFixed(0)} · ${d.open[0].trailing_active ? 'trailing ativo' : 'trailing aguardando'}` : a.detail || 'sem risco aberto';
    return `${c.logger} motivos registrados`;
  };
  const cnt = (id: string) => ({ scout: `${d.counters.scout} sinais analisados hoje`, filter: `${d.counters.filter} eliminados${d.counters.scout ? ` (${Math.round((d.counters.filter / d.counters.scout) * 100)}%)` : ''}`, analyst: `${d.counters.analyst} pontuados`, executor: `${d.counters.executor} operação(ões) hoje · 1 posição por vez`, risk: `${d.counters.risk} avisos`, logger: `${d.counters.logger} motivos` } as Any)[id];
  const topo = d.open?.[0], maxDisc = Math.max(1, ...(d.discards ?? []).map((x: Any) => x.n));
  return (
    <div className="relative">
      <Backdrop candles={candles} />
      <nav className="sticky top-0 z-30 -mx-3 mb-4 flex gap-1 overflow-x-auto border-b border-white/10 bg-black/70 px-3 py-2 backdrop-blur" aria-label="Agentes">
        <button onClick={() => setTab('desk')} className={`shrink-0 rounded-md px-3 py-1.5 font-mono text-xs font-bold tracking-widest ${tab === 'desk' ? 'bg-white/10 text-white' : 'text-dim'}`}>DESK</button>
        {AG.map((a) => { const on = activeId === a.id || tab === a.id; return <button key={a.id} onClick={() => setTab(a.id)} className="shrink-0 rounded-md px-3 py-1.5 font-mono text-xs font-bold tracking-widest transition" style={{ color: on ? a.cor : '#8392a1', background: on ? a.cor + '1f' : 'transparent', boxShadow: activeId === a.id ? `0 0 14px ${a.cor}55` : 'none' }}>{a.nome}</button>; })}
      </nav>

      <div className="mb-4 flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: L.c + '66', background: L.c + '14' }} role="status">
        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: L.c, boxShadow: `0 0 18px ${L.c}` }} aria-hidden />
        <div className="min-w-0"><b className="block text-sm">Saúde do robô · {L.t}</b><span className="block text-xs text-dim">{d.health?.n ? `${brl(d.health.expectancy, true)} por operação · 30 dias reais · ${d.health.n} operações` : 'Sem operações reais nos últimos 30 dias'}</span></div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'desk' && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-white/10 bg-black/60 p-5 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-mono text-[11px] uppercase tracking-[0.25em] text-dim">Desk · 6 agents</p>
                    <p className="mt-1 font-mono text-4xl font-bold tabular-nums sm:text-5xl">{brl(d.equity)}</p>
                    <p className={`mt-1 font-mono text-lg font-semibold ${(d.dayPnl ?? 0) >= 0 ? 'text-executor' : 'text-risk'}`}>{brl(d.dayPnl, true)}{d.dayPct != null && <span className="text-sm opacity-80"> ({d.dayPct >= 0 ? '+' : '−'}{Math.abs(d.dayPct * 100).toFixed(2).replace('.', ',')}%)</span>}</p></div>
                  <div className="flex flex-col items-end gap-2"><span className={`rounded-full border px-3 py-1 font-mono text-[11px] font-bold ${live ? 'border-executor/60 text-executor' : 'border-risk/60 text-risk'}`}><span className={live ? 'animate-pulse' : ''}>●</span> {live ? 'AO VIVO' : 'SEM SINAL'}</span>
                    <div className="w-40"><LineChart data={d.curve ?? []} height={56} color={(d.dayPnl ?? 0) >= 0 ? '#3ddc84' : '#ff5c6c'} /></div></div>
                </div>
              </section>
              <Flow fire={fire} active={activeId} />
              <section className="divide-y divide-white/[.06] overflow-hidden rounded-3xl border border-white/10 bg-black/60 backdrop-blur" aria-label="Agentes">
                {AG.map((a) => (
                  <button key={a.id} onClick={() => setTab(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[.04]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold" style={{ color: a.cor, background: a.cor + '22' }}>{a.ic}</span>
                    <span className="min-w-0 flex-1"><b className="block text-sm font-extrabold tracking-wide" style={{ color: a.cor }}>{a.nome} <span className="font-medium text-dim">· {a.verbo}</span></b><span className="block truncate font-mono text-xs text-ink/80">{row(a.id)}</span></span>
                    <span className="hidden text-right font-mono text-[11px] text-dim sm:block">{cnt(a.id)}</span>
                  </button>))}
              </section>
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <section className="rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur" aria-label="Logger ao vivo"><h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em]" style={{ color: COR.logger }}>Logger · ao vivo</h2>
                  <ul className="max-h-80 space-y-1 overflow-y-auto font-mono text-xs">{(d.logs ?? []).length ? d.logs.slice(0, 40).map((l: Any) => <motion.li key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2"><span className="text-dim">{hhmm(l.ts)}</span><b style={{ color: COR[l.agent] ?? '#8392a1' }}>{String(l.agent).toUpperCase()}</b><span className={l.level === 'error' ? 'text-risk' : l.level === 'refuse' ? 'text-ink/70' : 'text-ink'}>{l.message}</span></motion.li>) : <li className="text-dim">Sem eventos hoje.</li>}</ul></section>
                <section className="rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur" aria-label="Por que foram descartados"><h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em]" style={{ color: COR.filter }}>Por que foram descartados</h2>
                  {(d.discards ?? []).length ? <ul className="space-y-2">{d.discards.map((x: Any) => <li key={x.reason}><div className="flex justify-between text-xs"><span>{x.reason}</span><b className="font-mono">{x.n}</b></div><div className="mt-1 h-1.5 rounded-full bg-white/5"><motion.div initial={{ width: 0 }} animate={{ width: `${(x.n / maxDisc) * 100}%` }} className="h-1.5 rounded-full" style={{ background: COR.filter }} /></div></li>)}</ul> : <p className="text-sm text-dim">Nenhum descarte hoje.</p>}</section>
              </div>
            </div>)}

          {tab === 'scout' && <Panel ag={AG[0]} sub="Varre os ativos e entrega novos pares ao Filter."><Radar symbols={d.symbols ?? []} working={activeId === 'scout'} /></Panel>}
          {tab === 'filter' && <Panel ag={AG[1]} sub="Elimina o que não presta: liquidez, spread, volatilidade, mercado lateral.">
            <ul className="space-y-2">{(d.filterRefusals ?? []).length ? d.filterRefusals.map((l: Any) => { const m = String(l.message).replace(/^RECUSA /, ''); const [sym, ...rest] = m.split(':'); return <li key={l.id} className="flex items-center gap-3 font-mono text-sm"><span className="text-dim">{hhmm(l.ts)}</span><span className="text-ink line-through decoration-risk decoration-2">{sym}</span><span className="flex-1 truncate text-dim">{rest.join(':').trim()}</span><span className="rounded border border-risk bg-risk/15 px-2 py-0.5 text-[10px] font-bold text-risk">FORA</span></li>; }) : <li className="text-sm text-dim">Nenhum ativo eliminado ainda hoje.</li>}</ul></Panel>}
          {tab === 'analyst' && <Panel ag={AG[2]} sub="Dá uma nota de 0 a 1. Só entra se passar do mínimo."><Gauge v={d.lastScore} thr={d.minScore} /><p className="mt-2 text-center font-mono text-xs text-dim">{d.lastScoreText ?? 'Aguardando o próximo sinal.'}</p></Panel>}
          {tab === 'executor' && <Panel ag={AG[3]} sub="Envia a ordem. Cada passo precisa estar certo.">
            {(() => { const t = topo ?? d.lastClosed; const ck = [['Passou no Filter', !!t], ['Passou no Analyst', !!t && (d.lastScore ?? 1) >= d.minScore], ['Risco ok (≤ 1% da conta, stop definido)', !!t]]; return (
              <div className="mx-auto max-w-md rounded-2xl border border-executor/40 bg-black/50 p-5 font-mono"><p className="mb-3 text-xs tracking-[0.3em] text-executor">BOLETA</p>
                <ul className="mb-4 space-y-1 text-sm">{ck.map(([l, ok]) => <li key={String(l)} className={ok ? 'text-executor' : 'text-dim'}>{ok ? '✓' : '·'} {l}</li>)}</ul>
                {t ? <dl className="grid grid-cols-2 gap-2 text-sm"><dt className="text-dim">Ativo</dt><dd>{t.symbol}</dd><dt className="text-dim">Preço</dt><dd>{Number(t.entry_price ?? 0).toLocaleString('pt-BR')}</dd>{topo && <><dt className="text-dim">Quantidade</dt><dd>{topo.qty}</dd><dt className="text-dim">Ordem na corretora</dt><dd className="truncate">{topo.entry_order_id ?? '—'}</dd></>}<dt className="text-dim">Status</dt><dd className="font-bold text-executor">{topo ? 'EM ANDAMENTO' : 'ENCERRADA'}</dd></dl> : <p className="text-sm text-dim">Nenhuma ordem ainda.</p>}</div>); })()}</Panel>}
          {tab === 'risk' && <Panel ag={AG[4]} sub="Entrada, stop e trailing. Se o preço tocar o stop: CORTOU.">
            <RiskChart t={topo ?? null} price={price} />
            {!topo && d.lastClosed && /stop/.test(String(d.lastClosed.exit_reason)) && <p className="mt-2 text-center"><span className="rounded border border-risk bg-risk/15 px-3 py-1 font-mono text-xs font-bold text-risk">CORTOU · {d.lastClosed.symbol} · {brl(d.lastClosed.pnl, true)}</span></p>}</Panel>}
          {tab === 'logger' && <Panel ag={AG[5]} sub="Relatório do dia, com os motivos.">
            <ul className="space-y-1 font-mono text-sm"><li className="text-executor">✓ {d.counters.executor} compra(s) executada(s)</li><li className="text-ink/80">✓ {d.counters.logger} recusa(s) registrada(s)</li>{(d.discards ?? []).map((x: Any) => <li key={x.reason} className="text-dim">✓ {x.reason}: {x.n}</li>)}
              <li className={`pt-2 text-lg font-bold ${(d.dayPnl ?? 0) >= 0 ? 'text-executor' : 'text-risk'}`}>Resultado do dia: {brl(d.dayPnl, true)}</li>{d.halted && <li className="text-risk">Parou por hoje: {d.haltedReason}</li>}</ul></Panel>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Panel({ ag, sub, children }: { ag: (typeof AG)[number]; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border bg-black/60 p-5 backdrop-blur sm:p-8" style={{ borderColor: ag.cor + '55' }}>
      <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl" style={{ color: ag.cor }}>{ag.nome} <span className="font-medium text-ink/70">· {ag.verbo}</span></h2>
      <p className="mb-6 mt-1 text-sm text-dim">{sub}</p>{children}
    </section>
  );
}
