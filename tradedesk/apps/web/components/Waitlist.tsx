'use client';
import { useState } from 'react';

export default function Waitlist() {
  const [email, setEmail] = useState(''); const [ok, setOk] = useState(false); const [err, setErr] = useState(''); const [c, setC] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, consent: c }) });
    if (r.ok) setOk(true); else setErr((await r.json()).error ?? 'erro');
  }
  if (ok) return <p className="rounded-2xl bg-executor/10 p-4 text-executor">Pronto! Avisamos por e-mail quando a venda abrir.</p>;
  return (
    <form onSubmit={go} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="E-mail" className="!w-auto flex-1 rounded-2xl border border-white/10 bg-transparent px-4 py-3" /><button className="rounded-2xl bg-executor px-6 py-3 font-semibold text-bg hover:brightness-110">Entrar na lista de espera</button></div>
      <label className="flex items-start gap-2 text-xs normal-case tracking-normal text-dim"><input type="checkbox" className="mt-0.5 !w-auto" checked={c} onChange={(e) => setC(e.target.checked)} />Aceito receber um e-mail quando a venda abrir. Uso só o e-mail para isso (<a className="underline" href="/privacy">privacidade</a>).</label>
      {err && <p role="alert" className="text-sm text-risk">{err}</p>}
    </form>
  );
}
