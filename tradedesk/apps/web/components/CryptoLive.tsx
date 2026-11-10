'use client';
import { ColorType, CrosshairMode, createChart, type IChartApi, type IPriceLine, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

type C = { t: number; o: number; h: number; l: number; c: number; v: number };
type Any = Record<string, any>;
const SYMS = ['BTC/BRL', 'ETH/BRL', 'SOL/BRL'] as const;
const TFS = { '1m': 60, '5m': 300, '15m': 900 } as const;
const STALE_MS = 5000;
const WS_URL = 'wss://api.foxbit.com.br/ws/v3/public';      // WebSocket oficial da Foxbit (mercado, sem chave)

const ema = (c: C[], n: number) => { const k = 2 / (n + 1); let e = 0; return c.map((b, i) => ({ time: (b.t / 1000) as UTCTimestamp, value: (e = i === 0 ? b.c : b.c * k + e * (1 - k)) })); };
const vwap = (c: C[]) => { let pv = 0, v = 0, d = -1; return c.map((b) => { const day = Math.floor((b.t - 3 * 3600_000) / 86_400_000); if (day !== d) { d = day; pv = 0; v = 0; } pv += ((b.h + b.l + b.c) / 3) * b.v; v += b.v; return { time: (b.t / 1000) as UTCTimestamp, value: v ? pv / v : b.c }; }); };
const money = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Gráfico ao vivo de cripto: histórico real (REST) + candle em formação alimentado pelos negócios do WebSocket oficial da Foxbit.
 *  Marcações reais do robô (entrada, saída, stop, alvo). Alerta "dados atrasados" se passar de 5 s sem mensagem. */
export default function CryptoLive({ clean = false, demo }: { clean?: boolean; demo?: { candles: C[]; trades?: Any[] } }) {
  const box = useRef<HTMLDivElement>(null); const chart = useRef<IChartApi | null>(null); const S = useRef<Any>({});
  const lines = useRef<IPriceLine[]>([]); const candles = useRef<C[]>([]);
  const [sym, setSym] = useState<(typeof SYMS)[number]>('BTC/BRL'); const [tf, setTf] = useState<keyof typeof TFS>(clean ? '5m' : '1m');
  const [last, setLast] = useState<number | null>(null); const [lastMsg, setLastMsg] = useState(0); const [now, setNow] = useState(Date.now());
  const [px, setPx] = useState<{ last?: number; bid?: number; ask?: number }>({}); const [tape, setTape] = useState<Any[]>([]);
  const [err, setErr] = useState(''); const [trades, setTrades] = useState<Any[]>(demo?.trades ?? []); const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, { autoSize: true, layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9aa3b2' }, grid: { vertLines: { color: 'rgba(255,255,255,.04)' }, horzLines: { color: 'rgba(255,255,255,.04)' } }, crosshair: { mode: CrosshairMode.Normal }, timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,.1)' }, rightPriceScale: { borderColor: 'rgba(255,255,255,.1)' } });
    const candle = c.addCandlestickSeries({ upColor: '#3ddc84', downColor: '#ff5d5d', borderVisible: false, wickUpColor: '#3ddc84', wickDownColor: '#ff5d5d', priceFormat: { type: 'price', precision: 0, minMove: 1 } });
    const vol = c.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', color: 'rgba(120,140,180,.35)' }); c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const line = (color: string, w: 1 | 2 = 1) => c.addLineSeries({ color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    S.current = { candle, vol, vwap: line('#f5c542', 2), e9: line('#58a6ff'), e21: line('#c678dd') };
    if (clean) for (const k of ['vol', 'vwap', 'e9', 'e21']) S.current[k].applyOptions({ visible: false });
    chart.current = c; return () => { c.remove(); chart.current = null; };
  }, [clean]);

  const draw = () => {
    const o = S.current, c = candles.current; if (!o.candle) return;
    o.candle.setData(c.map((b) => ({ time: (b.t / 1000) as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c })));
    o.vol.setData(c.map((b) => ({ time: (b.t / 1000) as UTCTimestamp, value: b.v, color: b.c >= b.o ? 'rgba(61,220,132,.35)' : 'rgba(255,93,93,.35)' })));
    o.vwap.setData(vwap(c)); o.e9.setData(ema(c, 9)); o.e21.setData(ema(c, 21));
  };
  const marks = (list: Any[]) => {
    const o = S.current; if (!o.candle) return; const sec = TFS[tf], mk: any[] = [];
    const slot = (iso: string) => (Math.floor(Date.parse(iso) / 1000 / sec) * sec) as UTCTimestamp;
    for (const t of list.filter((x) => x.symbol === sym)) {
      mk.push({ time: slot(t.openedAt), position: 'belowBar', shape: 'arrowUp', color: '#3ddc84', text: 'compra' });
      if (t.closedAt) mk.push({ time: slot(t.closedAt), position: 'aboveBar', shape: 'arrowDown', color: t.pnl >= 0 ? '#3ddc84' : '#ff5d5d', text: `saída ${t.pnl >= 0 ? '+' : '−'}R$ ${money(Math.abs(t.pnl ?? 0))}` });
    }
    mk.sort((a, b) => a.time - b.time); o.candle.setMarkers(mk);
    lines.current.forEach((l) => o.candle.removePriceLine(l)); lines.current = [];
    for (const t of list.filter((x) => x.status === 'open' && x.symbol === sym)) {
      lines.current.push(o.candle.createPriceLine({ price: t.entry, color: '#9aa3b2', lineStyle: 2, title: 'entrada' }));
      if (t.stop) lines.current.push(o.candle.createPriceLine({ price: t.stop, color: '#ff5d5d', lineStyle: 0, title: 'stop' }));
      if (t.target) lines.current.push(o.candle.createPriceLine({ price: t.target, color: '#3ddc84', lineStyle: 0, title: 'alvo' }));
    }
  };

  // histórico real
  useEffect(() => {
    let alive = true; setReady(false); setErr('');
    (async () => {
      if (demo) { candles.current = demo.candles; draw(); marks(trades); setLastMsg(Date.now()); setReady(true); return; }
      const r = await fetch(`/api/cripto/candles?symbol=${encodeURIComponent(sym)}&tf=${tf}`).then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
      if (!alive) return; if (!r?.ok) return setErr(r?.j?.error ?? 'Sem conexão com a Foxbit.');
      candles.current = r.j.candles; draw(); setReady(true);
    })();
    return () => { alive = false; };
  }, [sym, tf]);
  useEffect(() => { if (ready) marks(trades); }, [trades, sym, tf, ready]);
  useEffect(() => { if (demo) return; const f = () => fetch('/api/trades').then((x) => x.json()).then((j) => j.trades && setTrades(j.trades)).catch(() => {}); f(); const id = setInterval(f, 5000); return () => clearInterval(id); }, [demo]);

  // WebSocket oficial: negócios + ticker. Reconecta sozinho; ping a cada 20 s.
  useEffect(() => {
    if (demo) return;
    let ws: WebSocket | null = null, alive = true, retry = 0, ping: any;
    const market = sym.replace('/', '').toLowerCase();
    const open = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => { retry = 0; ws!.send(JSON.stringify({ type: 'subscribe', params: [{ channel: 'trades', market_symbol: market }, { channel: 'ticker', market_symbol: market }] })); ping = setInterval(() => ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'message', params: [{ channel: 'ping' }] })), 20000); };
      ws.onmessage = (ev) => {
        let m: Any; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.event !== 'update') return; setLastMsg(Date.now());
        if (m.params?.channel === 'ticker' && m.data) setPx({ last: Number(m.data.last_traded?.price), bid: Number(m.data.best?.bid), ask: Number(m.data.best?.ask) });
        if (m.params?.channel === 'trade' && Array.isArray(m.data)) {
          const sec = TFS[tf] * 1000, cs = candles.current;
          for (const t of m.data) {
            const p = Number(t.price), q = Number(t.quantity), bucket = Math.floor(Number(t.ts) / sec) * sec; if (!cs.length) continue;
            const lastC = cs[cs.length - 1];
            if (lastC.t === bucket) { lastC.h = Math.max(lastC.h, p); lastC.l = Math.min(lastC.l, p); lastC.c = p; lastC.v += q; }
            else if (bucket > lastC.t) cs.push({ t: bucket, o: p, h: p, l: p, c: p, v: q });
            else continue;
            const b = cs[cs.length - 1];
            S.current.candle?.update({ time: (b.t / 1000) as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c });
            S.current.vol?.update({ time: (b.t / 1000) as UTCTimestamp, value: b.v, color: b.c >= b.o ? 'rgba(61,220,132,.35)' : 'rgba(255,93,93,.35)' });
          }
          setLast(Number(m.data[m.data.length - 1].ts));
          setTape((x) => [...m.data.map((t: Any) => ({ ts: t.ts, p: Number(t.price), q: Number(t.quantity), side: t.taker_side })).reverse(), ...x].slice(0, 30));
        }
      };
      ws.onclose = () => { clearInterval(ping); if (alive) setTimeout(open, Math.min(15000, 1000 * 2 ** retry++)); };
      ws.onerror = () => ws?.close();
    };
    open(); return () => { alive = false; clearInterval(ping); ws?.close(); };
  }, [sym, tf, demo]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);

  const age = lastMsg ? (now - lastMsg) / 1000 : null; const stale = !demo && (age == null || age * 1000 > STALE_MS);
  const lastTxt = last ? new Date(last).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : lastMsg ? new Date(lastMsg).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
  return (
    <div className="space-y-3">
      {stale && <div role="alert" className="rounded-xl border border-risk/60 bg-risk/15 px-3 py-2 text-sm font-semibold text-risk">⚠ DADOS ATRASADOS — {age == null ? 'aguardando o primeiro dado' : `sem dados há ${age.toFixed(0)} s`}. Não confie neste gráfico até voltar.</div>}
      {err && <p role="alert" className="text-sm text-risk">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!clean && SYMS.map((s) => <button key={s} onClick={() => setSym(s)} className={`rounded-md border px-3 py-1 text-xs font-bold ${s === sym ? 'border-executor bg-executor/15 text-executor' : 'border-white/10 text-dim'}`}>{s}</button>)}
        {!clean && (Object.keys(TFS) as (keyof typeof TFS)[]).map((t) => <button key={t} onClick={() => setTf(t)} className={`rounded-md border px-3 py-1 text-xs font-bold ${t === tf ? 'border-executor bg-executor/15 text-executor' : 'border-white/10 text-dim'}`}>{t}</button>)}
        <span className="ml-auto text-xs text-dim">{px.last ? <b className="mr-2 text-ink">R$ {money(px.last)}</b> : null}último dado: <b className="text-ink">{lastTxt}</b></span>
      </div>
      <div className={`grid items-start gap-3 ${clean ? '' : 'lg:grid-cols-[1fr_260px]'}`}>
        <div ref={box} className={`${clean ? 'h-[300px] sm:h-[360px]' : 'h-[420px]'} w-full rounded-2xl border border-white/[.07] bg-white/[.02]`} role="img" aria-label={`Gráfico de ${sym}`} />
        {!clean && <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-dim">Negócios ao vivo</p>
          <div className="max-h-[390px] overflow-y-auto font-mono text-xs tabular-nums">{!tape.length ? <p className="text-dim">Aguardando negócios…</p> : tape.map((t, i) => <div key={i} className={`flex justify-between ${t.side === 'BUY' ? 'text-executor' : 'text-risk'}`}><span>{new Date(t.ts).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span><span>{money(t.p)}</span><span>{t.q.toFixed(5)}</span></div>)}</div></div>}
      </div>
      {!clean && <p className="text-[11px] text-dim"><i style={{ color: '#f5c542' }}>━</i> VWAP do dia · <i style={{ color: '#58a6ff' }}>━</i> EMA9 · <i style={{ color: '#c678dd' }}>━</i> EMA21 · setas: entradas e saídas reais do robô · linhas: stop (vermelho) e alvo (verde).</p>}
    </div>
  );
}
