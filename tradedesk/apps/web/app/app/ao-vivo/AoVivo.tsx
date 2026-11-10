'use client';
import { useState } from 'react';
import CryptoLive from '@/components/CryptoLive';
import { b3Status } from '@/lib/market';
import LiveChart from '../../b3/live/LiveChart';

export default function AoVivo({ hasB3 }: { hasB3: boolean }) {
  const [m, setM] = useState<'cripto' | 'b3'>('cripto');
  const st = b3Status();
  return (
    <div className="space-y-4">
      {hasB3 && <div className="flex gap-2">{([['cripto', 'Cripto · 24h'], ['b3', 'B3 · mini índice e dólar']] as const).map(([k, l]) => <button key={k} onClick={() => setM(k)} className={`rounded-full border px-4 py-1.5 text-sm ${m === k ? 'border-executor bg-executor/15 text-executor' : 'border-white/10 text-dim'}`}>{l}</button>)}</div>}
      {m === 'cripto' ? <CryptoLive /> : (
        <>
          <p className={`rounded-xl border px-3 py-2 text-sm ${st.open ? 'border-executor/40 bg-executor/10 text-executor' : 'border-white/10 bg-white/[.03] text-dim'}`}>B3: <b>{st.text}</b>{!st.open && ' — o robô segue operando cripto.'}</p>
          <LiveChart />
        </>)}
    </div>
  );
}
