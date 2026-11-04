export function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Esqueleto de carregamento com movimento discreto (shimmer), desligado com movimento reduzido. */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "profile" | "editor" }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <div className="space-y-2"><Sk className="h-8 w-64" /><Sk className="h-4 w-96 max-w-full" /></div>
      {variant === "list" && (
        <>
          <Sk className="h-56 w-full rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Sk key={i} className="h-60 rounded-2xl" />)}</div>
        </>
      )}
      {variant === "profile" && (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]"><Sk className="h-[520px] rounded-2xl" /><div className="space-y-6"><Sk className="h-72 rounded-2xl" /><Sk className="h-60 rounded-2xl" /></div></div>
      )}
      {variant === "editor" && (
        <div className="grid gap-4 lg:grid-cols-[400px_1fr]"><Sk className="h-[70vh] rounded-2xl" /><Sk className="h-[70vh] rounded-2xl" /></div>
      )}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
