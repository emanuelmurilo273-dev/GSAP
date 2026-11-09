'use client';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Help } from '@/components/Help';

type Any = Record<string, any>;
const brl = (v: number | null | undefined, sign = false) => (v == null ? '—' : `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const LIGHT: Record<string, { c: string; bg: string; t: string }> = {
  verde: { c: '#3ddc84', bg: 'rgba(61,220,132,.12)', t: 'VERDE' }, amarelo: { c: '#ffcf4d', bg: 'rgba(255,207,77,.12)', t: 'AMARELO' },
  vermelho: { c: '#ff5c6c', bg: 'rgba(255,92,108,.14)', t: 'VERMELHO' }, cinza: { c: '#8392a1', bg: 'rgba(131,146,161,.12)', t: 'SEM DADOS' },
};

function Lamp({ light }: { light: string }) {
  const l = LIGHT[light];
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {(['vermelho', 'amarelo', 'verde'] as const).map((k) => <span key={k} className="h-7 w-7 rounded-full border border-white/10 transition" style={{ background: k === light ? LIGHT[k].c : 'rgba(255,255,255,.05)', boxShadow: k === light ? `0 0 28px ${LIGHT[k].c}` : 'none' }} />)}
      <span className="sr-only">{l.t}</span>
    </div>
  );
}

export default function Saude({ demo }: { demo?: Any }) {
  const [d, setD] = useState<Any | null>(demo ?? null);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [phrase, setPhrase] = useState('');
  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch('/api/b3/saude').then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
    if (!r) return setErr('Sem conexão com o painel.'); if (!r.ok) return setErr(r.j.error ?? 'erro'); setErr(''); setD(r.j);
  }, [demo]);
  useEffect(() => { load(); if (demo) return; const id = setInterval(load, 6000); return () => clearInterval(id); }, [load, demo]);
  async function lock(action: 'lock' | 'unlock') {
    if (demo) return setMsg('Prévia com dados de exemplo.');
    const r = await fetch('/api/b3/lock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, phrase }) });
    const j = await r.json().catch(() => ({})); setMsg(r.ok ? 'Feito.' : j.error ?? 'erro'); if (r.ok) setPhrase(''); load();
  }
  if (err) return <p role="alert" className="rounded-2xl border border-risk/40 bg-risk/10 p-4 text-sm text-risk">{err}</p>;
  if (!d) return <div className="skeleton h-64 w-full rounded-3xl" />;
  const main = d.groups.find((g: Any) => g.id === d.current) ?? d.groups[0];
  const h = main.health, L = LIGHT[h.light];
  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border p-6 sm:p-8" style={{ borderColor: L.c + '55', background: L.bg }}>
        <div className="flex flex-wrap items-center justify-between gap-4"><Lamp light={h.light} /><span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: L.c }}>{L.t}</span></div>
        <h2 className="mt-5 text-2xl font-semibold leading-snug sm:text-3xl">{h.headline}</h2>
        <p className="mt-1 text-sm text-dim">{main.label} · {h.n} operações</p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Big label={<>Por operação<Help term="expectativa" /></>} value={h.n ? brl(h.expectancy, true) : '—'} color={h.expectancy >= 0 ? '#3ddc84' : '#ff5c6c'} />
          <Big label={<>Taxa de acerto<Help term="acerto" /></>} value={h.n ? `${(h.winRate * 100).toFixed(0)}%` : '—'} />
          <Big label={<>Fator de lucro<Help term="fator" /></>} value={h.profitFactor == null ? '—' : h.profitFactor === Infinity ? '∞' : h.profitFactor.toFixed(2).replace('.', ',')} />
          <Big label="Resultado total" value={brl(h.total, true)} color={h.total >= 0 ? '#3ddc84' : '#ff5c6c'} />
        </div>
        {h.n > 1 && h.ci && <p className="mt-5 text-xs text-dim">Margem de erro<Help term="ic" />: {brl(h.ci[0], true)} a {brl(h.ci[1], true)} por operação. {h.ci[0] <= 0 && h.ci[1] >= 0 ? 'A faixa inclui o zero: ainda não dá para afirmar se há lucro.' : ''}</p>}
        <ul className="mt-4 space-y-1 text-sm">{h.reasons.map((r: string) => <li key={r}>• {r}</li>)}</ul>
        {h.light === 'vermelho' && <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm">Quando a média por operação é negativa, operar mais só aumenta o prejuízo. Mantenha o robô no simulador.</p>}
      </motion.section>

      <section aria-label="Custos" className="rounded-3xl border border-white/[.07] bg-white/[.03] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-dim">Quanto os custos pesaram<Help term="emolumentos" /></h3>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <Big label="Antes dos custos" value={brl(main.costs.gross, true)} /><Big label="Custos pagos" value={brl(-main.costs.fees)} /><Big label="Resultado final" value={brl(main.costs.net, true)} color={main.costs.net >= 0 ? '#3ddc84' : '#ff5c6c'} />
        </div>
      </section>

      <section aria-label="Outras origens" className="grid gap-3 sm:grid-cols-3">
        {d.groups.map((g: Any) => { const gl = LIGHT[g.health.light]; return (
          <div key={g.id} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4">
            <p className="flex items-center gap-2 text-xs text-dim"><span className="h-2.5 w-2.5 rounded-full" style={{ background: gl.c }} />{g.label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{g.health.n ? brl(g.health.expectancy, true) : '—'}<span className="text-xs font-normal text-dim"> /operação</span></p>
            <p className="text-xs text-dim">{g.health.n} operações · {gl.t.toLowerCase()}</p>
          </div>); })}
      </section>

      <section aria-label="Trava do modo real" className="rounded-3xl border p-6" style={{ borderColor: d.lock.locked ? '#ff5c6c55' : '#3ddc8455' }}>
        <h3 className="text-lg font-semibold">{d.lock.locked ? '🔒 Modo real TRAVADO' : '🔓 Modo real destravado'}<Help term="trava" /></h3>
        <p className="mt-2 text-sm text-dim">{d.lock.locked ? (d.lock.reason ?? 'O robô só opera no simulador até você aprovar o diagnóstico (DIAGNOSTICO.md).') : 'Mesmo destravado, usar dinheiro de verdade ainda exige todas as confirmações da tela de Configurações.'}</p>
        {d.lock.locked ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-dim">Só destrave depois de ler o diagnóstico e concordar. Digite <b className="text-ink">LIBERAR APÓS DIAGNÓSTICO</b>:</p>
            <div className="flex flex-wrap gap-2"><input value={phrase} onChange={(e) => setPhrase(e.target.value)} className="!w-auto min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm" aria-label="Frase de confirmação" />
              <button onClick={() => lock('unlock')} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Destravar</button></div>
          </div>) : <button onClick={() => lock('lock')} className="mt-4 rounded-xl border border-risk/50 bg-risk/10 px-4 py-2 text-sm font-semibold text-risk hover:bg-risk hover:text-bg">Travar de novo e voltar ao simulador</button>}
        {msg && <p role="status" className="mt-3 text-sm text-filter">{msg}</p>}
      </section>
    </div>
  );
}

function Big({ label, value, color }: { label: React.ReactNode; value: string; color?: string }) {
  return <div><p className="text-xs text-dim">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl" style={color ? { color } : undefined}>{value}</p></div>;
}
