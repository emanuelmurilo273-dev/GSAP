'use client';
import { motion } from 'framer-motion';
import { Help } from '@/components/Help';
import { LineChart } from '@/components/ui';

type Any = Record<string, any>;
const brl = (v: number | null | undefined, sign = false) => (v == null ? '—' : `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (v: number | null | undefined, sign = true) => (v == null ? '' : ` (${sign && v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(2).replace('.', ',')}%)`);
const col = (v: number) => (v > 0 ? 'text-executor' : v < 0 ? 'text-risk' : 'text-ink');
const PER: [string, string][] = [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano'], ['total', 'Desde o início']];

function Calendar({ days }: { days: { day: string; pnl: number; n: number }[] }) {
  if (!days.length) return null;
  const map = new Map(days.map((d) => [d.day, d]));
  const first = new Date(days[0].day + 'T12:00:00Z'), last = new Date();
  const start = new Date(Math.max(first.getTime(), last.getTime() - 200 * 86_400_000));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));            // começa numa segunda
  const max = Math.max(1, ...days.map((d) => Math.abs(d.pnl)));
  const weeks: { key: string; d?: { day: string; pnl: number; n: number } }[][] = [];
  for (let d = new Date(start); d <= last; d.setUTCDate(d.getUTCDate() + 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + i); const key = x.toISOString().slice(0, 10); return { key, d: map.get(key) }; }));
  }
  return (
    <div className="overflow-x-auto pb-1" role="img" aria-label="Calendário de resultados por dia: verde ganhou, vermelho perdeu">
      <div className="flex gap-[3px]">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {w.map(({ key, d }) => (
              <span key={key} title={d ? `${key}: ${brl(d.pnl, true)} (${d.n} op.)` : key} className="h-3.5 w-3.5 rounded-[3px]"
                style={{ background: !d ? 'rgba(255,255,255,.05)' : d.pnl >= 0 ? `rgba(61,220,132,${0.25 + 0.75 * Math.min(1, d.pnl / max)})` : `rgba(255,92,108,${0.25 + 0.75 * Math.min(1, -d.pnl / max)})` }} />))}
          </div>))}
      </div>
    </div>
  );
}

function Table({ rows, title }: { rows: Any[]; title: string }) {
  if (!rows?.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.03]">
      <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-[0.2em] text-dim">{title}</p>
      <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-dim"><th className="px-4 py-1 font-normal">&nbsp;</th><th className="font-normal">Op.</th><th className="font-normal">Acerto</th><th className="font-normal">Por op.</th><th className="pr-4 text-right font-normal">Resultado</th></tr></thead>
        <tbody>{rows.map((g) => <tr key={g.key} className="border-t border-white/5"><td className="px-4 py-1.5">{g.key}</td><td className="font-mono">{g.n}</td><td className="font-mono">{Math.round(g.winRate * 100)}%</td><td className={`font-mono ${col(g.expectancy)}`}>{brl(g.expectancy, true)}</td><td className={`pr-4 text-right font-mono ${col(g.pnl)}`}>{brl(g.pnl, true)}</td></tr>)}</tbody></table>
    </div>
  );
}

/** Estatísticas reais: mesmo componente no painel do cliente e na página pública. Mostra tudo, inclusive o que é ruim. */
export default function StatsView({ stats: s, excluded = 0, since }: { stats: Any; excluded?: number; since?: string | null }) {
  if (!s || !s.n) return (
    <div className="space-y-3 rounded-3xl border border-dashed border-white/10 p-8 text-center">
      <p className="text-lg font-medium">Ainda não há operações reais registradas.</p>
      <p className="text-sm text-dim">Os números aparecem aqui assim que o robô executar a primeira ordem na corretora. Nada é inventado nem estimado.</p>
    </div>
  );
  const pf = s.profitFactor === Infinity ? '∞' : s.profitFactor == null ? '—' : s.profitFactor.toFixed(2).replace('.', ',');
  return (
    <div className="space-y-6">
      <section aria-label="Resultado por período" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PER.map(([k, l]) => { const p = s.periods[k]; return (
          <motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4">
            <p className="text-xs text-dim">{l}</p>
            <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${col(p.pnl)}`}>{brl(p.pnl, true)}</p>
            <p className={`text-xs ${col(p.pnl)}`}>{pct(p.pct) || `${p.n} op.`}</p>
          </motion.div>); })}
      </section>

      <section aria-label="Métricas" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          [<>Taxa de acerto<Help term="acerto" /></>, s.winRate == null ? '—' : `${(s.winRate * 100).toFixed(1).replace('.', ',')}%`, ''],
          ['Ganho médio', brl(s.avgWin), 'text-executor'], ['Perda média', brl(-s.avgLoss), 'text-risk'],
          [<>Expectativa por operação<Help term="expectativa" /></>, brl(s.expectancy, true), col(s.expectancy ?? 0)],
          [<>Fator de lucro<Help term="fator" /></>, pf, ''], ['Operações', String(s.n), ''],
          ['Maior sequência de ganhos', String(s.bestStreak), 'text-executor'], ['Maior sequência de perdas', String(s.worstStreak), 'text-risk'],
          [<>Drawdown máximo<Help term="drawdown" /></>, `${brl(-s.maxDrawdown)}${s.maxDrawdownPct != null ? pct(-s.maxDrawdownPct, false) : ''}`, 'text-risk'], ['Drawdown atual', brl(-s.currentDrawdown), s.currentDrawdown > 0 ? 'text-risk' : ''],
          [<>Custos pagos<Help term="emolumentos" /></>, brl(-s.costs), ''], ['Dias negativos', `${s.negativeDays} de ${s.totalDays}`, ''],
        ] as [React.ReactNode, string, string][]).map(([l, v, c], i) => <div key={i} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><p className="text-xs text-dim">{l}</p><p className={`mt-1 font-mono text-base font-semibold tabular-nums sm:text-lg ${c}`}>{v}</p></div>)}
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Custos">
        <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><p className="text-xs text-dim">Resultado antes dos custos</p><p className={`mt-1 font-mono text-lg font-semibold ${col(s.gross)}`}>{brl(s.gross, true)}</p></div>
        <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><p className="text-xs text-dim">Custos (taxas e emolumentos)</p><p className="mt-1 font-mono text-lg font-semibold">{brl(-s.costs)}</p></div>
        <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><p className="text-xs text-dim">Resultado líquido</p><p className={`mt-1 font-mono text-lg font-semibold ${col(s.net)}`}>{brl(s.net, true)}</p></div>
      </section>

      <section className="rounded-3xl border border-white/[.07] bg-white/[.03] p-5" aria-label="Curva de patrimônio">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-dim">Curva de patrimônio</h2>
        <LineChart data={s.curve.map((p: Any) => ({ t: new Date(p.t).getTime(), v: p.v }))} height={220} color={s.net >= 0 ? '#3ddc84' : '#ff5c6c'} />
      </section>

      <section className="rounded-3xl border border-white/[.07] bg-white/[.03] p-5" aria-label="Calendário de resultados">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-dim">Calendário de resultados</h2>
        <Calendar days={s.calendar} />
        <p className="mt-3 text-xs text-dim">Verde: dia positivo · vermelho: dia negativo. Nenhum dia é omitido.</p>
      </section>

      <div className="grid gap-3 lg:grid-cols-3"><Table title="Por mercado" rows={s.byMarket} /><Table title="Por ativo" rows={s.bySymbol} /><Table title="Por horário (Brasília)" rows={s.byHour} /></div>

      <p className="rounded-2xl bg-white/[.03] p-4 text-xs leading-relaxed text-dim">
        Calculado só de operações <b className="text-ink">reais</b> executadas na corretora, cada uma com o ID da ordem{since ? <>; histórico completo desde <b className="text-ink">{new Date(since).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</b></> : null}. Operações sem ID de ordem na corretora não são contadas{excluded ? ` (${excluded} sem ID)` : ''}. Nenhum período ou dia é filtrado para melhorar os números. Operações em renda variável podem gerar perdas. Resultados passados não garantem resultados futuros.
      </p>
    </div>
  );
}
