import type { ReactNode } from 'react';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'NEONDESK';

export const AGENTS = [
  { id: 'scout', n: 1, name: 'Scout', color: '#3aa8ff', desc: 'Monitora seus pares e coleta candles em tempo real.' },
  { id: 'filter', n: 2, name: 'Filter', color: '#a66bff', desc: 'Descarta pares com pouca liquidez, spread alto ou volatilidade extrema.' },
  { id: 'analyst', n: 3, name: 'Analyst', color: '#ff4fa3', desc: 'EMA 9/21, RSI, MACD, volume e suporte/resistência + LLM. Nota de 0 a 1.' },
  { id: 'executor', n: 4, name: 'Executor', color: '#39ff88', desc: 'Envia a ordem real à sua corretora, limitada a % do seu saldo.' },
  { id: 'risk', n: 5, name: 'Risk', color: '#ffa21f', desc: 'Stop, alvo/trailing, limite de perda diária. Nunca faz preço médio.' },
  { id: 'logger', n: 6, name: 'Logger', color: '#c9f7da', desc: 'Registra entradas, saídas, recusas e motivos. Relatório diário por e-mail.' },
] as const;

export function Panel({ title, right, children, className = '', accent = '#39ff88' }: {
  title?: string; right?: ReactNode; children: ReactNode; className?: string; accent?: string;
}) {
  return (
    <section className={`border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-4 py-2 text-xs uppercase tracking-widest">
          <span style={{ color: accent }}>&gt; {title}</span>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: 'pos' | 'neg' | 'neutral'; sub?: ReactNode }) {
  const color = tone === 'pos' ? 'text-neon-green' : tone === 'neg' ? 'text-neon-pink' : 'text-ink';
  return (
    <div className="border border-line bg-panel p-3">
      <div className="text-[11px] uppercase tracking-widest text-dim">{label}</div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

export const tone = (n: number | null | undefined) => (n == null || n === 0 ? 'neutral' : n > 0 ? 'pos' : 'neg') as 'pos' | 'neg' | 'neutral';
export const pct = (n: number | null | undefined, d = 2) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`);
export const num = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const dt = (s: string | number | Date) =>
  new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const dateOnly = (s: string | number | Date) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function LineChart({ data, height = 160, color = '#39ff88' }: { data: { t: number; v: number }[]; height?: number; color?: string }) {
  if (data.length < 2) return <div className="flex items-center justify-center text-xs text-dim" style={{ height }}>sem dados suficientes ainda</div>;
  const W = 600;
  const vs = data.map((d) => d.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * W},${height - 8 - ((d.v - lo) / span) * (height - 16)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label="gráfico de equity">
        <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <polyline points={`0,${height} ${pts} ${W},${height}`} fill="url(#g)" stroke="none" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-dim"><span>{dateOnly(data[0].t)} · {num(vs[0])}</span><span>{dateOnly(data[data.length - 1].t)} · {num(vs[vs.length - 1])}</span></div>
    </div>
  );
}

export const btn = 'border border-neon-green px-4 py-2 text-sm uppercase tracking-widest text-neon-green hover:bg-neon-green hover:text-bg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neon-green transition';
export const btnDanger = 'border border-neon-pink px-4 py-2 text-sm uppercase tracking-widest text-neon-pink hover:bg-neon-pink hover:text-bg disabled:opacity-40 transition';

export function RiskBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neon-orange/60 bg-bg/95 px-4 py-2 text-center text-[11px] leading-snug text-neon-orange backdrop-blur">
      ⚠ Resultados passados não garantem resultados futuros. O robô pode ter prejuízo. Não é recomendação de investimento.
    </div>
  );
}

export function Logo() {
  return <a href="/" className="text-lg font-bold tracking-widest text-neon-green no-underline">&gt;_{APP_NAME}<span className="cursor" /></a>;
}
