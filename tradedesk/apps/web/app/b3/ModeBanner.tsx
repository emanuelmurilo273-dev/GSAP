'use client';
import { useEffect, useState } from 'react';

/** Faixa FIXA no topo: azul = SIMULADOR (conta demo) · vermelha = DINHEIRO REAL. Se a conta conectada não bate com o modo, avisa. */
export default function ModeBanner({ initial, demo = false, demoInternal = false }: { initial: 'sim' | 'real'; demo?: boolean; demoInternal?: boolean }) {
  const [mode, setMode] = useState<'sim' | 'real'>(initial);
  const [conflict, setConflict] = useState<string | null>(null);
  const [internal, setInternal] = useState(demoInternal);
  useEffect(() => {
    if (demo) return;
    let alive = true;
    const tick = async () => {
      const r = await fetch('/api/b3/state').then((x) => x.json()).catch(() => null);
      if (!alive || !r?.settings) return;
      setMode(r.settings.mode);
      setInternal(r.connectorAgeSec != null && r.connectorAgeSec < 30 && r.status?.source === 'internal');
      const am = r.status?.account_mode;
      setConflict(r.connectorAgeSec != null && r.connectorAgeSec < 30 && am && am !== 'unknown' && am !== (r.settings.mode === 'sim' ? 'demo' : 'real') ? `Conta ${am.toUpperCase()} conectada, mas o modo é ${r.settings.mode === 'sim' ? 'SIMULADOR' : 'REAL'} — operação bloqueada.` : null);
    };
    tick(); const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [demo]);
  const real = mode === 'real';
  return (
    <div role="status" aria-live="polite" className={`sticky top-0 z-40 px-3 py-2 text-center text-sm font-bold uppercase tracking-[0.2em] ${real ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
      {real ? '● DINHEIRO REAL' : internal ? '● SIMULADOR INTERNO · dinheiro fictício · PREÇOS ARTIFICIAIS' : '● SIMULADOR · conta demo, dinheiro fictício'}
      {internal && !real && <div className="mt-1 text-[11px] font-semibold normal-case tracking-normal">Mercado inventado, relógio acelerado. O resultado aqui NÃO indica nada sobre o mercado real.</div>}
      {conflict && <div className="mt-1 bg-black/30 px-2 py-1 text-[11px] font-semibold normal-case tracking-normal">{conflict}</div>}
    </div>
  );
}
