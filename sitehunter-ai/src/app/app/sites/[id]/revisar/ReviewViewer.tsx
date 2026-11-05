"use client";
import Link from "next/link";
import { useState } from "react";

export function ReviewViewer({ html, name, projectId, leadId, published, concept, notes }: { html: string; name: string; projectId: string; leadId: string | null; published: boolean; concept: { name: string; summary: string; reasons: string[] } | null; notes: string[] }) {
  const [dev, setDev] = useState<"d" | "m">("d");
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{name}</h1>
          <p className="text-sm text-slate-400">{published ? "Link público liberado" : "Prévia privada: só você vê"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div role="tablist" aria-label="Dispositivo" className="flex rounded-xl border border-white/10 p-1">
            <button role="tab" aria-selected={dev === "d"} className={`rounded-lg px-3 py-1.5 text-sm ${dev === "d" ? "bg-white/10 text-white" : "text-slate-400"}`} onClick={() => setDev("d")}>Computador</button>
            <button role="tab" aria-selected={dev === "m"} className={`rounded-lg px-3 py-1.5 text-sm ${dev === "m" ? "bg-white/10 text-white" : "text-slate-400"}`} onClick={() => setDev("m")}>Celular</button>
          </div>
          <Link href={`/app/sites/${projectId}`} className="btn-primary px-3 py-2 text-sm">Editar</Link>
          {leadId && <Link href={`/app/abordagens#lead-${leadId}`} className="btn-secondary px-3 py-2 text-sm">Abordagem</Link>}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`overflow-hidden rounded-2xl border border-white/10 bg-black ${dev === "m" ? "mx-auto w-[390px] max-w-full" : "w-full"}`} style={{ height: "min(80vh, 860px)" }}>
          <iframe title={`Prévia de ${name}`} srcDoc={html} sandbox="allow-scripts allow-popups" className="h-full w-full" />
        </div>
        <aside className="card space-y-4 p-5">
          {concept ? (
            <div>
              <p className="label">Conceito desta empresa</p>
              <p className="font-semibold text-white">{concept.name}</p>
              <p className="mt-1 text-sm text-slate-400">{concept.summary}</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-slate-400">{concept.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          ) : <p className="text-sm text-slate-400">Prévia em direção clássica. No editor (aba Design) você pode trocar para a Vitrine 3D sob medida.</p>}
          {notes.length > 0 && (
            <div>
              <p className="label">Revise antes de liberar</p>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-amber-200/90">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
