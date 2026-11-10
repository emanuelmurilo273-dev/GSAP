'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type Any = Record<string, any>;
const brl = (v: number, sign = false) => `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nome = (t: Any) => (t.market === 'b3' ? (String(t.symbol).startsWith('WIN') ? 'mini índice' : 'mini dólar') : String(t.symbol).split('/')[0]);

function Card({ t }: { t: Any }) {
  const [open, setOpen] = useState(false); const buy = t.side === 'buy';
  const why = t.why || `${buy ? 'Comprei' : 'Vendi'} quando os indicadores apontaram ${buy ? 'alta' : 'queda'}. Saída: ${t.reason ?? 'em andamento'}.`;
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4">
      <div className="flex items-center gap-3">
        <span aria-label={buy ? 'compra' : 'venda'} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${buy ? 'bg-executor/15 text-executor' : 'bg-risk/15 text-risk'}`}>{buy ? '↑' : '↓'}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{buy ? 'Compra' : 'Venda'} · {nome(t)}</p>
          <p className="text-xs text-dim">{new Date(t.openedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{t.status === 'open' ? ' · em andamento' : ''} · {t.market === 'b3' ? 'B3' : 'Cripto'}</p></div>
        <p className={`font-mono text-lg font-bold tabular-nums ${t.pnl == null ? 'text-dim' : t.pnl >= 0 ? 'text-executor' : 'text-risk'}`}>{t.pnl == null ? '…' : brl(t.pnl, true)}</p>
      </div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-3 text-xs font-medium text-dim underline-offset-4 hover:text-ink hover:underline">{open ? 'fechar' : 'por quê?'}</button>
      <AnimatePresence>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-2 text-sm leading-relaxed text-ink/90"><p>{why}</p><p className="mt-2 font-mono text-[11px] text-dim">ordem: {t.orderId}</p></motion.div>}</AnimatePresence>
    </motion.li>
  );
}

export default function Historico({ demo }: { demo?: Any[] }) {
  const [rows, setRows] = useState<Any[] | null>(demo ?? null); const [err, setErr] = useState('');
  useEffect(() => { if (demo) return; fetch('/api/trades').then(async (x) => ({ ok: x.ok, j: await x.json() })).then((r) => r.ok ? setRows(r.j.trades) : setErr(r.j.error ?? 'erro')).catch(() => setErr('Sem conexão.')); }, [demo]);
  if (err) return <p role="alert" className="rounded-2xl border border-risk/40 bg-risk/10 p-4 text-sm text-risk">{err}</p>;
  if (!rows) return <div className="skeleton h-48 w-full rounded-3xl" />;
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-dim">Nenhuma operação real ainda. Quando o robô executar uma ordem na corretora, ela aparece aqui.</p>;
  return <ul className="grid gap-3 sm:grid-cols-2">{rows.slice(0, 120).map((t) => <Card key={t.id} t={t} />)}</ul>;
}
