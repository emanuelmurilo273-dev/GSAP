import Link from "next/link";

/** Indicador do painel: número grande, rótulo e uma dica; vira link quando tem destino. */
export function Stat({ label, value, hint, href, tone = "default" }: { label: string; value: string | number; hint?: string; href?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-red-300" : "text-white";
  const body = (
    <div className="card h-full p-4 transition hover:border-brand-500/30">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`font-display mt-2 text-3xl font-bold tabular-nums ${color}`}>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function Bar({ label, value, max, extra, href }: { label: string; value: number; max: number; extra?: string; href?: string }) {
  const w = max ? Math.max(3, Math.round((value / max) * 100)) : 0;
  const row = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <p className="truncate text-sm text-slate-200">{label}</p>
      <p className="text-xs tabular-nums text-slate-400">{value}{extra ? ` · ${extra}` : ""}</p>
      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-cyan-glow" style={{ width: `${w}%` }} /></div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-lg px-1 py-1 hover:bg-white/[0.03]">{row}</Link> : <div className="px-1 py-1">{row}</div>;
}
