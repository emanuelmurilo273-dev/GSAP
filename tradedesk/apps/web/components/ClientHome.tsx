'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import CryptoLive from '@/components/CryptoLive';
import { b3Status } from '@/lib/market';

type Any = Record<string, any>;
const brl = (v: number | null | undefined, sign = false) => (v == null ? '—' : `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const LAMP: Record<string, { c: string; t: string }> = { verde: { c: '#3ddc84', t: 'Com vantagem e lucrando' }, amarelo: { c: '#ffcf4d', t: 'Atenção' }, vermelho: { c: '#ff5c6c', t: 'Perdendo — recomendo parar' }, cinza: { c: '#8392a1', t: 'Poucos dados ainda' } };

/** Frase do robô em português humano. Nunca promete nada: descreve o que está acontecendo. */
export function sentence(d: Any): string {
  if (!d.connected) return 'Falta conectar a sua corretora para eu começar. Toque em "Começar".';
  if (d.pausedReason && !d.enabled) return d.pausedReason;
  if (d.halted) return /SEGUIDAS|seguidas/.test(d.haltedReason ?? '') ? 'Parei por hoje: tive uma perda e, por segurança, não insisto no mesmo dia.' : 'Parei por hoje: bati o limite de perda que você definiu.';
  if (!d.enabled) return 'Estou desligado. Ligue o botão quando quiser que eu volte a procurar oportunidades.';
  if (d.open?.length) { const t = d.open[0]; return `Estou comprado em ${String(t.symbol).split('/')[0]}. A proteção (stop) já está na corretora. Toque em "Histórico" para ver o porquê.`; }
  const r = (d.logs ?? []).find((l: Any) => l.agent !== 'risk' && /RECUSA|SINAL/.test(l.message));
  if (r && Date.now() - new Date(r.ts).getTime() < 3600_000 && /RECUSA/.test(r.message)) return `Vi uma oportunidade, mas não entrei: ${String(r.message).replace(/^RECUSA [^:]+:\s*/, '').slice(0, 110)}.`;
  return 'Procurando oportunidade. Operar pouco e só nos bons momentos é de propósito.';
}

export default function ClientHome({ demo }: { demo?: Any }) {
  const [d, setD] = useState<Any | null>(demo ?? null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch('/api/home').then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
    if (!r) return setErr('Sem conexão com o servidor.'); if (!r.ok) return setErr(r.j.error ?? 'erro'); setErr(''); setD(r.j);
  }, [demo]);
  useEffect(() => { load(); if (demo) return; const id = setInterval(load, 8000); return () => clearInterval(id); }, [load, demo]);
  if (err) return <p role="alert" className="rounded-2xl border border-risk/40 bg-risk/10 p-4 text-sm text-risk">{err}</p>;
  if (!d) return <div className="space-y-4"><div className="skeleton h-40 w-full rounded-3xl" /><div className="skeleton h-28 w-full rounded-3xl" /></div>;
  const on = !!d.enabled, L = LAMP[d.health?.light ?? 'cinza'], st = b3Status();
  async function toggle() {
    if (demo || busy) return;
    setBusy(true); const r = await fetch('/api/bot/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: !on }) }); const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) alert(j.error ?? 'erro'); load();
  }
  async function panic() {
    if (demo || !confirm('PARAR TUDO: fechar as posições abertas e desligar o robô agora?')) return;
    await fetch('/api/bot/close-all', { method: 'POST' }); load();
  }
  const tone = (d.dayPnl ?? 0) > 0 ? 'text-executor' : (d.dayPnl ?? 0) < 0 ? 'text-risk' : 'text-dim';
  const crypto = d.open?.length ? `comprado em ${d.open.map((t: Any) => String(t.symbol).split('/')[0]).join(', ')}` : d.halted ? 'parou por hoje' : on ? 'procurando oportunidade' : 'desligado';
  const b3 = d.b3 ? (d.b3.positions?.length ? `em operação, ${d.b3.positions[0].side === 'buy' ? 'comprado' : 'vendido'} ${d.b3.positions[0].volume} ${String(d.b3.positions[0].symbol).startsWith('WIN') ? 'WIN' : 'WDO'}` : st.open ? (d.b3.enabled ? 'procurando oportunidade' : 'desligado') : st.text) : null;
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="pt-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dim">Saldo na corretora{d.exchange ? ` · ${d.exchange}` : ''}</p>
        <motion.p key={Math.round(d.equity ?? 0)} initial={{ opacity: 0.4, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 text-5xl font-semibold tracking-tight tabular-nums sm:text-7xl">{brl(d.equity)}</motion.p>
        <p className={`mt-3 text-xl font-semibold tabular-nums sm:text-2xl ${tone}`}>Hoje: {brl(d.dayPnl, true)}{d.dayPct != null && <span className="text-base font-medium opacity-80"> ({d.dayPct >= 0 ? '+' : '−'}{Math.abs(d.dayPct * 100).toFixed(1).replace('.', ',')}%)</span>}</p>
        {d.error && <p className="mt-2 text-xs text-filter">{d.error}</p>}
      </section>

      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <button onClick={toggle} disabled={busy || !d.connected} aria-pressed={on} className={`flex h-24 w-full items-center justify-center rounded-3xl text-2xl font-bold tracking-wide transition active:scale-[.985] disabled:opacity-50 sm:h-28 sm:text-3xl ${on ? 'bg-executor text-bg shadow-[0_10px_60px_-10px_rgba(61,220,132,.55)]' : 'border border-white/15 bg-white/[.04] text-ink hover:bg-white/[.07]'}`}>
          <span className="flex flex-col items-center leading-tight"><span className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${on ? 'animate-pulse bg-bg' : 'bg-dim'}`} />{on ? 'ROBÔ LIGADO' : 'LIGAR O ROBÔ'}</span><span className={`mt-1 text-xs font-medium tracking-normal ${on ? 'text-bg/70' : 'text-dim'}`}>{on ? 'toque para desligar' : d.connected ? 'toque para começar' : 'conecte a corretora primeiro'}</span></span>
        </button>
        <button onClick={panic} className="rounded-2xl border border-risk/50 bg-risk/10 py-3 text-sm font-bold uppercase tracking-widest text-risk hover:bg-risk hover:text-bg">Parar tudo</button>
      </div>

      <motion.p key={sentence(d)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-xl text-center text-lg leading-relaxed text-ink/90 sm:text-xl">“{sentence(d)}”</motion.p>

      <section aria-label="Status por mercado" className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-dim">Cripto · 24h</p><p className="mt-1 text-sm font-medium">{crypto.charAt(0).toUpperCase() + crypto.slice(1)}</p></div>
        {b3 !== null && <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-dim">B3 · WIN e WDO</p><p className="mt-1 text-sm font-medium">{b3.charAt(0).toUpperCase() + b3.slice(1)}</p></div>}
      </section>

      <Link href="/app/estatisticas" className="flex items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.03] p-4 transition hover:border-white/20" aria-label={`Saúde do robô: ${L.t}`}>
        <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: L.c, boxShadow: `0 0 22px ${L.c}` }} aria-hidden />
        <span className="min-w-0 flex-1"><b className="block text-sm">Saúde do robô · {L.t}</b><span className="block truncate text-xs text-dim">{d.health?.n ? `${brl(d.health.expectancy, true)} por operação · últimos 30 dias · ${d.health.n} operações` : 'Sem operações reais nos últimos 30 dias'}</span></span><span className="text-dim" aria-hidden>→</span>
      </Link>

      {!d.connected && <Link href="/app/onboarding" className="block rounded-2xl border border-executor/40 bg-executor/10 p-4 text-center text-sm font-medium text-executor hover:bg-executor/15">Primeira vez aqui? Faça o passo a passo de 3 minutos →</Link>}

      <section aria-label="Gráfico ao vivo"><CryptoLive clean /></section>
    </div>
  );
}
