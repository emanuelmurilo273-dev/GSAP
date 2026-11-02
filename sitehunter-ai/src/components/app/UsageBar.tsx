export function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 100 ? "from-red-500 to-red-400" : pct >= 80 ? "from-amber-500 to-amber-400" : "from-brand-600 to-cyan-glow";
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">{used} / {limit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
