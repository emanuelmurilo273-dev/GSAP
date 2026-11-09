'use client';
import { useCallback, useEffect, useState } from 'react';
import { Skeleton, btn, btnDanger, num, pct } from '@/components/ui';

type Any = Record<string, any>;
const pf = (x: number | null) => (x == null ? '—' : x.toFixed(2));

export default function ValidationPanel() {
  const [d, setD] = useState<Any | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr(''); setD(null);
    const r = await fetch('/api/admin/validation');
    const j = await r.json();
    if (!r.ok) return setErr(j.error ?? 'erro');
    setD(j);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function act(action: 'start' | 'reset') {
    if (action === 'reset' && !confirm('Zerar a janela de validação?')) return;
    await fetch('/api/admin/validation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }
  if (err) return <p role="alert" className="text-sm text-risk">{err}</p>;
  if (!d) return <div className="space-y-2"><Skeleton className="h-4 w-64" /><Skeleton className="h-24 w-full" /></div>;
  if (!d.started) return (
    <div className="space-y-3 text-sm">
      <p className="text-dim">Conecte <b className="text-ink">sua</b> conta Binance em <a href="/app/settings">Config</a> (com valor pequeno), rode o backtest, ligue o robô e clique em iniciar. Por 30 dias comparamos o resultado real com o backtest do mesmo período e dos mesmos parâmetros.</p>
      <button className={btn} onClick={() => act('start')}>iniciar janela de 30 dias</button>
    </div>
  );
  const r = d.real, b = d.backtest;
  const left = Math.max(0, 30 - d.days);
  const row = (label: string, real: string, bt: string) => <tr className="border-t border-white/[0.06]"><td className="py-2 text-dim">{label}</td><td className="font-mono">{real}</td><td className="font-mono">{bt}</td></tr>;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-dim">Início: {new Date(d.start).toLocaleDateString('pt-BR')} · dia <b className="text-ink">{Math.floor(d.days)}</b> de 30 {left > 0 ? `(faltam ${Math.ceil(left)})` : <b className="text-executor">· janela concluída</b>}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-xs"><thead className="text-left text-dim"><tr><th className="pb-2 font-medium">Métrica</th><th className="font-medium">REAL (sua conta)</th><th className="font-medium">BACKTEST (mesmo período)</th></tr></thead><tbody>
        {row('Trades fechados', String(r.trades), b ? String(b.trades) : 'indisponível')}
        {row('Taxa de acerto', r.winRate == null ? '—' : `${(r.winRate * 100).toFixed(0)}%`, b?.winRate == null ? '—' : `${(b.winRate * 100).toFixed(0)}%`)}
        {row('Fator de lucro', pf(r.profitFactor), b ? pf(b.profitFactor) : '—')}
        {row('Média por trade', pct(r.avgTradePct), b ? pct(b.avgTradePct) : '—')}
        {row('Resultado', r.equityChangePct == null ? `${num(r.pnl)} (P&L)` : `${pct(r.equityChangePct)} (saldo)`, b ? `${pct(b.pnlPct)} (média dos pares)` : '—')}
        {row('Posições abertas agora', String(r.openNow), '—')}
      </tbody></table></div>
      <p className="text-[11px] leading-snug text-dim">Como ler: se o REAL ficar bem pior que o BACKTEST (acerto, fator de lucro, média por trade), a simulação está otimista (slippage, execução, taxas reais). Compare métricas por trade; o "resultado" usa bases diferentes (saldo da conta × % por trade). Poucos trades = pouca confiança estatística. {b ? b.note : 'Backtest indisponível agora (dados da corretora).'}</p>
      <div className="flex gap-2"><button className={btn} onClick={load}>atualizar</button><button className={btnDanger} onClick={() => act('reset')}>zerar janela</button></div>
    </div>
  );
}
