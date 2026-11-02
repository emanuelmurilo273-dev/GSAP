import Link from "next/link";

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.8-3.8" />
          <path d="M8.5 11h5M11 8.5v5" />
        </svg>
        <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
      </span>
      {!compact && (
        <span className="text-[1.05rem] font-bold tracking-tight text-white">
          SiteHunter <span className="bg-gradient-to-r from-brand-400 to-cyan-glow bg-clip-text text-transparent">AI</span>
        </span>
      )}
    </Link>
  );
}
