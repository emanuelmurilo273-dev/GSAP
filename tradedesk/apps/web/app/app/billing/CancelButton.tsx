'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btnDanger } from '@/components/ui';

export default function CancelButton() {
  const r = useRouter();
  const [msg, setMsg] = useState('');
  async function cancel() {
    if (!confirm('Cancelar a assinatura? Cobranças futuras serão encerradas; o acesso segue até o fim do período pago. Posições abertas não são fechadas automaticamente.')) return;
    const res = await fetch('/api/billing/cancel', { method: 'POST' });
    const j = await res.json();
    if (res.ok) r.refresh(); else setMsg(j.error);
  }
  return <div><button className={btnDanger} onClick={cancel}>cancelar assinatura</button>{msg && <p className="mt-2 text-sm text-neon-pink">{msg}</p>}</div>;
}
