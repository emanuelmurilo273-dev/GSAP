'use client';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { AGENTS, EmptyState, ErrorState, LineChart, Panel, Skeleton, Stat, btnDanger, dt, num, pct, tone } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

type Any = Record<string, any>;
const LVL: Record<string, string> = { info: 'text-ink', warn: 'text-filter', error: 'text-risk', trade: 'text-executor', refuse: 'text-analyst' };
const AG: Record<string, string> = Object.fromEntries(AGENTS.map((a) => [a.id, a.color]));

export default function Dashboard({ userId, settings, account, initial, equity, pnl, realBlocked = false, testnet = false, demo }: {
  userId: string; settings: Any | null; account: Any | null;
  initial: { open: Any[]; closed: Any[]; logs: Any[]; agents: Any[] }; equity: { t: number; v: number }[]; pnl: { day: number; week: number; month: number };
  realBlocked?: boolean; testnet?: boolean; demo?: { balance: Any };
}) {
  const [on, setOn] = useState(!!settings?.bot_enabled);
  const [open, setOpen] = useState(initial.open);
  const [closed, setClosed] = useState(initial.closed);
  const [logs, setLogs] = useState(initial.logs);
  const [agents, setAgents] = useState<Record<string, Any>>(Object.fromEntries(initial.agents.map((a) => [a.agent, a])));
  const [bal, setBal] = useState<Any | null>(demo?.balance ?? null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const quote = settings?.quote ?? 'USDT';

  const refreshBalance = useCallback(async () => {
    if (demo) return;
    const r = await fetch('/api/balance').then((x) => x.json()).catch(() => ({ error: 'sem conexão' }));
    setBal(r);
  }, [demo]);
  useEffect(() => { refreshBalance(); if (demo) return; const id = setInterval(refreshBalance, 30_000); return () => clearInterval(id); }, [refreshBalance, demo]);

  const refreshTrades = useCallback(async () => {
    const sb = supabaseBrowser();
    const [o, c] = await Promise.all([
      sb.from('trades').select('*').eq('user_id', userId).eq('status', 'open').order('entry_at', { ascending: false }),
      sb.from('trades').select('*').eq('user_id', userId).eq('status', 'closed').order('exit_at', { ascending: false }).limit(60),
    ]);
    if (o.data) setOpen(o.data); if (c.data) setClosed(c.data);
  }, [userId]);

  useEffect(() => {
    if (demo) return;
    const sb = supabaseBrowser();
    const ch = sb.channel(`desk-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: `user_id=eq.${userId}` }, (p) => setLogs((l) => [p.new as Any, ...l].slice(0, 120)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status', filter: `user_id=eq.${userId}` }, (p) => setAgents((a) => ({ ...a, [(p.new as Any).agent]: p.new as Any })))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${userId}` }, () => { refreshTrades(); refreshBalance(); })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [userId, refreshTrades, refreshBalance, demo]);

  async function toggle() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/bot/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: !on }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error);
    setOn(j.on);
  }
  async function closeAll() {
    if (!confirm('Pausar o robô e VENDER A MERCADO todas as posições abertas agora?')) return;
    setBusy(true); setMsg('');
    const r = await fetch('/api/bot/close-all', { method: 'POST' });
    const j = await r.json();
    setBusy(false); setOn(false);
    setMsg(r.ok ? `${j.closed ?? 0} posição(ões) fechada(s)${j.failed ? ` · ${j.failed} falha(s): ${j.errors?.join('; ')}` : ''}. ${j.note ?? ''}` : j.error);
    refreshTrades(); refreshBalance();
  }

  return (
    <div className="space-y-4">
      {testnet && <div className="rounded-lg border border-scout/40 bg-scout/10 px-3 py-2 text-xs text-scout">TESTNET — ordens com dinheiro de mentira (Binance Spot Testnet).</div>}
      {realBlocked && <div className="rounded-lg border border-filter/40 bg-filter/10 px-3 py-2 text-xs text-filter">Modo real bloqueado: nenhuma estratégia foi aprovada na pesquisa de validação. O robô só liga em testnet.</div>}
      {!account && <div className="rounded-lg border border-filter/40 bg-filter/10 p-3 text-sm text-filter">Corretora ainda não conectada. <a href="/app/onboarding">Ir para o início →</a></div>}
      {account?.last_error && <ErrorState>Último erro de API: {account.last_error}</ErrorState>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {bal == null ? (
          <div className="glass p-3.5"><div className="text-[11px] uppercase tracking-[0.12em] text-dim">Saldo real ({quote})</div><Skeleton className="mt-2 h-6 w-28" /><Skeleton className="mt-2 h-3 w-20" /></div>
        ) : bal.error ? (
          <Stat label={`Saldo real (${quote})`} value="indisponível" tone="neg" sub={bal.error} />
        ) : (
          <Stat label={`Saldo real (${quote})`} count={{ value: bal.equity ?? 0 }} sub={`${bal.exchange ?? ''} · livre ${num(bal.free)}`} />
        )}
        <Stat label="P&L hoje (realizado)" count={{ value: pnl.day, signed: true }} tone={tone(pnl.day)} />
        <Stat label="P&L 7 dias" count={{ value: pnl.week, signed: true }} tone={tone(pnl.week)} />
        <Stat label="P&L 30 dias" count={{ value: pnl.month, signed: true }} tone={tone(pnl.month)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="controle" accent={on ? '#3ddc84' : '#ffa94d'}>
          <div className="space-y-3">
            <button onClick={toggle} disabled={busy} className={`w-full rounded-xl py-6 text-lg font-bold uppercase tracking-[0.15em] transition disabled:opacity-50 ${on ? 'border border-filter/60 bg-filter/10 text-filter hover:bg-filter hover:text-bg' : 'bg-executor text-bg shadow-glow hover:brightness-110'}`}>
              {on ? '❚❚ pausar robô' : '▶ ligar robô'}
            </button>
            <p className="text-center text-xs text-dim">Status: <b className={on ? 'text-executor' : 'text-filter'}>{on ? 'OPERANDO' : 'PAUSADO'}</b></p>
            <button onClick={closeAll} disabled={busy} className={`${btnDanger} w-full`}>Fechar todas as posições</button>
            {msg && <p role="status" className="text-xs text-risk">{msg}</p>}
          </div>
        </Panel>

        <Panel title="desk · 6 agents" accent="#a478ff" className="lg:col-span-2">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AGENTS.map((a) => {
              const st = agents[a.id];
              const state = !on && a.id !== 'logger' ? 'idle' : st?.state ?? (a.id === 'logger' && on ? 'working' : 'idle');
              const dot = state === 'error' ? '#ff5c9a' : state === 'halted' ? '#ffa94d' : a.color;
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                  <motion.span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot, boxShadow: state === 'working' ? `0 0 10px ${dot}` : 'none' }}
                    animate={state === 'working' ? { scale: [1, 1.5, 1], opacity: [1, 0.55, 1] } : { scale: 1, opacity: state === 'idle' ? 0.5 : 1 }} transition={{ duration: 1.4, repeat: state === 'working' ? Infinity : 0 }} />
                  <div className="min-w-0 flex-1"><div className="font-semibold uppercase tracking-wider" style={{ color: a.color }}>{a.name}</div>
                    <div className="truncate text-dim">{st?.detail || a.short}</div></div>
                  <span className="font-mono text-[10px] uppercase text-dim">{on ? state : 'off'}</span>
                </li>);
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="equity · saldo real do robô" accent="#4da3ff"><LineChart data={equity} color="#4da3ff" height={230} /></Panel>

      <Panel title={`posições abertas (${open.length})`} accent="#3ddc84">
        {open.length === 0 ? <EmptyState>Nenhuma posição aberta. A mesa só entra quando a nota do Analyst passa do limite.</EmptyState> : (
          <div className="overflow-x-auto"><table className="w-full text-xs sm:min-w-[560px]"><thead className="text-left text-dim"><tr><th className="pb-2 font-medium">Par</th><th className="font-medium">Entrada</th><th className="hidden font-medium sm:table-cell">Qtd</th><th className="font-medium">Stop</th><th className="font-medium">Alvo</th><th className="hidden font-medium sm:table-cell">Pico</th><th className="hidden font-medium sm:table-cell">Nota</th></tr></thead>
            <tbody>{open.map((t) => (<tr key={t.id} className="border-t border-white/[0.06]"><td className="py-2 font-semibold text-executor">{t.symbol}</td><td>{num(+t.entry_price, 4)}</td><td className="hidden sm:table-cell">{num(+t.qty, 6)}</td><td className="text-risk">{num(+t.stop_price, 2)}</td><td className="text-scout">{num(+t.target_price, 2)}</td><td className="hidden sm:table-cell">{num(+t.peak_price, 4)}{t.trailing_active ? ' ⤴' : ''}</td><td className="hidden sm:table-cell">{t.score ?? '—'}</td></tr>))}</tbody></table></div>)}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="histórico de trades" accent="#ff5c9a">
          {closed.length === 0 ? <EmptyState>Sem trades fechados ainda.</EmptyState> : (
            <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="text-left text-dim"><tr><th className="pb-2 font-medium">Saída</th><th className="font-medium">Par</th><th className="hidden font-medium sm:table-cell">Motivo</th><th className="text-right font-medium">P&L</th></tr></thead>
              <tbody>{closed.map((t) => (<tr key={t.id} className="border-t border-white/[0.06]"><td className="py-1.5">{dt(t.exit_at)}</td><td>{t.symbol}</td><td className="hidden text-dim sm:table-cell">{t.exit_reason}</td><td className={`text-right ${+t.pnl >= 0 ? 'text-executor' : 'text-risk'}`}>{num(+t.pnl)} <span className="text-dim">({pct(+t.pnl_pct, 1)})</span></td></tr>))}</tbody></table></div>)}
        </Panel>
        <Panel title="log em tempo real" accent="#2dd4bf" right={<span className="flex items-center gap-1.5 text-logger normal-case tracking-normal"><span className="blink inline-block h-1.5 w-1.5 rounded-full bg-logger" />live</span>}>
          <div className="max-h-80 space-y-1 overflow-auto rounded-lg bg-black/50 p-3 font-mono text-[11px] leading-relaxed" role="log" aria-live="off">
            {logs.length === 0 && <p className="text-dim">$ aguardando eventos…</p>}
            {logs.map((l) => (<div key={l.id} className={LVL[l.level] ?? 'text-ink'}><span className="text-dim">{dt(l.ts)}</span> <span className="uppercase" style={{ color: AG[l.agent] ?? '#8392a1' }}>[{l.agent}]</span> {l.message}</div>))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
