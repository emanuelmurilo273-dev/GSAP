'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ExchangeForm from '@/components/ExchangeForm';
import ParamFields, { toForm, type PForm, fromForm } from '@/components/ParamFields';
import { Panel, btn } from '@/components/ui';
import { settingsToParams } from '@/lib/params';

export default function SettingsForm({ s, acc }: { s: any; acc: any }) {
  const router = useRouter();
  const [form, setForm] = useState<PForm>(toForm(settingsToParams(s)));
  const [bases, setBases] = useState<string>((s?.bases ?? ['BTC', 'ETH', 'SOL']).join(', '));
  const [quote, setQuote] = useState<string>(s?.quote ?? 'USDT');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...fromForm(form), quote, bases: bases.split(/[\s,;]+/).filter(Boolean) }) });
    const j = await r.json();
    setBusy(false);
    setMsg({ ok: r.ok, t: r.ok ? j.note : j.error });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Panel title="estratégia e risco" accent="#a66bff">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label>Moedas (ex.: BTC, ETH, SOL)</label><input value={bases} onChange={(e) => setBases(e.target.value)} /></div>
            <div><label>Cotação</label><select value={quote} onChange={(e) => setQuote(e.target.value)}><option value="USDT">USDT</option><option value="BRL">BRL</option></select></div>
          </div>
          <ParamFields v={form} set={setForm} />
          <p className="text-[11px] text-dim">Alterar a configuração invalida o backtest anterior: rode um novo antes de ligar o robô. A moeda de cotação define o saldo usado para calcular o tamanho das ordens e o limite diário.</p>
          <button className={btn} disabled={busy}>{busy ? 'salvando…' : 'salvar'}</button>
          {msg && <p className={`text-sm ${msg.ok ? 'text-neon-green' : 'text-neon-pink'}`}>{msg.t}</p>}
        </form>
      </Panel>
      <Panel title="corretora" accent="#3aa8ff">
        <ExchangeForm connected={acc ? { exchange: acc.exchange, hint: acc.key_hint, verified: acc.verified } : null} onDone={() => router.refresh()} />
      </Panel>
    </div>
  );
}
