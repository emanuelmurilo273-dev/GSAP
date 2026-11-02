"use client";
import { useEffect, useState } from "react";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`${className} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`} aria-hidden />;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info" | "warn"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-500/30 bg-red-500/10 text-red-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    info: "border-brand-500/30 bg-brand-500/10 text-brand-200",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

let toastListener: ((m: string) => void) | null = null;
export function toast(message: string) {
  toastListener?.(message);
}
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastListener = (m) => {
      setMsg(m);
      setTimeout(() => setMsg(null), 2800);
    };
    return () => {
      toastListener = null;
    };
  }, []);
  if (!msg) return null;
  return <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-brand-500/30 bg-ink-800 px-4 py-2.5 text-sm text-white shadow-2xl animate-fade-up">{msg}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PUBLISHED: ["No ar", "bg-emerald-500/15 text-emerald-300"],
    UNPUBLISHED: ["Despublicado", "bg-slate-500/15 text-slate-300"],
    SUSPENDED: ["Suspenso", "bg-amber-500/15 text-amber-300"],
    DRAFT: ["Rascunho", "bg-brand-500/15 text-brand-300"],
  };
  const [label, cls] = map[status] ?? [status, "bg-slate-500/15 text-slate-300"];
  return <span className={`badge ${cls}`}>{label}</span>;
}
