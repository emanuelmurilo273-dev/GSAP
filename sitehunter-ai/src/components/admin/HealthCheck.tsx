"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Spinner } from "@/components/ui";

type R = { name: string; ok: boolean; ms: number; detail: string };

/** Botão que testa agora as fontes de dados e mostra quais respondem (o OpenStreetMap público oscila). */
export function HealthCheck() {
  const [res, setRes] = useState<{ checkedAt: string; results: R[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true); setErr(null);
    try { setRes(await api("/api/admin/health")); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div>
      <button onClick={run} disabled={busy} className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">{busy && <Spinner />}{busy ? "Testando as fontes…" : "Testar fontes agora"}</button>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      {res && (
        <div className="mt-3" aria-live="polite">
          <ul className="divide-y divide-white/5 rounded-xl border border-white/5">
            {res.results.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-slate-200">{r.name}</span>
                <span className={`badge shrink-0 ${r.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{r.ok ? `ok · ${r.ms} ms` : r.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Testado em {new Date(res.checkedAt).toLocaleString("pt-BR")}. Se todos falharem, a busca usa só o Nominatim, que traz menos empresas.</p>
        </div>
      )}
    </div>
  );
}
