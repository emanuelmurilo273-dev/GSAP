'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ExchangeForm from '@/components/ExchangeForm';
import { Panel, btn } from '@/components/ui';

export default function Onboarding({ acc, backtest, risk, enabled, exchanges, testnet }: { acc: { exchange: string; hint: string; verified: boolean } | null; backtest: boolean; risk: boolean; enabled: boolean; exchanges: string[]; testnet: boolean }) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState('');
  const step = !acc ? 1 : !backtest ? 2 : !risk ? 3 : 4;
  const Tag = ({ n, done, title }: { n: number; done: boolean; title: string }) => <span className={done ? 'text-neon-green' : step === n ? 'text-neon-orange' : 'text-dim'}>{done ? '✔' : n}. {title}</span>;

  async function accept() {
    const r = await fetch('/api/onboarding/risk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accept: true }) });
    if (r.ok) router.refresh(); else setMsg((await r.json()).error);
  }
  async function start() {
    const r = await fetch('/api/bot/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: true }) });
    const j = await r.json();
    if (r.ok) router.push('/app'); else setMsg(j.error);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg text-neon-green">&gt; onboarding</h1>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><Tag n={1} done={!!acc} title="Conectar corretora" /><Tag n={2} done={backtest} title="Rodar backtest" /><Tag n={3} done={risk} title="Termo de risco" /><Tag n={4} done={enabled} title="Ligar robô" /></div>

      <Panel title="1 · conectar corretora" accent="#3aa8ff">
        <ExchangeForm connected={acc} onDone={() => router.refresh()} exchanges={exchanges} testnet={testnet} />
      </Panel>

      <Panel title="2 · backtest obrigatório" accent="#ff4fa3">
        {backtest ? <p className="text-sm text-neon-green">✔ Backtest realizado com a configuração atual. <a href="/app/backtest">Rodar outro</a></p>
          : <p className="text-sm">Rode a estratégia em dados históricos antes de ligar. <a className="underline" href="/app/backtest">Ir para o backtest →</a></p>}
      </Panel>

      <Panel title="3 · termo de risco" accent="#ffa21f">
        {risk ? <p className="text-sm text-neon-green">✔ Termo aceito.</p> : (
          <div className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 pl-5 text-dim">
              <li>O robô opera com <b className="text-ink">dinheiro real</b> na minha conta e <b className="text-ink">pode ter prejuízo</b>, inclusive perda de todo o valor alocado.</li>
              <li>Resultados passados e backtests <b className="text-ink">não garantem</b> resultados futuros.</li>
              <li>Falhas de corretora, API, rede ou software podem causar perdas; stops podem executar com slippage.</li>
              <li>Isto <b className="text-ink">não é recomendação de investimento</b>. Sou o único responsável pelo capital e pelas configurações.</li>
            </ul>
            <label className="flex items-start gap-2 normal-case tracking-normal text-ink"><input className="mt-1 !w-auto" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Li, entendi e aceito os riscos e os <a href="/terms" target="_blank">Termos de Uso</a>.</label>
            <button className={btn} disabled={!agree || step < 3} onClick={accept}>aceitar termo</button>
          </div>)}
      </Panel>

      <Panel title="4 · ligar o robô" accent="#39ff88">
        {enabled ? <p className="text-sm text-neon-green">✔ Robô ligado. <a href="/app">Ver dashboard</a></p> : (
          <div className="space-y-2"><button className={btn} disabled={step < 4} onClick={start}>▶ ligar robô</button>
            {step < 4 && <p className="text-xs text-dim">Conclua os passos anteriores para liberar.</p>}</div>)}
        {msg && <p className="mt-2 text-sm text-neon-pink">{msg}</p>}
      </Panel>
    </div>
  );
}
