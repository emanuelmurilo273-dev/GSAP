'use client';
import { useState } from 'react';
import { btn } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [err, setErr] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setState('busy'); setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback?next=/app` },
    });
    // mensagem neutra: não revela se o e-mail existe
    if (error && !/not found|signups not allowed|user/i.test(error.message)) { setErr('Não foi possível enviar agora. Tente de novo.'); setState('idle'); return; }
    setState('sent');
  }
  if (state === 'sent') return <p className="text-sm text-neon-green">Se este e-mail tiver uma assinatura, enviamos um link mágico. Confira sua caixa de entrada.</p>;
  return (
    <form onSubmit={go} className="space-y-3">
      <div><label>E-mail</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      {err && <p className="text-sm text-neon-pink">{err}</p>}
      <button className={`${btn} w-full py-3`} disabled={state === 'busy'}>{state === 'busy' ? 'enviando…' : 'enviar link mágico'}</button>
    </form>
  );
}
