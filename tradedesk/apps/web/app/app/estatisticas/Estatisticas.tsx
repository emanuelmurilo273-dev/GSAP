'use client';
import { useCallback, useEffect, useState } from 'react';
import StatsView from '@/components/StatsView';

type Any = Record<string, any>;

export default function Estatisticas() {
  const [d, setD] = useState<Any | null>(null); const [m, setM] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const r = await fetch('/api/stats' + (m ? `?mercado=${m}` : '')).then(async (x) => ({ ok: x.ok, j: await x.json() })).catch(() => null);
    if (!r) return setErr('Sem conexão.'); if (!r.ok) return setErr(r.j.error ?? 'erro'); setErr(''); setD(r.j);
  }, [m]);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);
  if (err) return <p role="alert" className="rounded-2xl border border-risk/40 bg-risk/10 p-4 text-sm text-risk">{err}</p>;
  if (!d) return <div className="skeleton h-64 w-full rounded-3xl" />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {d.hasB3 && ([['', 'Tudo'], ['b3', 'B3'], ['cripto', 'Cripto']] as const).map(([k, l]) => <button key={k} onClick={() => setM(k)} className={`rounded-full border px-4 py-1.5 text-sm ${m === k ? 'border-executor bg-executor/15 text-executor' : 'border-white/10 text-dim'}`}>{l}</button>)}
        <span className="ml-auto flex gap-2 text-sm">
          <a href="/api/stats/export" className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10">Baixar extrato (CSV)</a>
          <a href="/app/estatisticas/extrato" target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10">Extrato em PDF</a>
        </span>
      </div>
      <StatsView stats={d.stats} excluded={d.excluded} since={d.stats?.firstTradeAt} />
    </div>
  );
}
