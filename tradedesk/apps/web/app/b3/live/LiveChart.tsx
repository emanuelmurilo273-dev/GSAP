'use client';
import { ColorType, CrosshairMode, createChart, type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp } from 'lightweight-charts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorState, Panel, Stat, num } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

type Any = Record<string, any>;
type Bar = number[]; // [t, o, h, l, c, v] (t em segundos)
const STALE_MS = 5000;

const sma = (bars: Bar[], n: number) => bars.map((_, i) => (i + 1 < n ? null : { time: bars[i][0] as UTCTimestamp, value: bars.slice(i + 1 - n, i + 1).reduce((a, b) => a + b[4], 0) / n })).filter(Boolean) as { time: UTCTimestamp; value: number }[];
const ema = (bars: Bar[], n: number) => { const k = 2 / (n + 1); let e = 0; return bars.map((b, i) => ({ time: b[0] as UTCTimestamp, value: (e = i === 0 ? b[4] : b[4] * k + e * (1 - k)) })); };
/** VWAP do dia (reinicia a cada dia) usando o preço típico de cada candle. */
function vwap(bars: Bar[]) {
  let pv = 0, v = 0, day = -1;
  return bars.map((b) => { const d = Math.floor(b[0] / 86400); if (d !== day) { day = d; pv = 0; v = 0; } const tp = (b[2] + b[3] + b[4]) / 3; pv += tp * b[5]; v += b[5]; return { time: b[0] as UTCTimestamp, value: v ? pv / v : b[4] }; });
}

export default function LiveChart({ demo }: { demo?: Any }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const S = useRef<Any>({});
  const lines = useRef<IPriceLine[]>([]);
  const snap = useRef<Any | null>(demo ?? null);
  const [sym, setSym] = useState<string>('');
  const [tf, setTf] = useState<'M1' | 'M5' | 'M15'>('M1');
  const [view, setView] = useState<Any | null>(demo ?? null);   // book, T&T, fluxo, último tick (leve; o gráfico é atualizado direto)
  const [trades, setTrades] = useState<Any[]>([]);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [lastRecv, setLastRecv] = useState(0);
  const [channel, setChannel] = useState<'realtime' | 'polling' | '—'>('—');
  const symRef = useRef(sym), tfRef = useRef(tf);
  symRef.current = sym; tfRef.current = tf;

  // ── gráfico ──
  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true, layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9aa3b2' },
      grid: { vertLines: { color: 'rgba(255,255,255,.04)' }, horzLines: { color: 'rgba(255,255,255,.04)' } },
      crosshair: { mode: CrosshairMode.Normal }, timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,.1)' }, rightPriceScale: { borderColor: 'rgba(255,255,255,.1)' },
    });
    const candle = c.addCandlestickSeries({ upColor: '#3ddc84', downColor: '#ff5d5d', borderVisible: false, wickUpColor: '#3ddc84', wickDownColor: '#ff5d5d' });
    const vol = c.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', color: 'rgba(120,140,180,.35)' });
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const line = (color: string, w: 1 | 2 = 1) => c.addLineSeries({ color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    S.current = { candle, vol, vwap: line('#f5c542', 2), ema9: line('#58a6ff'), ema21: line('#c678dd'), sma50: line('#8b949e') };
    chart.current = c;
    return () => { c.remove(); chart.current = null; };
  }, []);

  const redraw = useCallback(() => {
    const s = snap.current?.symbols?.[symRef.current]; const o = S.current;
    if (!s || !o.candle) return;
    const bars: Bar[] = s.bars?.[tfRef.current] ?? [];
    o.candle.setData(bars.map((b) => ({ time: b[0] as UTCTimestamp, open: b[1], high: b[2], low: b[3], close: b[4] })));
    o.vol.setData(bars.map((b) => ({ time: b[0] as UTCTimestamp, value: b[5], color: b[4] >= b[1] ? 'rgba(61,220,132,.35)' : 'rgba(255,93,93,.35)' })));
    o.vwap.setData(vwap(bars)); o.ema9.setData(ema(bars, 9)); o.ema21.setData(ema(bars, 21)); o.sma50.setData(sma(bars, 50));
  }, []);

  // marcadores de compra/venda do robô + linhas de stop e alvo da posição aberta
  const drawTrades = useCallback((list: Any[]) => {
    const o = S.current; if (!o.candle) return;
    const sec = { M1: 60, M5: 300, M15: 900 }[tfRef.current];
    const mk: Any[] = [];
    for (const t of list.filter((x) => x.root === symRef.current || String(x.contract ?? '').startsWith(symRef.current))) {
      const tt = (iso: string) => Math.floor(Date.parse(String(iso).slice(0, 19) + 'Z') / 1000 / sec) * sec as UTCTimestamp;
      mk.push({ time: tt(t.opened_at), position: t.side === 'buy' ? 'belowBar' : 'aboveBar', shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown', color: t.side === 'buy' ? '#3ddc84' : '#ff5d5d', text: t.side === 'buy' ? 'compra' : 'venda' });
      if (t.closed_at) mk.push({ time: tt(t.closed_at), position: 'inBar', shape: 'circle', color: '#9aa3b2', text: `saída ${t.pnl != null ? num(Number(t.pnl)) : ''}` });
    }
    mk.sort((a, b) => a.time - b.time);
    o.candle.setMarkers(mk);
    lines.current.forEach((l) => o.candle.removePriceLine(l)); lines.current = [];
    for (const t of list.filter((x) => x.status === 'open' && (x.root === symRef.current || String(x.contract ?? '').startsWith(symRef.current)))) {
      lines.current.push(o.candle.createPriceLine({ price: Number(t.price_open), color: '#9aa3b2', lineStyle: 2, title: 'entrada' }));
      if (t.sl) lines.current.push(o.candle.createPriceLine({ price: Number(t.sl), color: '#ff5d5d', lineStyle: 0, title: 'stop' }));
      if (t.tp) lines.current.push(o.candle.createPriceLine({ price: Number(t.tp), color: '#3ddc84', lineStyle: 0, title: 'alvo' }));
    }
  }, []);

  const apply = useCallback((full: Any) => {
    snap.current = full;
    const names = Object.keys(full?.symbols ?? {});
    if (names.length && !symRef.current) { setSym(names[0]); symRef.current = names[0]; }
    redraw(); setView({ ...full }); setLastRecv(Date.now());
  }, [redraw]);

  // diferença (tick) → atualiza só o último candle (sem redesenhar tudo)
  const onDiff = useCallback((d: Any) => {
    const s = snap.current?.symbols?.[d.s]; if (!s) return;
    if (d.tick) { s.last = d.tick; s.last_tick_real_ms = d.real_ms ?? Date.now(); }
    if (d.book) s.book = d.book;
    if (d.trades?.length) s.trades = [...(s.trades ?? []), ...d.trades].slice(-60);
    for (const { tf: f, bar } of d.bars ?? []) {
      const arr: Bar[] = s.bars[f]; const last = arr[arr.length - 1];
      if (last && last[0] === bar[0]) arr[arr.length - 1] = bar; else arr.push(bar);
      if (d.s === symRef.current && f === tfRef.current) {
        const o = S.current; o.candle?.update({ time: bar[0], open: bar[1], high: bar[2], low: bar[3], close: bar[4] });
        o.vol?.update({ time: bar[0], value: bar[5], color: bar[4] >= bar[1] ? 'rgba(61,220,132,.35)' : 'rgba(255,93,93,.35)' });
      }
    }
    setLastRecv(Date.now());
    if (d.s === symRef.current) throttleView();
  }, []);
  const pending = useRef(false);
  const throttleView = () => { if (pending.current) return; pending.current = true; setTimeout(() => { pending.current = false; setView({ ...snap.current }); redraw(); }, 250); };

  // ── dados: snapshot inicial + Realtime (diferenças) + sondagem de 1 s como contingência ──
  useEffect(() => {
    if (demo) { apply(demo); setChannel('realtime'); return; }
    let alive = true, rt = false; const sb = supabaseBrowser();
    const poll = async () => {
      const r = await fetch('/api/b3/live', { cache: 'no-store' }).then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
      if (!alive) return;
      if (!r) return setErr('Sem conexão com o painel.');
      if (!r.ok) return setErr(r.j.error ?? 'erro');
      setErr('');
      if (r.j.snapshot && (!rt || Date.now() - lastRecvRef.current > 2000)) { apply(r.j.snapshot); if (!rt) setChannel('polling'); }
    };
    poll(); const id = setInterval(poll, 1000);
    const ch = sb.channel('b3-live').on('broadcast', { event: 'diff' }, ({ payload }) => { if (snap.current) onDiff(payload as Any); }).subscribe((st) => { rt = st === 'SUBSCRIBED'; if (rt) setChannel('realtime'); });
    return () => { alive = false; clearInterval(id); sb.removeChannel(ch); };
  }, [demo, apply, onDiff]);
  const lastRecvRef = useRef(0); lastRecvRef.current = lastRecv;

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);
  useEffect(() => { redraw(); drawTrades(trades); }, [sym, tf, redraw, drawTrades, trades]);
  useEffect(() => {
    if (demo) return setTrades(demo.__trades ?? []) as void;
    const load = async () => { const j = await fetch('/api/b3/state').then((x) => x.json()).catch(() => null); if (j) setTrades([...(j.open ?? []), ...(j.trades ?? [])]); };
    load(); const id = setInterval(load, 3000); return () => clearInterval(id);
  }, [demo]);

  if (err && !snap.current) return <ErrorState>{err}</ErrorState>;
  const full = view; const s = full?.symbols?.[sym];
  const names = Object.keys(full?.symbols ?? {});
  const lastTickMs: number = s?.last_tick_real_ms ?? 0;
  const age = demo ? 0.4 : lastTickMs ? (now - Math.max(lastTickMs, 0)) / 1000 : null;
  const stale = !demo && (age == null || age * 1000 > STALE_MS);
  const lastTxt = lastTickMs ? new Date(lastTickMs).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
  const fl = s?.flow ?? {};
  const book: Any[] = s?.book ?? [];
  const asks = book.filter((l) => l.side === 'sell').sort((a, b) => b.price - a.price).slice(-8);
  const bids = book.filter((l) => l.side === 'buy').sort((a, b) => b.price - a.price).slice(0, 8);
  const maxV = Math.max(1, ...book.map((l) => l.vol));

  return (
    <div className="space-y-3">
      {stale && <div role="alert" className="rounded-lg border border-risk/60 bg-risk/15 px-3 py-2 text-sm font-semibold text-risk">⚠ DADOS ATRASADOS — {age == null ? 'nenhum tick recebido ainda' : `sem tick há ${age.toFixed(0)} s`}. Não confie neste gráfico até voltar.</div>}
      <div className="flex flex-wrap items-center gap-2">
        {names.map((n) => <button key={n} onClick={() => setSym(n)} className={`rounded-md border px-3 py-1 text-xs font-bold ${n === sym ? 'border-executor bg-executor/15 text-executor' : 'border-white/10 text-dim'}`}>{n}</button>)}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {(['M1', 'M5', 'M15'] as const).map((t) => <button key={t} onClick={() => setTf(t)} className={`rounded-md border px-3 py-1 text-xs font-bold ${t === tf ? 'border-executor bg-executor/15 text-executor' : 'border-white/10 text-dim'}`}>{t}</button>)}
        <span className="ml-auto text-xs text-dim">último tick: <b className="text-ink">{lastTxt}</b> · canal: {channel === 'realtime' ? 'tempo real' : channel === 'polling' ? 'sondagem 1 s' : '—'}</span>
      </div>
      {!names.length ? <EmptyState>Ainda sem dados ao vivo. Ligue o conector (ele envia ticks, candles e livro de ofertas).</EmptyState> : (
        <div className="grid items-start gap-3 lg:grid-cols-[1fr_280px]">
          <Panel title={`${sym} · ${tf}`} right={<span className="text-[10px] text-dim"><i style={{ color: '#f5c542' }}>━</i> VWAP <i style={{ color: '#58a6ff' }}>━</i> EMA9 <i style={{ color: '#c678dd' }}>━</i> EMA21 <i style={{ color: '#8b949e' }}>━</i> MM50</span>}>
            <div ref={box} className="h-[420px] w-full" role="img" aria-label={`Gráfico de candles de ${sym}`} />
          </Panel>
          <div className="space-y-3">
            <Panel title="Livro de ofertas">
              {!book.length ? <p className="text-xs text-dim">Livro indisponível.</p> : (
                <table className="w-full text-xs tabular-nums"><tbody>
                  {asks.map((l) => <tr key={'a' + l.price} className="relative"><td className="text-risk">{num(l.price, 0)}</td><td className="text-right"><span className="inline-block bg-risk/25 px-1" style={{ minWidth: `${(l.vol / maxV) * 100}%` }}>{l.vol}</span></td></tr>)}
                  <tr><td colSpan={2} className="border-y border-white/10 py-1 text-center font-bold">{s?.last?.last ? num(s.last.last, 0) : '—'}</td></tr>
                  {bids.map((l) => <tr key={'b' + l.price}><td className="text-executor">{num(l.price, 0)}</td><td className="text-right"><span className="inline-block bg-executor/25 px-1" style={{ minWidth: `${(l.vol / maxV) * 100}%` }}>{l.vol}</span></td></tr>)}
                </tbody></table>)}
            </Panel>
            <Panel title="Agressão (60 s)">
              <div className="grid grid-cols-2 gap-2"><Stat label="Compra" value={num(fl.buy ?? 0, 0)} tone="pos" /><Stat label="Venda" value={num(fl.sell ?? 0, 0)} tone="neg" /><Stat label="Saldo" value={num(fl.delta ?? 0, 0)} tone={(fl.delta ?? 0) >= 0 ? 'pos' : 'neg'} /><Stat label="Lotes grandes" value={String(fl.big_lots ?? 0)} /></div>
            </Panel>
            <Panel title="Times & Trades">
              <div className="max-h-48 overflow-y-auto text-xs tabular-nums">{(s?.trades ?? []).slice(-25).reverse().map((t: Any, i: number) => <div key={i} className={`flex justify-between ${t.side === 'buy' ? 'text-executor' : 'text-risk'}`}><span>{new Date(t.t).toLocaleTimeString('pt-BR', { timeZone: 'UTC' })}</span><span>{num(t.p, 0)}</span><span>{t.v}</span></div>)}</div>
            </Panel>
          </div>
        </div>)}
    </div>
  );
}
