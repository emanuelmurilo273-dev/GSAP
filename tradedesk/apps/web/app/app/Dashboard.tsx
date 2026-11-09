'use client';
import { useCallback, useEffect, useState } from 'react';
import { AGENTS, LineChart, Panel, Stat, btn, btnDanger, dt, num, pct, tone } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

type Any = Record<string, any>;
const LVL: Record<string, string> = { info: 'text-ink', warn: 'text-neon-orange', error: 'text-neon-pink', trade: 'text-neon-green', refuse: 'text-neon-purple' };
const STATE: Record<string, string> = { working: 'text-neon-green', idle: 'text-dim', halted: 'text-neon-orange', error: 'text-neon-pink' };

export default function Dashboard({ userId, settings, account, initial, equity, pnl }: {
  userId: string; settings: Any | null; account: Any | null;
  initial: { open: Any[]; closed: Any[]; logs: Any[]; agents: Any[] }; equity: { t: number; v: number }[]; pnl: { day: number; week: number; month: number };
}) {
  const [on, setOn] = useState(!!settings?.bot_enabled);
  const [open, setOpen] = useState(initial.open);
  const [closed, setClosed] = useState(initial.closed);
  const [logs, setLogs] = useState(initial.logs);
  const [agents, setAgents] = useState<Record<string, Any>>(Object.fromEntries(initial.agents.map((a) => [a.agent, a])));
  const [bal, setBal] = useState<Any | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const quote = settings?.quote ?? 'USDT';

  const refreshBalance = useCallback(async () => {
    const r = await fetch('/api/balance').then((x) => x.json()).catch(() => null);
    if (r) setBal(r);
  }, []);
  useEffect(() => { refreshBalance(); const id = setInterval(refreshBalance, 30_000); return () => clearInterval(id); }, [refreshBalance]);

  const refreshTrades = useCallback(async () => {
    const sb = supabaseBrowser();
    const [o, c] = await Promise.all([
      sb.from('trades').select('*').eq('user_id', userId).eq('status', 'open').order('entry_at', { ascending: false }),
      sb.from('trades').select('*').eq('user_id', userId).eq('status', 'closed').order('exit_at', { ascending: false }).limit(60),
    ]);
    if (o.data) setOpen(o.data); if (c.data) setClosed(c.data);
  }, [userId]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel(`desk-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: `user_id=eq.${userId}` }, (p) => setLogs((l) => [p.new as Any, ...l].slice(0, 120)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status', filter: `user_id=eq.${userId}` }, (p) => setAgents((a) => ({ ...a, [(p.new as Any).agent]: p.new as Any })))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${userId}` }, () => { refreshTrades(); refreshBalance(); })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [userId, refreshTrades, refreshBalance]);

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
      {!account && <div className="border border-neon-orange p-3 text-sm text-neon-orange">Corretora ainda não conectada. <a href="/app/onboarding">Ir para o início →</a></div>}
      {account?.last_error && <div className="border border-neon-pink p-3 text-xs text-neon-pink">Último erro de API: {account.last_error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Saldo real (${quote})`} value={bal?.equity != null ? num(bal.equity) : bal?.error ? 'erro' : '…'} sub={bal?.connected ? `${bal.exchange} · livre ${num(bal.free)}` : 'consultando corretora'} />
        <Stat label="P&L hoje (realizado)" value={`${num(pnl.day)}`} tone={tone(pnl.day)} />
        <Stat label="P&L 7 dias" value={`${num(pnl.week)}`} tone={tone(pnl.week)} />
        <Stat label="P&L 30 dias" value={`${num(pnl.month)}`} tone={tone(pnl.month)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="controle" accent={on ? '#39ff88' : '#ffa21f'} className="lg:col-span-1">
          <div className="space-y-3">
            <button onClick={toggle} disabled={busy} className={`w-full py-6 text-xl font-bold uppercase tracking-widest transition ${on ? 'border border-neon-orange text-neon-orange hover:bg-neon-orange hover:text-bg' : 'border-2 border-neon-green bg-neon-green text-bg hover:brightness-110'}`}>
              {on ? '❚❚ pausar robô' : '▶ ligar robô'}
            </button>
            <p className="text-center text-xs">Status: <b className={on ? 'text-neon-green' : 'text-neon-orange'}>{on ? 'OPERANDO' : 'PAUSADO'}</b></p>
            <button onClick={closeAll} disabled={busy} className={`${btnDanger} w-full`}>Fechar todas as posições</button>
            {msg && <p className="text-xs text-neon-pink">{msg}</p>}
          </div>
        </Panel>

        <Panel title="desk · 6 agents" accent="#a66bff" className="lg:col-span-2">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AGENTS.map((a) => {
              const st = agents[a.id];
              const state = !on && a.id !== 'logger' ? 'idle' : st?.state ?? (a.id === 'logger' && on ? 'working' : 'idle');
              return (
                <li key={a.id} className="flex items-center gap-3 border border-line p-2 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${state === 'working' ? 'blink' : ''}`} style={{ background: state === 'error' ? '#ff4fa3' : state === 'halted' ? '#ffa21f' : a.color }} />
                  <div className="min-w-0 flex-1"><div className="font-bold uppercase" style={{ color: a.color }}>{a.name}</div>
                    <div className="truncate text-dim">{st?.detail || a.desc}</div></div>
                  <span className={`uppercase ${STATE[state] ?? 'text-dim'}`}>{on ? state : 'off'}</span>
                </li>);
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="equity (saldo real do robô)" accent="#3aa8ff"><LineChart data={equity} color="#3aa8ff" /></Panel>

      <Panel title={`posições abertas (${open.length})`} accent="#39ff88">
        {open.length === 0 ? <p className="text-sm text-dim">Nenhuma posição aberta.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-xs"><thead className="text-left text-dim"><tr><th>Par</th><th>Entrada</th><th>Qtd</th><th>Stop</th><th>Alvo</th><th>Pico</th><th>Nota</th></tr></thead>
            <tbody>{open.map((t) => (<tr key={t.id} className="border-t border-line"><td className="py-1 text-neon-green">{t.symbol}</td><td>{num(+t.entry_price, 4)}</td><td>{num(+t.qty, 6)}</td><td className="text-neon-pink">{num(+t.stop_price, 4)}</td><td className="text-neon-blue">{num(+t.target_price, 4)}</td><td>{num(+t.peak_price, 4)}{t.trailing_active ? ' ⤴' : ''}</td><td>{t.score ?? '—'}</td></tr>))}</tbody></table></div>)}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="histórico de trades" accent="#ff4fa3">
          {closed.length === 0 ? <p className="text-sm text-dim">Sem trades fechados.</p> : (
            <div className="max-h-80 overflow-auto"><table className="w-full min-w-[420px] text-xs"><thead className="text-left text-dim"><tr><th>Saída</th><th>Par</th><th>Motivo</th><th className="text-right">P&L</th></tr></thead>
              <tbody>{closed.map((t) => (<tr key={t.id} className="border-t border-line"><td className="py-1">{dt(t.exit_at)}</td><td>{t.symbol}</td><td className="text-dim">{t.exit_reason}</td><td className={`text-right ${+t.pnl >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}>{num(+t.pnl)} <span className="text-dim">({pct(+t.pnl_pct, 1)})</span></td></tr>))}</tbody></table></div>)}
        </Panel>
        <Panel title="log em tempo real" accent="#ffa21f" right={<span className="blink text-neon-green">● live</span>}>
          <div className="max-h-80 space-y-1 overflow-auto text-[11px]">
            {logs.length === 0 && <p className="text-dim">Aguardando eventos…</p>}
            {logs.map((l) => (<div key={l.id} className={LVL[l.level] ?? 'text-ink'}><span className="text-dim">{dt(l.ts)}</span> <span className="uppercase text-dim">[{l.agent}]</span> {l.message}</div>))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
