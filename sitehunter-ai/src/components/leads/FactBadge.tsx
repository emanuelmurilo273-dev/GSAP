import type { Fact, FactStatus } from "@/lib/leads/types";

export const STATUS_LABEL: Record<FactStatus, string> = {
  confirmed: "Confirmado",
  inferred: "Inferência",
  not_found: "Não encontrado",
  user: "Revisado por você",
};

export const FACT_CLASS: Record<FactStatus, string> = { confirmed: "fact-confirmed", inferred: "fact-inferred", not_found: "fact-missing", user: "fact-user" };

export function FactBadge({ fact, compact = false }: { fact?: Fact | null; compact?: boolean }) {
  const status: FactStatus = fact?.status ?? "not_found";
  const title = fact ? `${STATUS_LABEL[status]} · ${fact.source}${fact.confidence ? ` · confiança ${Math.round(fact.confidence * 100)}%` : ""}${fact.note ? ` · ${fact.note}` : ""}` : "Não coletado";
  return (
    <span className={FACT_CLASS[status]} title={title}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {compact ? <span className="sr-only">{STATUS_LABEL[status]}</span> : STATUS_LABEL[status]}
    </span>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return <span className={`badge demo-stripe text-amber-200 ring-1 ring-amber-400/40 ${className}`} title="Dados fictícios do modo demonstração">DEMO · fictício</span>;
}

export function ScoreMeter({ score }: { score: number }) {
  const tone = score >= 45 ? "bg-[var(--color-signal)]" : score >= 20 ? "bg-amber-400" : "bg-slate-500";
  return (
    <div className="flex items-center gap-2" title="Pontuação de oportunidade (quanto maior, mais espaço para melhorar a presença digital)">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${tone}`} style={{ width: `${Math.max(4, score)}%` }} /></div>
      <span className="text-xs tabular-nums text-slate-400">{score}</span>
    </div>
  );
}
