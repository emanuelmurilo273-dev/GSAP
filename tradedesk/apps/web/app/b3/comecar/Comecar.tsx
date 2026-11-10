'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Help } from '@/components/Help';

type Any = Record<string, any>;
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const PERFIS = [
  { id: 'conservador', nome: 'Conservador', risk: 0.005, day: 0.01, txt: 'Arrisca pouco por operação. Recomendado para começar.' },
  { id: 'moderado', nome: 'Moderado', risk: 0.01, day: 0.02, txt: 'Perde e ganha mais rápido. Só depois de ver o robô funcionando.' },
  { id: 'agressivo', nome: 'Agressivo', risk: 0.02, day: 0.04, txt: 'Dias ruins doem. Não recomendado antes de o robô provar vantagem.' },
] as const;

/** Ilustrações dos passos do MT5 (esquemas desenhados, não capturas de tela: cada corretora muda um pouco o visual). */
function Mock({ n }: { n: number }) {
  const box = 'rounded-xl border border-white/10 bg-[#0b1118] p-3 text-xs';
  if (n === 1) return <div className={box} aria-hidden><div className="mb-2 flex gap-1.5">{['#ff5c6c', '#ffcf4d', '#3ddc84'].map((c) => <i key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />)}<span className="ml-2 text-dim">MetaTrader 5 · Clear</span></div><div className="rounded-lg bg-white/5 p-2">Arquivo ▸ <b className="text-executor">Abrir uma conta demo</b></div></div>;
  if (n === 2) return <div className={box} aria-hidden><div className="text-dim">Servidor</div><div className="mb-2 rounded-lg bg-white/5 p-2 font-mono">ClearInvestimentos-DEMO</div><div className="text-dim">Login / senha</div><div className="rounded-lg bg-white/5 p-2 font-mono">••••••••</div></div>;
  return <div className={box} aria-hidden><div className="text-dim">Ferramentas ▸ Opções ▸ Expert Advisors</div><div className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 p-2"><span className="flex h-4 w-4 items-center justify-center rounded border border-executor bg-executor/20 text-[10px] text-executor">✓</span>Permitir negociação algorítmica</div></div>;
}

export default function Comecar({ demo }: { demo?: Any }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [st, setSt] = useState<Any | null>(demo ?? null);
  const [perfil, setPerfil] = useState<string>('conservador');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const load = useCallback(async () => { if (demo) return; const j = await fetch('/api/b3/state').then((x) => x.json()).catch(() => null); if (j && !j.error) setSt(j); }, [demo]);
  useEffect(() => { load(); if (demo) return; const id = setInterval(load, 3000); return () => clearInterval(id); }, [load, demo]);
  const alive = st?.connectorAgeSec != null && st.connectorAgeSec < 20;
  const bal = Math.max(1000, Number(st?.status?.balance ?? st?.status?.equity ?? 10000));
  const P = PERFIS.find((p) => p.id === perfil)!;

  async function post(url: string, body: Any) { if (demo) return true; setBusy(true); setErr(''); const r = await fetch(url, { method: url.includes('control') ? 'POST' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); setBusy(false); if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'erro'); return false; } return true; }
  async function finish() {
    if (await post('/api/b3/onboarding', { action: 'profile', profile: perfil }) && await post('/api/b3/control', { action: 'start' }) && await post('/api/b3/onboarding', { action: 'done' })) router.push('/b3');
  }
  const steps = ['Conectar o MT5', 'Escolher o perfil', 'Ligar'];
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <ol className="flex items-center gap-2" aria-label="Passos">
        {steps.map((s, i) => <li key={s} className="flex flex-1 items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i <= step ? 'bg-executor text-bg' : 'border border-white/15 text-dim'}`}>{i + 1}</span><span className={`hidden text-xs sm:block ${i === step ? 'text-ink' : 'text-dim'}`}>{s}</span><span className="h-px flex-1 bg-white/10" /></li>)}
      </ol>
      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5 rounded-3xl border border-white/[.07] bg-white/[.03] p-6">
          {step === 0 && (<>
            <h2 className="text-2xl font-semibold">1. Conectar o MetaTrader 5</h2>
            <p className="text-dim">O robô roda no seu PC (ou numa VPS) Windows, junto com o MT5 da Clear. Comece sempre pela <b className="text-ink">conta demo</b>: dinheiro de mentira, preços reais.</p>
            <ol className="space-y-4 text-sm">
              <li><p className="mb-2"><b>a)</b> No MT5, crie a conta demo.</p><Mock n={1} /></li>
              <li><p className="mb-2"><b>b)</b> Servidor <code className="text-executor">ClearInvestimentos-DEMO</code>; guarde login e senha.</p><Mock n={2} /></li>
              <li><p className="mb-2"><b>c)</b> Ligue a negociação algorítmica e rode <code className="text-executor">Instalar-Conector-Windows.bat</code> (ele pede esse login e senha).</p><Mock n={3} /></li>
            </ol>
            <p className={`flex items-center gap-2 rounded-xl p-3 text-sm ${alive ? 'bg-executor/10 text-executor' : 'bg-white/5 text-dim'}`}><span className={`h-2.5 w-2.5 rounded-full ${alive ? 'animate-pulse bg-executor' : 'bg-dim'}`} />{alive ? 'Conector conectado!' : 'Aguardando o conector… (se quiser só ver o robô, o simulador interno já funciona sem MT5)'}</p>
            <p className="text-xs text-dim">Os desenhos acima são esquemas; o visual do MT5 pode variar um pouco. Guia completo: <code>docs/B3-GUIA.md</code>.</p>
          </>)}
          {step === 1 && (<>
            <h2 className="text-2xl font-semibold">2. Escolha o perfil</h2>
            <p className="text-dim">O perfil define quanto o robô arrisca. Veja o <b className="text-ink">pior dia possível</b>: ao perder esse valor o robô para por hoje<Help term="stop" />.</p>
            <div className="space-y-3" role="radiogroup" aria-label="Perfil">
              {PERFIS.map((p) => (
                <button key={p.id} role="radio" aria-checked={perfil === p.id} onClick={() => setPerfil(p.id)} className={`w-full rounded-2xl border p-4 text-left transition ${perfil === p.id ? 'border-executor bg-executor/10' : 'border-white/10 hover:border-white/25'}`}>
                  <div className="flex items-baseline justify-between"><b className="text-lg">{p.nome}</b><span className="font-mono text-sm text-risk">pior dia: −{brl(bal * p.day)}</span></div>
                  <p className="mt-1 text-sm text-dim">{p.txt}</p><p className="mt-1 text-xs text-dim">Arrisca ~{brl(bal * p.risk)} por operação (saldo de {brl(bal)}).</p>
                </button>))}
            </div>
          </>)}
          {step === 2 && (<>
            <h2 className="text-2xl font-semibold">3. Ligar o robô</h2>
            <ul className="space-y-2 text-sm">
              <li>✔ Modo: <b>SIMULADOR</b> (dinheiro real está travado).</li>
              <li>✔ Perfil <b>{P.nome}</b>: no pior dia perde no máximo <b className="text-risk">{brl(bal * P.day)}</b>.</li>
              <li>✔ Para depois de 1 perda no dia, zera tudo às 17:30, stop em toda ordem.</li>
              <li>✔ Você pode desligar ou apertar PARAR TUDO a qualquer momento.</li>
            </ul>
            <p className="rounded-xl bg-white/5 p-3 text-xs text-dim">Honestidade: este robô ainda <b className="text-ink">não provou ter vantagem</b>. No simulador ele serve para testar. A aba "Saúde do robô" mostra, em números, se vale a pena continuar.</p>
          </>)}
          {err && <p role="alert" className="text-sm text-risk">{err}</p>}
          <div className="flex justify-between pt-2">
            <button disabled={step === 0 || busy} onClick={() => setStep(step - 1)} className="rounded-xl px-4 py-3 text-sm text-dim hover:text-ink disabled:opacity-30">Voltar</button>
            {step < 2 ? <button onClick={() => setStep(step + 1)} className="rounded-xl bg-executor px-6 py-3 font-semibold text-bg hover:brightness-110">Continuar</button>
              : <button disabled={busy} onClick={finish} className="rounded-xl bg-executor px-6 py-3 font-semibold text-bg hover:brightness-110 disabled:opacity-60">Ligar o robô no simulador</button>}
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
