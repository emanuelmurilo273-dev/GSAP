'use client';
import { useEffect, useState } from 'react';

type Any = Record<string, any>;

/** Chave geral de emergência: desliga TODOS os robôs (cripto e B3), zera posições e trava o real. Religar só com estratégia aprovada. */
export default function Emergencia() {
  const [ks, setKs] = useState<Any | null>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [phrase, setPhrase] = useState('');
  const load = () => fetch('/api/emergencia').then((x) => x.json()).then(setKs).catch(() => {});
  useEffect(() => { load(); }, []);
  async function call(body: Any) {
    setBusy(true); setMsg('');
    const r = await fetch('/api/emergencia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}));
    setBusy(false); setMsg(r.ok ? (body.action === 'halt' ? `Tudo desligado. Posições de cripto fechadas: ${j.closed} · falhas: ${j.failed}. ${j.failed ? 'Feche as que falharam NA MÃO na corretora.' : ''}` : 'Chave geral liberada (nenhum robô foi ligado).') : (j.error ?? 'erro')); load();
  }
  return (
    <div className="space-y-3">
      <p className={`rounded-lg border p-3 text-sm ${ks?.on ? 'border-risk/50 bg-risk/10 text-risk' : 'border-white/10 text-dim'}`}>{ks?.on ? `🛑 EMERGÊNCIA ATIVA: nenhum robô opera. Motivo: ${ks.reason ?? '—'}` : 'Chave geral desligada: os robôs podem operar se estiverem ligados.'}</p>
      <button disabled={busy} onClick={() => confirm('DESLIGAR TODOS OS ROBÔS e FECHAR as posições a mercado agora?') && call({ action: 'halt', reason: 'acionada pelo dono no admin' })} className="w-full rounded-xl border border-risk bg-risk px-4 py-3 text-sm font-bold uppercase tracking-widest text-bg hover:brightness-110 disabled:opacity-50">🛑 Emergência: desligar tudo e zerar posições</button>
      {ks?.on && <div className="flex flex-wrap gap-2"><input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="RELIGAR APÓS APROVAÇÃO" aria-label="Frase para liberar" className="!w-auto min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm" /><button disabled={busy} onClick={() => call({ action: 'release', phrase })} className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Liberar chave geral</button></div>}
      {msg && <p role="status" className="text-sm text-filter">{msg}</p>}
    </div>
  );
}
