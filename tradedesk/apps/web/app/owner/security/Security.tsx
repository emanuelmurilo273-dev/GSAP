'use client';
import { useEffect, useState } from 'react';
import { btn } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Security() {
  const sb = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const [qr, setQr] = useState<{ id: string; svg: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { sb.auth.getUser().then(({ data }) => { if (!data.user) location.href = '/owner/login'; else setReady(true); }); /* eslint-disable-next-line */ }, []);

  async function savePw(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (pw.length < 12) return setMsg('Use pelo menos 12 caracteres.');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    setPwDone(true);
    startEnroll();
  }
  async function startEnroll() {
    const { data: f } = await sb.auth.mfa.listFactors();
    if (f?.totp?.length) { setQr(null); return; } // já tem fator verificado
    for (const x of f?.all ?? []) if (x.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Dono' });
    if (error || !data) return setMsg(error?.message ?? 'erro ao criar 2FA');
    setQr({ id: data.id, svg: data.totp.qr_code, secret: data.totp.secret });
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const { data: f } = await sb.auth.mfa.listFactors();
    const factorId = qr?.id ?? f?.totp?.[0]?.id;
    if (!factorId) return setMsg('Sem fator 2FA.');
    const ch = await sb.auth.mfa.challenge({ factorId });
    if (ch.error) return setMsg('Erro no desafio.');
    const v = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: code.trim() });
    if (v.error) return setMsg('Código inválido.');
    const r = await fetch('/api/owner/session', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    location.href = j.home ?? '/b3';
  }

  if (!ready) return <p className="text-sm text-dim">carregando…</p>;
  return (
    <div className="space-y-5 text-sm">
      <form onSubmit={savePw} className="space-y-3">
        <p className="text-dim">1. Defina uma senha forte (mín. 12 caracteres). Ela é usada junto com o 2FA.</p>
        <div><label>Nova senha</label><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <button className={btn} disabled={pwDone}>{pwDone ? '✔ senha salva' : 'salvar senha'}</button>
      </form>
      {(pwDone || qr) && (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-dim">2. Escaneie o QR no Google Authenticator / Authy e digite o código de 6 dígitos.</p>
          {qr && (<>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="QR Code do 2FA" className="mx-auto h-44 w-44 bg-white p-2" src={qr.svg} />
            <p className="break-all text-[11px] text-dim">Sem câmera? Chave: <span className="text-ink">{qr.secret}</span></p></>)}
          <div><label>Código (6 dígitos)</label><input inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <button className={btn}>ativar 2FA e entrar</button>
        </form>
      )}
      {msg && <p className="text-neon-pink" role="alert">{msg}</p>}
    </div>
  );
}
