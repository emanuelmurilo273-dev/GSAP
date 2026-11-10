'use client';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Help } from '@/components/Help';

type Any = Record<string, any>;
const brl = (v: number, sign = false) => `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ORIG = [['internal', 'Simulador interno'], ['demo', 'Conta demo MT5'], ['real', 'Dinheiro real']] as const;
const asset = (c: string) => (String(c).startsWith('WIN') ? 'mini índice' : 'mini dólar');

export default function Historico({ demo }: { demo?: Any }) {
  const [d, setD] = useState<Any | null>(demo ?? null);
  const [o, setO] = useState<string>(demo?.origem ?? '');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch('/api/b3/historico' + (o ? `?origem=${o}` : '')).then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
    if (!r) return setErr('Sem conexão com o painel.'); if (!r.ok) return setErr(r.j.error ?? 'erro'); setErr(''); setD(r.j); if (!o) setO(r.j.origem);
  }, [o, demo]);
  useEffect(() => { load(); }, [load]);
  if (err) return <p role="alert" className="rounded-2xl border border-risk/40 bg-risk/10 p-4 text-sm text-risk">{err}</p>;
  if (!d) return <div className="skeleton h-48 w-full rounded-3xl" />;
  const t: Any[] = d.trades, total = t.reduce((a, x) => a + Number(x.pnl ?? 0), 0), wins = t.filter((x) => Number(x.pnl) > 0).length;
  const max = Math.max(1, ...d.days.map((x: Any) => Math.abs(x.pnl)));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Origem das operações">
        {ORIG.map(([k, l]) => <button key={k} role="tab" aria-selected={d.origem === k} onClick={() => { setO(k); setD(null); }} className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${d.origem === k ? 'border-executor bg-executor/15 text-executor' : 'border-white/10 text-dim hover:text-ink'}`}>{l}</button>)}
      </div>
      {d.origem === 'internal' && <p className="rounded-xl border border-filter/30 bg-filter/10 p-3 text-xs text-filter">Simulador interno: preços inventados. Serve para ver o robô funcionando, não para medir lucro.</p>}
      <section className="grid grid-cols-3 gap-3 text-center">
        <Box label="Operações" value={String(t.length)} />
        <Box label={<>Acerto<Help term="acerto" /></>} value={t.length ? `${Math.round((wins / t.length) * 100)}%` : '—'} />
        <Box label="Resultado" value={brl(total, true)} color={total >= 0 ? '#3ddc84' : '#ff5c6c'} />
      </section>
      {!!d.days.length && (
        <section aria-label="Resultado por dia" className="rounded-3xl border border-white/[.07] bg-white/[.03] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-dim">Resultado por dia</h2>
          <div className="relative flex h-32 items-stretch gap-1">
            <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/10" aria-hidden />
            {d.days.slice(-40).map((x: Any) => (
              <div key={x.day} className="relative flex-1" title={`${x.day}: ${brl(x.pnl, true)} (${x.n} op.)`}>
                <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} className="absolute inset-x-0 rounded-sm" style={{ height: `${Math.max(2, (Math.abs(x.pnl) / max) * 48)}%`, background: x.pnl >= 0 ? '#3ddc84' : '#ff5c6c', ...(x.pnl >= 0 ? { bottom: '50%', transformOrigin: 'bottom' } : { top: '50%', transformOrigin: 'top' }) }} />
              </div>))}
          </div>
        </section>)}
      <section aria-label="Operações">
        {!t.length ? <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-dim">Nenhuma operação encerrada nesta origem ainda.</p> : (
          <ul className="divide-y divide-white/[.06] overflow-hidden rounded-3xl border border-white/[.07] bg-white/[.03]">
            {t.slice(0, 100).map((x) => { const buy = x.side === 'buy', p = Number(x.pnl ?? 0); return (
              <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${buy ? 'bg-executor/15 text-executor' : 'bg-risk/15 text-risk'}`} aria-label={buy ? 'compra' : 'venda'}>{buy ? '↑' : '↓'}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{buy ? 'Compra' : 'Venda'} · {x.volume} {asset(x.contract)}</p>
                  <p className="truncate text-xs text-dim">{new Date(x.opened_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {x.close_reason ?? ''}</p></div>
                <p className={`font-mono text-sm font-semibold tabular-nums ${p >= 0 ? 'text-executor' : 'text-risk'}`}>{brl(p, true)}</p>
              </li>); })}
          </ul>)}
      </section>
    </div>
  );
}
function Box({ label, value, color }: { label: React.ReactNode; value: string; color?: string }) {
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><p className="text-xs text-dim">{label}</p><p className="mt-1 font-mono text-xl font-semibold tabular-nums" style={color ? { color } : undefined}>{value}</p></div>;
}
