'use client';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import LiveChart from './live/LiveChart';

type Any = Record<string, any>;
const brl = (v: number, sign = false) => `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const asset = (c: string) => (String(c).startsWith('WIN') ? 'mini índice' : 'mini dólar');

/** Frase do robô em linguagem humana, a partir do estado atual. */
export function robotSentence(d: Any): string {
  const s = d.settings ?? {}, st = d.status ?? {};
  const alive = d.connectorAgeSec != null && d.connectorAgeSec < 20;
  if (!alive) return 'Estou desligado do computador: o programa conector não está rodando.';
  const open: Any[] = d.open ?? [];
  if (open.length) { const t = open[0]; return `${t.side === 'buy' ? 'Comprei' : 'Vendi'} ${t.volume} ${asset(t.contract)} porque ${t.side === 'buy' ? 'o preço mostrou força de alta' : 'o preço mostrou força de queda'}. A proteção (stop) já está na corretora; toque em “por quê?” na operação para ver o detalhe.`; }
  if (st.halted) {
    const m = (d.logs ?? []).find((l: Any) => /PERDAS SEGUIDAS|limite de perda|META DI/i.test(l.message));
    return /SEGUIDAS/i.test(m?.message ?? '') ? 'Parei por hoje: tive duas perdas seguidas e prefiro não insistir.' : /META/i.test(m?.message ?? '') ? 'Parei por hoje: a meta do dia foi atingida.' : 'Parei por hoje: atingi o limite de perda que você definiu.';
  }
  if (st.state === 'closed_holiday') return 'O mercado está fechado hoje (fim de semana ou feriado).';
  if (st.state === 'outside_hours') return 'Estou fora do horário de operar. Volto no próximo pregão.';
  if (st.state === 'max_trades') return 'Parei por hoje: cheguei ao número máximo de operações do dia.';
  if (!s.enabled) return 'Estou pausado. Ligue o botão acima quando quiser que eu volte a procurar oportunidades.';
  const dec: Any | undefined = (d.decisions ?? [])[0];
  if (dec && Date.now() - new Date(dec.ts).getTime() < 15 * 60_000 && dec.decision === 'nao_entrou') return `Vi um sinal, mas não entrei: ${String(dec.reason).replace(/^Não entrei:\s*/i, '').toLowerCase()}.`;
  return 'Estou esperando o mercado mostrar uma direção clara. Operar pouco e só os bons momentos é de propósito.';
}

function whyOf(t: Any): string {
  if (t.why) return t.why;
  const r = String(t.close_reason ?? '');
  return `${t.side === 'buy' ? 'Comprei' : 'Vendi'} quando as médias de preço indicaram ${t.side === 'buy' ? 'alta' : 'queda'}. ${r ? 'Saí por: ' + (/fim de dia/.test(r) ? 'fim do pregão.' : /stop|alvo/.test(r) ? 'o preço bateu o stop ou o alvo na corretora.' : r + '.') : ''}`;
}

function TradeCard({ t }: { t: Any }) {
  const [open, setOpen] = useState(false);
  const buy = t.side === 'buy', pnl = t.pnl == null ? null : Number(t.pnl);
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4">
      <div className="flex items-center gap-3">
        <span aria-label={buy ? 'compra' : 'venda'} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${buy ? 'bg-executor/15 text-executor' : 'bg-risk/15 text-risk'}`}>{buy ? '↑' : '↓'}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{buy ? 'Compra' : 'Venda'} · {t.volume} {asset(t.contract)}</p>
          <p className="text-xs text-dim">{hhmm(t.opened_at)}{t.status === 'open' ? ' · em andamento' : ''}</p>
        </div>
        <p className={`text-right text-lg font-bold tabular-nums ${pnl == null ? 'text-dim' : pnl >= 0 ? 'text-executor' : 'text-risk'}`}>{pnl == null ? '…' : brl(pnl, true)}</p>
      </div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-3 text-xs font-medium text-dim underline-offset-4 hover:text-ink hover:underline">{open ? 'fechar' : 'por quê?'}</button>
      <AnimatePresence>{open && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-2 text-sm leading-relaxed text-ink/90">{whyOf(t)}</motion.p>}</AnimatePresence>
    </motion.li>
  );
}

const LAMP: Record<string, { c: string; t: string }> = { verde: { c: '#3ddc84', t: 'Com vantagem e lucrando' }, amarelo: { c: '#ffcf4d', t: 'Atenção' }, vermelho: { c: '#ff5c6c', t: 'Perdendo — recomendo parar' }, cinza: { c: '#8392a1', t: 'Ainda poucos dados' } };

function SaudeCard({ sa }: { sa: Any }) {
  const g = sa.groups?.find((x: Any) => x.id === sa.current) ?? sa.groups?.[0];
  if (!g) return null;
  const h = g.health, L = LAMP[h.light];
  return (
    <Link href="/b3/saude" className="flex items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.03] p-4 transition hover:border-white/20" aria-label={`Saúde do robô: ${h.headline}`}>
      <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: L.c, boxShadow: `0 0 22px ${L.c}` }} aria-hidden />
      <span className="min-w-0 flex-1"><b className="block text-sm">Saúde do robô · {L.t}</b><span className="block truncate text-xs text-dim">{h.n ? `${brl(h.expectancy, true)} por operação · ${h.n} operações` : 'Sem operações ainda'}</span></span>
      <span className="text-dim" aria-hidden>→</span>
    </Link>
  );
}

export default function Home({ demo }: { demo?: Any }) {
  const [d, setD] = useState<Any | null>(demo ?? null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sa, setSa] = useState<Any | null>(demo?.__saude ?? null);
  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch('/api/b3/state').then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
    if (!r) return setErr('Sem conexão com o painel.');
    if (!r.ok) return setErr(r.j.error ?? 'erro');
    setErr(''); setD(r.j);
  }, [demo]);
  useEffect(() => { load(); if (demo) return; const id = setInterval(load, 3000); return () => clearInterval(id); }, [load, demo]);
  useEffect(() => { if (demo) return; const f = () => fetch('/api/b3/saude').then((x) => x.json()).then((j) => !j.error && setSa(j)).catch(() => {}); f(); const id = setInterval(f, 15000); return () => clearInterval(id); }, [demo]);

  if (err) return <p role="alert" className="rounded-2xl border border-risk/40 bg-risk/10 p-4 text-sm text-risk">{err}</p>;
  if (!d) return <div className="space-y-4"><div className="skeleton h-40 w-full rounded-3xl" /><div className="skeleton h-28 w-full rounded-3xl" /></div>;
  const s = d.settings ?? {}, st = d.status ?? {};
  const on = !!s.enabled, alive = d.connectorAgeSec != null && d.connectorAgeSec < 20;
  const equity = Number(st.equity ?? st.balance ?? 0), day = Number(st.day_pnl ?? 0);
  const start = equity - day, dayPct = start > 0 ? (day / start) * 100 : 0;
  const cards: Any[] = [...(d.open ?? []), ...(d.trades ?? [])].slice(0, 8);
  async function toggle() {
    if (demo || busy) return;
    if (!on && s.mode === 'real' && !confirm('Você está no modo REAL (dinheiro de verdade). Ligar o robô?')) return;
    setBusy(true);
    await fetch('/api/b3/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: on ? 'pause' : 'start' }) });
    setBusy(false); load();
  }
  const tone = day > 0 ? 'text-executor' : day < 0 ? 'text-risk' : 'text-dim';
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="pt-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dim">{s.mode === 'real' ? 'Saldo na corretora' : 'Saldo simulado'}</p>
        <motion.p key={Math.round(equity)} initial={{ opacity: 0.4, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 text-5xl font-semibold tracking-tight tabular-nums sm:text-7xl">{brl(equity)}</motion.p>
        <p className={`mt-3 text-xl font-semibold tabular-nums sm:text-2xl ${tone}`}>Hoje: {brl(day, true)} <span className="text-base font-medium opacity-80">({dayPct >= 0 ? '+' : '−'}{Math.abs(dayPct).toFixed(1).replace('.', ',')}%)</span></p>
      </section>

      <button onClick={toggle} disabled={busy || !alive} aria-pressed={on}
        className={`group relative mx-auto flex h-24 w-full max-w-xl items-center justify-center rounded-3xl text-2xl font-bold tracking-wide transition active:scale-[.985] disabled:opacity-50 sm:h-28 sm:text-3xl ${on ? 'bg-executor text-bg shadow-[0_10px_60px_-10px_rgba(61,220,132,.55)]' : 'border border-white/15 bg-white/[.04] text-ink hover:bg-white/[.07]'}`}>
        <span className="flex flex-col items-center leading-tight"><span className="flex items-center gap-3"><span className={`h-3 w-3 shrink-0 rounded-full ${on ? 'animate-pulse bg-bg' : 'bg-dim'}`} />{on ? 'ROBÔ LIGADO' : 'LIGAR O ROBÔ'}</span>
          <span className={`mt-1 text-xs font-medium tracking-normal ${on ? 'text-bg/70' : 'text-dim'}`}>{on ? 'toque para desligar' : alive ? 'toque para começar' : 'conector desligado'}</span></span>
      </button>

      <motion.p key={robotSentence(d)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-xl text-center text-lg leading-relaxed text-ink/90 sm:text-xl">“{robotSentence(d)}”</motion.p>

      {sa && <SaudeCard sa={sa} />}
      {d.onboarded === false && <Link href="/b3/comecar" className="block rounded-2xl border border-executor/40 bg-executor/10 p-4 text-center text-sm font-medium text-executor hover:bg-executor/15">Primeira vez aqui? Faça o passo a passo de 3 minutos →</Link>}

      <section aria-label="Gráfico ao vivo"><LiveChart clean demo={demo?.__live} /></section>

      <section aria-label="Operações">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-dim">Operações recentes</h2>
        {!cards.length ? <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-dim">Nenhuma operação ainda. O robô só entra quando vê um bom momento.</p> : <ul className="grid gap-3 sm:grid-cols-2">{cards.map((t) => <TradeCard key={t.id} t={t} />)}</ul>}
      </section>
      <p className="pb-4 text-center text-xs text-dim">Quer ver como o robô está de verdade? <Link className="text-executor underline underline-offset-4" href="/b3/saude">Saúde do robô</Link></p>
    </div>
  );
}
