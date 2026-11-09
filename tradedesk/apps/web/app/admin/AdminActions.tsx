'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn, btnDanger } from '@/components/ui';

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}

export function AccessButton({ userId, blocked }: { userId: string; blocked: boolean }) {
  const r = useRouter();
  return <button className={blocked ? btn : btnDanger} onClick={async () => { await post('/api/admin/access', { userId, blocked: !blocked }); r.refresh(); }}>{blocked ? 'liberar' : 'bloquear'}</button>;
}

export default function AdminActions({ price, official }: { price?: number; official?: boolean }) {
  const r = useRouter();
  const [v, setV] = useState(price ?? 0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (official) {
    return <div><button className={btn} disabled={busy} onClick={async () => { setBusy(true); setMsg('rodando (até 1 min)…'); const { ok, j } = await post('/api/admin/official'); setBusy(false); setMsg(ok ? `ok: ${j.out?.join(' · ')}` : j.error); r.refresh(); }}>rodar backtest oficial agora</button> <span className="text-xs text-dim">{msg}</span></div>;
  }
  return (
    <div className="flex flex-wrap items-end gap-3"><div><label>Preço mensal (R$) — vale para NOVAS assinaturas</label><input type="number" value={v} onChange={(e) => setV(+e.target.value)} /></div>
      <button className={btn} onClick={async () => { const { ok, j } = await post('/api/admin/price', { amount: v }); setMsg(ok ? 'salvo' : j.error); r.refresh(); }}>salvar</button><span className="text-xs text-dim">{msg}</span></div>
  );
}
