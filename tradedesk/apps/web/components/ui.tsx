import type { ReactNode } from 'react';
import CountUp from './CountUp';
import EquityChart from './EquityChart';

export { AGENTS } from './agents';
export { APP_NAME, Logo, LogoMark } from './Logo';

export function Panel({ title, right, children, className = '', accent = '#3ddc84' }: {
  title?: string; right?: ReactNode; children: ReactNode; className?: string; accent?: string;
}) {
  return (
    <section className={`glass ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em]">
          <span className="flex items-center gap-2" style={{ color: accent }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />{title}</span>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone, sub, count }: {
  label: string; value?: ReactNode; tone?: 'pos' | 'neg' | 'neutral'; sub?: ReactNode;
  count?: { value: number; decimals?: number; suffix?: string; prefix?: string; signed?: boolean };
}) {
  const color = tone === 'pos' ? 'text-executor' : tone === 'neg' ? 'text-risk' : 'text-ink';
  return (
    <div className="glass p-3.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-dim">{label}</div>
      <div className={`mt-1.5 font-mono text-[22px] font-semibold leading-none tracking-tight ${color}`}>
        {count ? <CountUp {...count} /> : value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

export const Skeleton = ({ className = 'h-6 w-24' }: { className?: string }) => <div className={`skeleton ${className}`} aria-hidden />;
export const EmptyState = ({ children }: { children: ReactNode }) => <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-dim">{children}</p>;
export const ErrorState = ({ children }: { children: ReactNode }) => <p role="alert" className="rounded-lg border border-risk/40 bg-risk/10 p-3 text-sm text-risk">{children}</p>;

export const tone = (n: number | null | undefined) => (n == null || n === 0 ? 'neutral' : n > 0 ? 'pos' : 'neg') as 'pos' | 'neg' | 'neutral';
export const pct = (n: number | null | undefined, d = 2) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`);
export const num = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const dt = (s: string | number | Date) =>
  new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const dateOnly = (s: string | number | Date) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function LineChart({ data, height = 200, color = '#3ddc84' }: { data: { t: number; v: number }[]; height?: number; color?: string }) {
  return <EquityChart data={data} height={height} color={color} />;
}

const base = 'inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40';
export const btn = `${base} border-executor/50 bg-executor/10 text-executor hover:bg-executor hover:text-bg`;
export const btnDanger = `${base} border-risk/50 bg-risk/10 text-risk hover:bg-risk hover:text-bg`;
export const btnPrimary = `${base} border-executor bg-executor text-bg hover:brightness-110`;

export function RiskBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-filter/40 bg-bg/90 px-4 py-2 text-center text-[11px] leading-snug text-filter backdrop-blur-md">
      <span aria-hidden>⚠</span> Resultados passados não garantem resultados futuros. O robô pode ter prejuízo. Não é recomendação de investimento.
    </div>
  );
}
