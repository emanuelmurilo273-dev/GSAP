'use client';
import { useEffect, useState } from 'react';
import { btn } from '@/components/ui';

type Res = { checkoutId: string; invoiceUrl: string; qr?: { image: string; payload: string } };

export default function CheckoutForm({ price }: { price: string }) {
  const [f, setF] = useState({ name: '', email: '', cpfCnpj: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Res | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!res || paid) return;
    const id = setInterval(async () => {
      const r = await fetch(`/api/checkout/status?id=${res.checkoutId}`).then((x) => x.json()).catch(() => null);
      if (r?.paid) setPaid(true);
    }, 4000);
    return () => clearInterval(id);
  }, [res, paid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? 'erro');
    setRes(j);
  }

  if (paid) return (
    <div className="text-sm"><p className="text-neon-green">✔ Pagamento confirmado!</p><p className="mt-2 text-dim">Enviamos o link de acesso para <b>{f.email}</b>. Confira também a caixa de spam.</p></div>
  );

  if (res) return (
    <div className="space-y-4 text-sm">
      {res.qr ? (<>
        <p className="text-dim">Pague <b className="text-neon-green">{price}</b> via Pix:</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QR Code Pix" className="mx-auto h-56 w-56 bg-white p-2" src={`data:image/png;base64,${res.qr.image}`} />
        <div><label>Pix copia-e-cola</label>
          <textarea readOnly className="w-full border border-line bg-bg p-2 text-xs" rows={3} value={res.qr.payload} />
          <button className={`${btn} mt-2`} onClick={() => { navigator.clipboard.writeText(res.qr!.payload); setCopied(true); }}>{copied ? 'copiado ✔' : 'copiar código'}</button></div>
      </>) : <p className="text-dim">Use o link abaixo para pagar.</p>}
      <p className="text-dim">Prefere cartão? <a href={res.invoiceUrl} target="_blank" rel="noreferrer">Pagar com cartão na página segura do Asaas</a>.</p>
      <p className="blink text-xs text-neon-blue">aguardando confirmação do pagamento…</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><label>Nome completo</label><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
      <div><label>E-mail (receberá o acesso)</label><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></div>
      <div><label>CPF ou CNPJ</label><input required inputMode="numeric" value={f.cpfCnpj} onChange={(e) => setF({ ...f, cpfCnpj: e.target.value })} /></div>
      {err && <p className="text-sm text-neon-pink">{err}</p>}
      <button disabled={busy} className={`${btn} w-full py-3`}>{busy ? 'gerando cobrança…' : `Assinar – ${price}/mês`}</button>
    </form>
  );
}
