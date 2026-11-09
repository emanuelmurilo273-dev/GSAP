'use client';
import { useState } from 'react';
import { btn, btnDanger } from '@/components/ui';

export default function ExchangeForm({ connected, onDone, exchanges = ['binance'], testnet = false }: { connected?: { exchange: string; hint: string; verified: boolean } | null; onDone?: () => void; exchanges?: string[]; testnet?: boolean }) {
  const [exchange, setExchange] = useState<'binance' | 'mercado'>('binance');
  const [apiKey, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [attest, setAttest] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch('/api/exchange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ exchange, apiKey, secret, attestNoWithdraw: attest }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error });
    setKey(''); setSecret('');
    setMsg({ ok: true, text: `Chave validada${j.verified ? ' (sem permissão de saque confirmada)' : ' (permissões declaradas por você)'}. ${j.note ?? ''}` });
    onDone?.();
  }
  async function remove() {
    if (!confirm('Desconectar a corretora? O robô será pausado.')) return;
    const r = await fetch('/api/exchange', { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) return setMsg({ ok: false, text: j.error });
    onDone?.();
  }

  return (
    <div className="space-y-4">
      {connected && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-line p-3 text-sm">
          <span>Conectada: <b className="text-neon-green">{connected.exchange}</b> · chave …{connected.hint} {connected.verified ? '· ✔ sem saque' : '· ⚠ declarada sem saque'}</span>
          <button className={btnDanger} onClick={remove}>desconectar</button>
        </div>
      )}
      <form onSubmit={save} className="space-y-3">
        <div><label>Corretora</label>
          <select value={exchange} onChange={(e) => setExchange(e.target.value as any)}><option value="binance">Binance{testnet ? ' (TESTNET)' : ''}</option>{exchanges.includes('mercado') && <option value="mercado">Mercado Bitcoin</option>}</select></div>
        <div><label>API Key</label><input value={apiKey} onChange={(e) => setKey(e.target.value)} autoComplete="off" required /></div>
        <div><label>API Secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" required /></div>
        {exchange === 'mercado' && (
          <label className="flex items-start gap-2 normal-case tracking-normal text-ink"><input type="checkbox" className="mt-1 !w-auto" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
            Declaro que esta chave NÃO tem permissão de saque (a Mercado Bitcoin não permite verificarmos isso automaticamente).</label>)}
        <p className="text-[11px] text-dim">Crie a chave só com permissão de trade/leitura, <b>sem saque</b>. {exchange === 'binance' ? 'Na Binance, restrinja ao IP do servidor se possível. Chaves com saque são recusadas.' : ''} Guardamos criptografada (AES-256).</p>
        {msg && <p className={`text-sm ${msg.ok ? 'text-neon-green' : 'text-neon-pink'}`}>{msg.text}</p>}
        <button disabled={busy} className={btn}>{busy ? 'validando na corretora…' : connected ? 'trocar chave' : 'validar e conectar'}</button>
      </form>
    </div>
  );
}
