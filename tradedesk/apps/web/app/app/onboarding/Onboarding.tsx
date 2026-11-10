'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ExchangeForm from '@/components/ExchangeForm';
import { Help } from '@/components/Help';

type Any = Record<string, any>;
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const PERFIS = [
  { id: 'conservador', nome: 'Conservador', pos: 0.05, day: 0.01, maxPos: 1, txt: 'Arrisca pouco. Perde pouco nos dias ruins.' },
  { id: 'moderado', nome: 'Moderado', pos: 0.10, day: 0.02, maxPos: 2, txt: 'Meio-termo entre ritmo e proteção.' },
  { id: 'agressivo', nome: 'Agressivo', pos: 0.15, day: 0.04, maxPos: 3, txt: 'Dias ruins doem mais. Só para quem aceita isso.' },
] as const;
const STEPS = ['Conectar a corretora', 'Escolher o perfil', 'Ligar'];

function Tutorial() {
  const items: [string, string][] = [['1', 'Entre na sua conta da Foxbit (ou da corretora escolhida) e abra "API" nas configurações.'], ['2', 'Crie uma chave nova marcando só Leitura e Negociação. NUNCA marque Saque.'], ['3', 'Se puder, restrinja a chave ao IP do servidor do app. Cole a chave e o segredo abaixo.']];
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Como criar a chave de API">
      {items.map(([n, t]) => <li key={n} className="rounded-2xl border border-white/10 bg-[#0b1118] p-3 text-xs text-dim"><span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-executor/15 font-bold text-executor">{n}</span>{t}</li>)}
    </ol>
  );
}

/** Onboarding de 3 passos: conectar corretora → escolher perfil (mostra o pior dia em R$ e o resultado histórico REAL da configuração) → ligar. */
export default function Onboarding({ acc, risk, enabled, exchanges, testnet, equity }: { acc: { exchange: string; hint: string; verified: boolean } | null; risk: boolean; enabled: boolean; exchanges: string[]; testnet: boolean; equity: number }) {
  const router = useRouter();
  const [step, setStep] = useState(acc ? 1 : 0);
  const [perfil, setPerfil] = useState<string>('conservador');
  const [bt, setBt] = useState<Any | null>(null); const [agree, setAgree] = useState(risk); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const P = PERFIS.find((p) => p.id === perfil)!; const bal = Math.max(equity, 0);
  const quote = acc?.exchange === 'foxbit' || acc?.exchange === 'mercado' ? 'BRL' : 'USDT';

  async function applyProfile() {
    setBusy(true); setMsg('');
    const params = { minScore: 0.7, stopPct: 0.03, targetPct: 0.06, trailingPct: 0.02, positionPct: P.pos, dailyLossPct: P.day, maxPositions: P.maxPos, timeframe: '1h' };
    const a = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...params, bases: ['BTC', 'ETH', 'SOL'], quote }) });
    if (!a.ok) { setBusy(false); return setMsg((await a.json()).error ?? 'erro'); }
    const b = await fetch('/api/backtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ exchange: acc?.exchange, symbol: `BTC/${quote}`, days: 365, params }) });
    const j = await b.json(); setBusy(false);
    if (!b.ok) return setMsg(j.error ?? 'erro no backtest'); setBt(j.metrics);
  }
  async function go() {
    setBusy(true); setMsg('');
    if (!risk && agree) await fetch('/api/onboarding/risk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accept: true }) });
    const r = await fetch('/api/bot/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: true }) });
    const j = await r.json(); setBusy(false);
    if (r.ok) router.push('/app'); else setMsg(j.error ?? 'erro');
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ol className="flex items-center gap-2" aria-label="Passos">{STEPS.map((s, i) => <li key={s} className="flex flex-1 items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i <= step ? 'bg-executor text-bg' : 'border border-white/15 text-dim'}`}>{i + 1}</span><span className={`hidden text-xs sm:block ${i === step ? 'text-ink' : 'text-dim'}`}>{s}</span><span className="h-px flex-1 bg-white/10" /></li>)}</ol>
      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5 rounded-3xl border border-white/[.07] bg-white/[.03] p-6">
          {step === 0 && (<>
            <h2 className="text-2xl font-semibold">1. Conectar a corretora</h2>
            <p className="text-dim">O dinheiro fica <b className="text-ink">sempre na sua conta</b>. O app só recebe uma chave de API <b className="text-ink">sem permissão de saque</b> e nunca recebe depósitos.</p>
            <Tutorial />
            <ExchangeForm connected={acc} onDone={() => router.refresh()} exchanges={exchanges} testnet={testnet} />
          </>)}
          {step === 1 && (<>
            <h2 className="text-2xl font-semibold">2. Escolha o perfil</h2>
            <p className="text-dim">Veja o <b className="text-ink">pior dia possível</b>: ao perder esse valor o robô para por hoje<Help term="stop" />. Em cada operação ele arrisca no máximo 1% da conta.</p>
            <div className="space-y-3" role="radiogroup" aria-label="Perfil">
              {PERFIS.map((p) => (
                <button key={p.id} role="radio" aria-checked={perfil === p.id} onClick={() => { setPerfil(p.id); setBt(null); }} className={`w-full rounded-2xl border p-4 text-left transition ${perfil === p.id ? 'border-executor bg-executor/10' : 'border-white/10 hover:border-white/25'}`}>
                  <div className="flex items-baseline justify-between"><b className="text-lg">{p.nome}</b><span className="font-mono text-sm text-risk">pior dia: −{bal ? brl(bal * p.day) : `${p.day * 100}% da conta`}</span></div>
                  <p className="mt-1 text-sm text-dim">{p.txt}</p></button>))}
            </div>
            {!bt ? <button disabled={busy} onClick={applyProfile} className="w-full rounded-xl bg-executor px-6 py-3 font-semibold text-bg hover:brightness-110 disabled:opacity-60">{busy ? 'calculando o resultado histórico…' : 'Aplicar perfil e ver o resultado histórico'}</button> : (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b1118] p-4 text-sm">
                <p className="font-semibold">Como esta configuração teria ido no último ano (BTC, dados reais, taxas reais da corretora):</p>
                <p className={bt.totalPnlPct >= 0 ? 'text-executor' : 'text-risk'}>Resultado: <b>{(bt.totalPnlPct * 100).toFixed(1).replace('.', ',')}%</b> · {bt.trades} operações · acerto {bt.winRate == null ? '—' : Math.round(bt.winRate * 100) + '%'} · fator de lucro{' '}{bt.profitFactor == null ? '—' : bt.profitFactor.toFixed(2).replace('.', ',')}<Help term="fator" /></p>
                <p className="text-xs text-dim">Isto é o passado e não garante nada. Se o número for negativo, ele está negativo: o app não esconde.</p>
              </div>)}
          </>)}
          {step === 2 && (<>
            <h2 className="text-2xl font-semibold">3. Ligar o robô</h2>
            <ul className="space-y-2 text-sm"><li>✔ Perfil <b>{P.nome}</b>: no pior dia perde no máximo <b className="text-risk">{bal ? brl(bal * P.day) : `${P.day * 100}% da conta`}</b>.</li><li>✔ Stop em toda ordem, para depois de 1 perda no dia, e <b>pausa sozinho</b> se a conta cair 5% do pico.</li><li>✔ Botão PARAR TUDO sempre visível.</li></ul>
            {!risk && <label className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm"><input type="checkbox" className="mt-1 !w-auto" checked={agree} onChange={(e) => setAgree(e.target.checked)} />Entendo que o robô opera com <b>dinheiro real</b> na minha conta, que <b>pode ter prejuízo</b>, que resultados passados não garantem resultados futuros e que isto não é recomendação de investimento.</label>}
            {enabled && <p className="text-sm text-executor">✔ Robô já está ligado.</p>}
          </>)}
          {msg && <p role="alert" className="text-sm text-risk">{msg}</p>}
          <div className="flex justify-between pt-2">
            <button disabled={step === 0 || busy} onClick={() => setStep(step - 1)} className="rounded-xl px-4 py-3 text-sm text-dim hover:text-ink disabled:opacity-30">Voltar</button>
            {step === 0 && <button disabled={!acc} onClick={() => setStep(1)} className="rounded-xl bg-executor px-6 py-3 font-semibold text-bg disabled:opacity-40">Continuar</button>}
            {step === 1 && <button disabled={!bt} onClick={() => setStep(2)} className="rounded-xl bg-executor px-6 py-3 font-semibold text-bg disabled:opacity-40">Continuar</button>}
            {step === 2 && <button disabled={busy || (!risk && !agree)} onClick={go} className="rounded-xl bg-executor px-6 py-3 font-semibold text-bg hover:brightness-110 disabled:opacity-40">Ligar o robô</button>}
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
