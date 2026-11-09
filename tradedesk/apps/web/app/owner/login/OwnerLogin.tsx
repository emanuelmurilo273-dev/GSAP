'use client';
import { useEffect, useState } from 'react';
import { btn } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function OwnerLogin() {
  const sb = supabaseBrowser();
  const [step, setStep] = useState<'pass' | 'totp' | 'sent'>('pass');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function afterPassword() {
    const mode = await fetch('/api/owner/mode').then((r) => r.json()).catch(() => ({ requires2fa: true }));
    if (!mode.requires2fa) return finish(); // instalação local: sem 2FA
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal2') return finish();
    if (aal?.nextLevel === 'aal2') return setStep('totp');
    location.href = '/owner/security'; // ainda sem 2FA cadastrado
  }
  async function finish() {
    const r = await fetch('/api/owner/session', { method: 'POST' });
    if (!r.ok) { setMsg('Este e-mail não é o do dono.'); await sb.auth.signOut(); setStep('pass'); return; }
    const j = await r.json().catch(() => ({}));
    location.href = j.home ?? '/app';
  }

  useEffect(() => { sb.auth.getUser().then(({ data }) => { if (data.user) afterPassword(); }); /* eslint-disable-next-line */ }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setMsg('E-mail ou senha incorretos.');
    afterPassword();
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { data: f } = await sb.auth.mfa.listFactors();
    const factor = f?.totp?.[0];
    if (!factor) { setBusy(false); return setMsg('Nenhum app autenticador cadastrado.'); }
    const ch = await sb.auth.mfa.challenge({ factorId: factor.id });
    if (ch.error) { setBusy(false); return setMsg('Erro no desafio 2FA.'); }
    const v = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: ch.data.id, code: code.trim() });
    setBusy(false);
    if (v.error) return setMsg('Código inválido.');
    finish();
  }
  async function magic() {
    await fetch('/api/owner/bootstrap', { method: 'POST' });
    setStep('sent');
  }

  if (step === 'sent') return <p className="text-sm text-neon-green">Se este app tem um dono configurado, enviamos um link único para o e-mail dele. Depois do link você define a senha e ativa o 2FA.</p>;
  if (step === 'totp') return (
    <form onSubmit={verify} className="space-y-3">
      <div><label>Código do app autenticador (6 dígitos)</label><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus required /></div>
      {msg && <p className="text-sm text-neon-pink" role="alert">{msg}</p>}
      <button className={`${btn} w-full py-3`} disabled={busy}>{busy ? 'verificando…' : 'confirmar 2FA'}</button>
    </form>
  );
  return (
    <div className="space-y-4">
      <form onSubmit={login} className="space-y-3">
        <div><label>E-mail do dono</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></div>
        <div><label>Senha</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
        {msg && <p className="text-sm text-neon-pink" role="alert">{msg}</p>}
        <button className={`${btn} w-full py-3`} disabled={busy}>{busy ? 'entrando…' : 'entrar'}</button>
      </form>
      <button onClick={magic} className="text-xs text-dim underline">Primeiro acesso ou esqueci a senha: enviar link mágico</button>
    </div>
  );
}
