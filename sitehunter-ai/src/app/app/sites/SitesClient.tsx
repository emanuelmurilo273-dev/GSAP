"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/api";
import { toast } from "@/components/ui";

type P = { id: string; name: string; company: string | null; place: string; external?: boolean; concept: { name: string; palette: string[]; display: string } | null; createdAt: string; updatedAt: string; status: string; url: string | null; pathUrl: string | null; visits: number; lastDeployAt: string | null };

export function SitesClient({ projects: initial, premium }: { projects: P[]; premium: boolean }) {
  const [projects, setProjects] = useState(initial);
  const [status, setStatus] = useState<string>("all");
  useEffect(() => {
    const s = new URLSearchParams(location.search).get("status");
    if (s) setStatus(s);
  }, []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(
    () => projects.filter((p) => (status === "all" || p.status === status) && (!from || p.createdAt >= from) && (!to || p.createdAt.slice(0, 10) <= to)),
    [projects, status, from, to],
  );

  async function publish(p: P) {
    setBusy(p.id);
    try {
      if (p.status !== "PUBLISHED" && !confirm(`Liberar o link público da prévia de "${p.name}"? Só esta página fica visível; o painel e os dados dos leads continuam privados.`)) return;
      const r = await api<{ publication: { url: string; pathUrl: string; status: string } }>(`/api/projects/${p.id}/publish`, { body: { confirmPublic: true } });
      setProjects((x) => x.map((y) => (y.id === p.id ? { ...y, status: "PUBLISHED", url: r.publication.url, external: !!(r.publication as { externalUrl?: string | null }).externalUrl, pathUrl: r.publication.pathUrl, lastDeployAt: new Date().toISOString() } : y)));
      toast(p.status === "PUBLISHED" ? "Prévia atualizada no link" : "Link público liberado");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function unpublish(p: P) {
    if (!confirm("Retirar o acesso público? O link deixa de funcionar na hora.")) return;
    setBusy(p.id);
    try {
      await api(`/api/projects/${p.id}/publish`, { method: "DELETE" });
      setProjects((x) => x.map((y) => (y.id === p.id ? { ...y, status: "UNPUBLISHED" } : y)));
      toast("Acesso retirado: a prévia voltou a ser privada");
    } finally {
      setBusy(null);
    }
  }
  async function remove(p: P) {
    if (!confirm(`Excluir o projeto "${p.name}"? O site publicado também sairá do ar. Essa ação não pode ser desfeita.`)) return;
    await api(`/api/projects/${p.id}`, { method: "DELETE" });
    setProjects((x) => x.filter((y) => y.id !== p.id));
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="block sm:w-48"><span className="label">Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos</option>
            <option value="PUBLISHED">Link público liberado</option>
            <option value="DRAFT">Privada</option>
            <option value="UNPUBLISHED">Acesso retirado</option>
            <option value="SUSPENDED">Suspenso</option>
          </select>
        </label>
        <label className="block"><span className="label">Criado de</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="block"><span className="label">até</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      {!shown.length && <div className="card p-10 text-center text-slate-400">Nenhuma prévia ainda. Abra um lead na aba <Link href="/app/leads" className="text-brand-300 underline">Leads encontrados</Link> e clique em “Gerar prévia do site”.</div>}

      <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map((p) => {
          const pal = p.concept?.palette ?? ["#0b0b0f", "#15151b", "#f5f5f7", "#a1a1aa", "#3b82f6", "#1e3a8a"];
          const pub = p.status === "PUBLISHED";
          return (
            <li key={p.id} className="card flex flex-col overflow-hidden">
              <Link href={`/app/sites/${p.id}/revisar`} className="relative block h-36 overflow-hidden" style={{ background: `radial-gradient(120% 120% at 85% 0%, ${pal[4]}55, ${pal[0]} 60%)` }} aria-label={`Revisar prévia de ${p.name}`}>
                <span className="absolute left-4 top-3 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: pal[4] }}>{p.place || "Prévia"}</span>
                <span className="absolute bottom-3 left-4 right-4 truncate text-2xl font-bold" style={{ color: pal[2], fontFamily: `'${p.concept?.display ?? "Inter"}', serif` }}>{p.company ?? p.name}</span>
                <span className="absolute right-4 top-3 flex gap-1">{pal.slice(0, 6).map((c, i) => <i key={i} className="h-3 w-3 rounded-full border border-white/20" style={{ background: c }} />)}</span>
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`badge ${pub ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>{pub ? "Link público liberado" : p.status === "SUSPENDED" ? "Suspensa" : "Privada"}</span>
                  <span className="text-[11px] text-slate-500">Atualizada {new Date(p.updatedAt).toLocaleDateString("pt-BR")}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{p.concept?.name ?? "Direção clássica"}</p>
                {p.url && pub && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-300 hover:underline">{p.url.replace(/^https?:\/\//, "")}</a>
                    <button className="text-slate-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(p.url!); toast("Endereço copiado"); }}>Copiar</button>
                    <span className="text-slate-500">· {p.external ? "link público (GitHub)" : `${p.visits} visita(s)`}</span>
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/app/sites/${p.id}/revisar`} className="btn-primary px-3 py-2 text-xs">Revisar</Link>
                  <Link href={`/app/sites/${p.id}`} className="btn-secondary px-3 py-2 text-xs">Editar</Link>
                  {pub ? (
                    <>
                      <button className="btn-secondary px-3 py-2 text-xs" disabled={!premium || busy === p.id} onClick={() => publish(p)}>Atualizar link</button>
                      <button className="btn-secondary px-3 py-2 text-xs" disabled={busy === p.id} onClick={() => unpublish(p)}>Retirar acesso</button>
                    </>
                  ) : (
                    <button className="btn-secondary px-3 py-2 text-xs" disabled={!premium || busy === p.id} onClick={() => publish(p)}>Liberar link</button>
                  )}
                  <button className="btn-ghost px-2 py-2 text-xs text-red-300" onClick={() => remove(p)} aria-label={`Excluir prévia de ${p.name}`}>Excluir</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
