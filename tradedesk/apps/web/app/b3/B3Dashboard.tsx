'use client';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { AGENTS, EmptyState, ErrorState, LineChart, Panel, Skeleton, Stat, btnDanger, dt, num, tone } from '@/components/ui';

type Any = Record<string, any>;
const LVL: Record<string, string> = { info: 'text-ink', warn: 'text-filter', error: 'text-risk', trade: 'text-executor', refuse: 'text-analyst' };
const AG: Record<string, string> = Object.fromEntries(AGENTS.map((a) => [a.id, a.color]));
const STATE_TXT: Record<string, string> = {
  trading: 'Operando', paused: 'Pausado', outside_hours: 'Fora do horário', closed_holiday: 'Mercado fechado (fim de semana/feriado)', halted: 'Parado até amanhã (limite do dia)',
  max_trades: 'Limite de operações do dia', panel_down: 'Sem contato com o painel', error: 'Erro', stopped: 'Conector parado', idle: 'Aguardando',
};

export default function B3Dashboard({ demo }: { demo?: Any }) {
  const [d, setD] = useState<Any | null>(demo ?? null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch('/api/b3/state').then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
    if (!r) return setErr('Sem conexão com o painel.');
    if (!r.ok) return setErr(r.j.error ?? 'erro');
    setErr(''); setD(r.j);
  }, []);
  useEffect(() => { load(); if (demo) return; const id = setInterval(load, 3000); return () => clearInterval(id); }, [load, demo]);

  async function post(url: string, body: Any) {
    if (demo) { setMsg('Prévia com dados de exemplo: botões desativados.'); return false; }
    setBusy(true); setMsg('');
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setMsg(j.error ?? 'erro');
    load();
    return r.ok;
  }
  async function panic() {
    if (!confirm('PARAR TUDO: zerar todas as posições agora e desligar o robô?')) return;
    if (await post('/api/b3/command', { command: 'panic' })) setMsg('PARAR TUDO enviado. O conector zera as posições em poucos segundos.');
  }

  if (err) return <ErrorState>{err}</ErrorState>;
  if (!d) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const s = d.settings ?? {}, st = d.status ?? {};
  const alive = d.connectorAgeSec != null && d.connectorAgeSec < 20;
  const on = !!s.enabled;
  const stateKey = !alive ? 'stopped' : st.state ?? 'idle';
  const lastLog: Record<string, number> = {};
  for (const l of d.logs) if (!(l.agent in lastLog)) lastLog[l.agent] = new Date(l.ts).getTime();

  return (
    <div className="space-y-4">
      {!alive && (
        <div role="alert" className="rounded-lg border border-risk/50 bg-risk/10 p-3 text-sm text-risk">
          <b>Conector desligado ou sem sinal</b>{d.connectorAgeSec != null ? ` (último sinal há ${d.connectorAgeSec}s)` : ' (nunca conectou)'}. Abra o MetaTrader 5 e o conector (Iniciar-Conector.bat). <b>Posições já abertas continuam com stop na corretora.</b>
        </div>
      )}
      {alive && st.last_error && <ErrorState>{st.last_error}</ErrorState>}
      {alive && st.source === 'internal' && (
        <div className="rounded-lg border border-scout/40 bg-scout/10 p-3 text-sm text-scout">
          <b>Você está vendo o SIMULADOR INTERNO.</b> Os preços são <b>artificiais</b> (gerados por computador) e o relógio é acelerado: um pregão inteiro passa em ~17 minutos.
          Serve para ver o robô operando — entradas com stop, alvo, zeragem às 17:30, limite do dia, PARAR TUDO. <b>Lucro ou prejuízo aqui não significa nada sobre o mercado real</b> e estes dias <b>não contam</b> para liberar o modo real.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Saldo da conta" count={{ value: Number(st.balance ?? 0) }} sub={alive ? `${st.account_server ?? ''} · conta ${st.account_login ?? ''} (${(st.account_mode ?? '').toUpperCase()})` : 'sem sinal'} />
        <Stat label="Resultado do dia (R$)" count={{ value: Number(st.day_pnl ?? 0), signed: true }} tone={tone(Number(st.day_pnl ?? 0))} sub={`limite -R$ ${num(Number(s.daily_loss_brl), 0)}`} />
        <Stat label="Operações hoje" count={{ value: Number(st.trades_today ?? 0), decimals: 0 }} sub={`máx. ${s.max_trades_per_day}`} />
        <Stat label="Equity" count={{ value: Number(st.equity ?? 0) }} />
        <Stat label="Situação" value={<span className="text-base">{STATE_TXT[stateKey] ?? stateKey}</span>} tone={stateKey === 'trading' ? 'pos' : stateKey === 'error' || stateKey === 'stopped' ? 'neg' : 'neutral'} sub={st.contracts ? Object.values(st.contracts).filter(Boolean).join(' · ') : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="controle" accent={on ? '#3ddc84' : '#ffa94d'}>
          <div className="space-y-3">
            <button disabled={busy} onClick={() => post('/api/b3/control', { action: on ? 'pause' : 'start' })}
              className={`w-full rounded-xl py-5 text-lg font-bold uppercase tracking-[0.15em] transition disabled:opacity-50 ${on ? 'border border-filter/60 bg-filter/10 text-filter hover:bg-filter hover:text-bg' : 'bg-executor text-bg shadow-glow hover:brightness-110'}`}>
              {on ? '❚❚ pausar robô' : '▶ ligar robô'}
            </button>
            <p className="text-center text-xs text-dim">Robô: <b className={on ? 'text-executor' : 'text-filter'}>{on ? 'LIGADO' : 'PAUSADO'}</b> · Horário: {s.open_from}–{s.open_until} · zera às {s.flat_at}</p>
            <button disabled={busy} onClick={panic} className="w-full rounded-xl border-2 border-risk bg-risk/15 py-4 text-base font-extrabold uppercase tracking-[0.15em] text-risk transition hover:bg-risk hover:text-bg disabled:opacity-50">■ PARAR TUDO</button>
            {msg && <p role="status" className="text-xs text-risk">{msg}</p>}
            <ModeSwitch d={d} post={post} busy={busy} />
          </div>
        </Panel>

        <Panel title="desk · 6 agents" accent="#a478ff" className="lg:col-span-2">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AGENTS.map((a) => {
              const recent = alive && Date.now() - (lastLog[a.id] ?? 0) < 30_000;
              const working = alive && on && stateKey === 'trading' && (recent || a.id === 'scout' || a.id === 'logger');
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                  <motion.span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color, boxShadow: working ? `0 0 10px ${a.color}` : 'none' }}
                    animate={working ? { scale: [1, 1.5, 1], opacity: [1, 0.55, 1] } : { scale: 1, opacity: 0.45 }} transition={{ duration: 1.4, repeat: working ? Infinity : 0 }} />
                  <div className="min-w-0 flex-1"><div className="font-semibold uppercase tracking-wider" style={{ color: a.color }}>{a.name}</div><div className="truncate text-dim">{a.short}</div></div>
                  <span className="font-mono text-[10px] uppercase text-dim">{working ? 'ativo' : alive ? 'espera' : 'off'}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="equity do dia" accent="#4da3ff"><LineChart data={d.equity} color="#4da3ff" height={200} /></Panel>

      <Panel title={`posições abertas (${(st.positions ?? []).length})`} accent="#3ddc84">
        {(st.positions ?? []).length === 0 ? <EmptyState>Nenhuma posição aberta.</EmptyState> : (
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-dim"><tr><th className="pb-2 font-medium">Contrato</th><th className="font-medium">Lado</th><th className="font-medium">Qtd</th><th className="font-medium">Entrada</th><th className="font-medium">Stop</th><th className="hidden font-medium sm:table-cell">Alvo</th><th className="text-right font-medium">Aberto R$</th></tr></thead>
            <tbody>{(st.positions as Any[]).map((p, i) => <tr key={i} className="border-t border-white/[0.06]"><td className="py-2 font-semibold text-executor">{p.symbol}</td><td className={p.side === 'buy' ? 'text-executor' : 'text-risk'}>{p.side === 'buy' ? 'COMPRA' : 'VENDA'}</td><td>{p.volume}</td><td>{num(p.price_open, 0)}</td><td className="text-risk">{num(p.sl, 0)}</td><td className="hidden text-scout sm:table-cell">{num(p.tp, 0)}</td><td className={`text-right ${p.profit >= 0 ? 'text-executor' : 'text-risk'}`}>{num(p.profit)}</td></tr>)}</tbody></table></div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="operações recentes" accent="#ff5c9a">
          {d.trades.length === 0 ? <EmptyState>Sem operações fechadas ainda.</EmptyState> : (
            <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="text-left text-dim"><tr><th className="pb-2 font-medium">Saída</th><th className="font-medium">Contrato</th><th className="hidden font-medium sm:table-cell">Motivo</th><th className="text-right font-medium">R$</th></tr></thead>
              <tbody>{d.trades.map((t: Any) => <tr key={t.id} className="border-t border-white/[0.06]"><td className="py-1.5">{t.closed_at ? dt(t.closed_at) : '—'}</td><td>{t.contract} {t.side === 'buy' ? '▲' : '▼'}</td><td className="hidden text-dim sm:table-cell">{t.close_reason}</td><td className={`text-right ${Number(t.pnl) >= 0 ? 'text-executor' : 'text-risk'}`}>{num(Number(t.pnl))}</td></tr>)}</tbody></table></div>
          )}
        </Panel>
        <Panel title="log em tempo real" accent="#2dd4bf" right={<span className="flex items-center gap-1.5 text-logger normal-case tracking-normal"><span className="blink inline-block h-1.5 w-1.5 rounded-full bg-logger" />ao vivo</span>}>
          <div className="max-h-80 space-y-1 overflow-auto rounded-lg bg-black/50 p-3 font-mono text-[11px] leading-relaxed" role="log" aria-live="off">
            {d.logs.length === 0 && <p className="text-dim">$ aguardando eventos…</p>}
            {d.logs.map((l: Any) => <div key={l.id} className={LVL[l.level] ?? 'text-ink'}><span className="text-dim">{dt(l.ts)}</span> <span className="uppercase" style={{ color: AG[l.agent] ?? '#8392a1' }}>[{l.agent}]</span> {l.message}</div>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ModeSwitch({ d, post, busy }: { d: Any; post: (u: string, b: Any) => Promise<boolean>; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [riskPhrase, setRiskPhrase] = useState('');
  const real = d.settings?.mode === 'real';
  const ck = d.checklist ?? {};
  const limited = !!ck.limitedPath;
  if (real) return (
    <div className="space-y-2">
      {d.settings?.real_limited && <p className="rounded-lg border border-filter/40 bg-filter/10 p-2 text-[11px] text-filter">Modo REAL <b>LIMITADO</b> (estratégia não validada): no máximo <b>1 contrato</b>, perda máxima <b>R$ 100/dia</b>, <b>3 operações/dia</b>, 1 posição por vez. Esses tetos valem acima das configurações.</p>}
      <button disabled={busy} className={`${btnDanger} w-full`} onClick={() => confirm('Voltar ao SIMULADOR? O robô desliga e as posições são zeradas.') && post('/api/b3/mode', { action: 'back_to_sim' })}>← voltar ao SIMULADOR</button>
    </div>
  );
  return (
    <div className="border-t border-white/[0.06] pt-3">
      <button onClick={() => setOpen(!open)} className="w-full text-left text-xs text-dim underline">Ativar modo REAL (dinheiro de verdade)…</button>
      {open && (
        <div className="mt-3 space-y-2 text-xs">
          <p className={ck.strategyApproved ? 'text-executor' : 'text-filter'}>{ck.strategyApproved ? '✔ Estratégia aprovada nos testes' : '⚠ Estratégia NÃO aprovada: só dá para liberar o modo REAL LIMITADO (liberação do dono)'}</p>
          {limited && <p className="rounded-lg border border-filter/40 bg-filter/10 p-2 text-[11px] text-filter">No modo limitado: <b>1 contrato</b>, perda máxima <b>R$ 100/dia</b>, <b>3 operações/dia</b>, 1 posição por vez, perfil conservador. A estratégia é de teste e <b>pode perder o valor todo que você depositar</b>.</p>}
          <p className={ck.simSessionsOk ? 'text-executor' : 'text-risk'}>{ck.simSessionsOk ? '✔' : '✖'} Pregões na conta DEMO do MT5: {ck.simSessions ?? 0} de {ck.needSessions ?? 20} <span className="text-dim">(o simulador interno não conta)</span></p>
          <label className="flex items-start gap-2 normal-case tracking-normal text-ink"><input type="checkbox" className="mt-0.5 !w-auto" checked={c1} onChange={(e) => setC1(e.target.checked)} />Entendo que vou operar com DINHEIRO REAL e posso perder tudo o que está na conta.</label>
          <label className="flex items-start gap-2 normal-case tracking-normal text-ink"><input type="checkbox" className="mt-0.5 !w-auto" checked={c2} onChange={(e) => setC2(e.target.checked)} />Conferi limites de perda, stop e horários nas configurações.</label>
          {limited && <label className="flex items-start gap-2 normal-case tracking-normal text-ink"><input type="checkbox" className="mt-0.5 !w-auto" checked={c3} onChange={(e) => setC3(e.target.checked)} />Sei que a estratégia NÃO foi validada e que não há garantia nenhuma de lucro.</label>}
          <div><label>Digite OPERAR REAL</label><input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" /></div>
          {limited && <div><label>Digite EU ASSUMO O RISCO</label><input value={riskPhrase} onChange={(e) => setRiskPhrase(e.target.value)} autoComplete="off" /></div>}
          <button disabled={busy} onClick={() => post('/api/b3/mode', { action: 'unlock_real', confirm1: c1, confirm2: c2, confirm3: c3, phrase, riskPhrase })} className={`${btnDanger} w-full`}>{limited ? 'liberar modo REAL LIMITADO' : 'liberar modo REAL'}</button>
        </div>
      )}
    </div>
  );
}
