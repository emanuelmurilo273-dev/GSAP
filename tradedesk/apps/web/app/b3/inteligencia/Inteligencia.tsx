'use client';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, LineChart, Panel, Stat, btn, btnDanger, dt, num } from '@/components/ui';

type Any = Record<string, any>;
const REGIME: Record<string, string> = { trend: 'Tendência', range: 'Lateral', volatile: 'Volátil demais', unknown: 'Sem dados' };

export default function Inteligencia({ demo }: { demo?: Any }) {
  const [d, setD] = useState<Any | null>(demo ?? null);
  const [ev, setEv] = useState<Any[]>(demo?.events ?? []);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ starts_at: '', title: '', impact: 'alto' });

  const load = useCallback(async () => {
    if (demo) return;
    const [a, b] = await Promise.all([fetch('/api/b3/intel').then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null), fetch('/api/b3/events').then((x) => x.json()).catch(() => null)]);
    if (!a) return setErr('Sem conexão com o painel.');
    if (!a.ok) return setErr(a.j.error ?? 'erro');
    setErr(''); setD(a.j); setEv(b?.events ?? []);
  }, [demo]);
  useEffect(() => { load(); if (demo) return; const id = setInterval(load, 5000); return () => clearInterval(id); }, [load, demo]);

  async function call(url: string, method: string, body?: Any) {
    if (demo) { setMsg('Prévia com dados de exemplo: botões desativados.'); return; }
    setBusy(true); setMsg('');
    const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    setBusy(false); if (!r.ok) setMsg(j.error ?? 'erro'); else setMsg('Feito.');
    load(); return j;
  }

  if (err) return <ErrorState>{err}</ErrorState>;
  if (!d) return <EmptyState>Carregando…</EmptyState>;
  const dec: Any[] = d.decisions ?? [];
  const last = dec[0];
  const lastSignal = dec.find((x) => x.prob != null);
  const ch: Any | undefined = d.challengers?.[0];

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-dim">As camadas de inteligência estão <b>desligadas por padrão</b>. Elas só ligam depois de provar, com dados reais da B3 e fora da amostra, que melhoram o robô — e só você aprova a troca, com um clique. O Analyst (IA) apenas explica; <b>nunca decide uma entrada</b>.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Regime agora"><Stat label="Mercado" value={REGIME[last?.regime ?? 'unknown'] ?? last?.regime ?? 'Sem dados'} /></Panel>
        <Panel title="Última probabilidade"><Stat label="Chance de ganho (modelo)" value={lastSignal ? `${(Number(lastSignal.prob) * 100).toFixed(0)}%` : '—'} sub={lastSignal ? `${lastSignal.symbol} · ${dt(lastSignal.ts)}` : 'modelo desligado ou sem sinais'} /></Panel>
        <Panel title="Última decisão"><Stat label={last?.decision === 'entrou' ? 'Entrou' : 'Não entrou'} value={last?.reason ?? '—'} sub={last ? dt(last.ts) : ''} /></Panel>
      </div>

      <Panel title="Por que entrou / por que não entrou">
        {!dec.length ? <EmptyState>Nenhuma decisão registrada ainda.</EmptyState> : (
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">{dec.map((x) => (
            <li key={x.id ?? x.ts + x.symbol} className="flex flex-wrap gap-x-2"><span className="text-xs tabular-nums text-dim">{dt(x.ts)}</span><b className={x.decision === 'entrou' ? 'text-executor' : 'text-filter'}>{x.symbol}</b><span>{x.decision === 'entrou' ? 'Entrei: ' : 'Não entrei: '}{x.reason}</span></li>))}</ul>)}
      </Panel>

      <Panel title="Campeão × desafiante" right={<span className="text-[10px] text-dim">só preços reais do MT5 contam · mín. {d.rules?.minSessions} pregões e {d.rules?.minTrades} operações</span>}>
        <p className="mb-2 text-sm">Campeão atual: <b>{d.champion?.name ?? '—'}</b></p>
        {!ch ? <EmptyState>Nenhum desafiante em teste. O reaprendizado semanal cria um quando houver prova estatística; ele roda em paralelo, no simulador, sem dinheiro.</EmptyState> : (
          <div className="space-y-3">
            <p className="text-sm">Desafiante: <b>{ch.version.name}</b></p>
            <div className="grid gap-3 md:grid-cols-2">
              <div><p className="mb-1 text-xs text-dim">Resultado acumulado (R$) — verde: campeão · azul: desafiante</p>
                <LineChart data={ch.curves.champion} height={140} color="#3ddc84" /><LineChart data={ch.curves.challenger} height={140} color="#58a6ff" /></div>
              <table className="w-full text-xs tabular-nums"><thead><tr className="text-dim"><th className="text-left">Métrica</th><th>Campeão</th><th>Desafiante</th></tr></thead><tbody>
                {([['Pregões', 'sessions', 0], ['Operações', 'trades', 0], ['Fator de lucro', 'profitFactor', 2], ['Perda máx. (R$)', 'maxDrawdown', 0], ['Sharpe', 'sharpe', 2], ['Resultado (R$)', 'pnl', 0]] as const).map(([l, k, dg]) => (
                  <tr key={k}><td>{l}</td><td className="text-center">{num(ch.comparison.champion?.[k], dg)}</td><td className="text-center">{num(ch.comparison.challenger?.[k], dg)}</td></tr>))}</tbody></table>
            </div>
            {ch.comparison.canPromote ? <p className="text-sm text-executor">✔ Passou em todos os critérios.</p> : <ul className="list-disc pl-5 text-xs text-filter">{ch.comparison.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>}
            <div className="flex gap-2">
              <button className={btn} disabled={busy || !ch.comparison.canPromote} onClick={() => confirm(`Promover "${ch.version.name}" a campeão? Ele passa a valer no simulador/real conforme o modo atual.`) && call('/api/b3/versions', 'POST', { id: ch.version.id, action: 'promote' })}>Promover a campeão (1 clique)</button>
              <button className={btnDanger} disabled={busy} onClick={() => call('/api/b3/versions', 'POST', { id: ch.version.id, action: 'retire' })}>Descartar desafiante</button>
            </div>
          </div>)}
      </Panel>

      <Panel title="Calendário de notícias (sem entradas 15 min antes/depois)">
        <p className="mb-2 text-xs text-dim">Cadastre Copom, payroll, CPI, falas do Fed… As datas mudam todo ano, por isso quem confere é você. A abertura de Nova York (09:30 ET) já é automática.</p>
        <form className="mb-3 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); const j = await call('/api/b3/events', 'POST', { ...f, starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : '' }); if (j?.ok) setF({ ...f, title: '' }); }}>
          <input type="datetime-local" required value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} className="w-auto rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm" aria-label="Data e hora (horário local)" />
          <input required placeholder="Ex.: Copom — decisão da Selic" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="min-w-[14rem] w-auto flex-1 rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm" aria-label="Título" />
          <select value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} className="w-auto rounded-md border border-white/10 bg-bg px-2 py-1 text-sm" aria-label="Impacto"><option value="alto">Alto</option><option value="medio">Médio</option></select>
          <button className={btn} disabled={busy}>Adicionar</button>
        </form>
        {!ev.length ? <EmptyState>Nenhum evento cadastrado.</EmptyState> : <ul className="space-y-1 text-sm">{ev.map((e) => <li key={e.id} className="flex items-center gap-2"><span className="text-xs tabular-nums text-dim">{dt(e.starts_at)}</span><span className="flex-1">{e.title}</span><span className="text-[10px] uppercase text-dim">{e.impact}</span><button className="text-xs text-risk" onClick={() => call('/api/b3/events?id=' + e.id, 'DELETE')}>remover</button></li>)}</ul>}
      </Panel>

      <Panel title="Analyst (IA) — só explica, não decide" right={<button className={btn} disabled={busy} onClick={() => call('/api/b3/analyst', 'POST')}>Gerar resumo do dia</button>}>
        {d.analyst?.text ? <><p className="whitespace-pre-line text-sm">{d.analyst.text}</p><p className="mt-2 text-[10px] text-dim">{dt(d.analyst.at)} · {d.analyst.model}</p></> : <EmptyState>Sem resumo ainda. Precisa da chave LLM_API_KEY no .env.</EmptyState>}
      </Panel>
      {msg && <p role="status" className="text-sm text-filter">{msg}</p>}
    </div>
  );
}
