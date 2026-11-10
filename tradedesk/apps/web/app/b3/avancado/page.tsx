import { Panel } from '@/components/ui';
import pesquisa from '@/lib/pesquisa.json';

const LINKS = [['/b3/detalhes', 'Agentes, logs e controles técnicos', 'Os 6 agentes, o registro completo e a troca de modo.'], ['/b3/config', 'Configurações', 'Ativos, risco, horários e limites.'], ['/b3/saude', 'Saúde do robô (completa)', 'Semáforo, custos e a trava do modo real.'], ['/b3/comecar', 'Refazer o onboarding', 'Os 3 passos: MT5, perfil e ligar.']] as const;

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Avançado</h1>
      <ul className="grid gap-3 sm:grid-cols-2">{LINKS.map(([h, t, d]) => <li key={h}><a href={h} className="block rounded-2xl border border-white/[.07] bg-white/[.03] p-4 transition hover:border-executor/50"><b>{t}</b><p className="mt-1 text-sm text-dim">{d}</p></a></li>)}</ul>
      <Panel title="Backtest e pesquisa (resumo)" accent="#a478ff">
        <p className="mb-3 text-sm"><b className={pesquisa.temVantagem ? 'text-executor' : 'text-risk'}>{pesquisa.veredito}</b></p>
        <div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-sm"><thead><tr className="text-left text-xs text-dim"><th className="py-1">Estratégia</th><th>Treino (PF)</th><th>Validação (PF)</th><th>Resultado</th></tr></thead>
          <tbody>{pesquisa.familias.map((f) => <tr key={f.nome} className="border-t border-white/5"><td className="py-1.5">{f.nome}</td><td className="font-mono">{f.treino}</td><td className="font-mono">{f.validacao}</td><td className="text-dim">{f.resultado}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-dim">{pesquisa.nota}</p>
      </Panel>
    </div>
  );
}
