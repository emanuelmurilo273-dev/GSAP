"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/api";
import { StatusBadge, toast } from "@/components/ui";

type P = { id: string; name: string; company: string | null; createdAt: string; updatedAt: string; status: string; url: string | null; pathUrl: string | null; visits: number; lastDeployAt: string | null };

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
      const r = await api<{ publication: { url: string; pathUrl: string; status: string } }>(`/api/projects/${p.id}/publish`, { body: {} });
      setProjects((x) => x.map((y) => (y.id === p.id ? { ...y, status: "PUBLISHED", url: r.publication.url, pathUrl: r.publication.pathUrl, lastDeployAt: new Date().toISOString() } : y)));
      toast(p.status === "PUBLISHED" ? "Site atualizado" : "Site publicado!");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function unpublish(p: P) {
    if (!confirm("Retirar este site do ar?")) return;
    setBusy(p.id);
    try {
      await api(`/api/projects/${p.id}/publish`, { method: "DELETE" });
      setProjects((x) => x.map((y) => (y.id === p.id ? { ...y, status: "UNPUBLISHED" } : y)));
      toast("Site despublicado");
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
            <option value="PUBLISHED">No ar</option>
            <option value="DRAFT">Rascunho</option>
            <option value="UNPUBLISHED">Despublicado</option>
            <option value="SUSPENDED">Suspenso</option>
          </select>
        </label>
        <label className="block"><span className="label">Criado de</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="block"><span className="label">até</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      {!shown.length && <div className="card p-10 text-center text-slate-400">Nenhum site encontrado.</div>}

      <div className="grid gap-3">
        {shown.map((p) => (
          <article key={p.id} className="card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-white">{p.name}</h3>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {p.company ? `Empresa: ${p.company} · ` : ""}Criado em {new Date(p.createdAt).toLocaleDateString("pt-BR")} · Atualizado em {new Date(p.updatedAt).toLocaleString("pt-BR")}
                  {p.lastDeployAt && ` · Publicado em ${new Date(p.lastDeployAt).toLocaleString("pt-BR")}`}
                </p>
                {p.url && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-300 hover:underline">{p.url.replace(/^https?:\/\//, "")}</a>
                    <button className="text-xs text-slate-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(p.url!); toast("Endereço copiado"); }}>Copiar</button>
                    <span className="text-xs text-slate-500">· {p.visits} visita(s)</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/app/sites/${p.id}`} className="btn-primary px-3 py-2 text-xs">Editor</Link>
                {p.url && p.status === "PUBLISHED" && <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3 py-2 text-xs">Visualizar</a>}
                {p.status === "PUBLISHED" ? (
                  <>
                    <button className="btn-secondary px-3 py-2 text-xs" disabled={!premium || busy === p.id} onClick={() => publish(p)}>Atualizar</button>
                    <button className="btn-secondary px-3 py-2 text-xs" disabled={busy === p.id} onClick={() => unpublish(p)}>Despublicar</button>
                  </>
                ) : (
                  <button className="btn-secondary px-3 py-2 text-xs" disabled={!premium || busy === p.id} onClick={() => publish(p)}>Publicar</button>
                )}
                <a href={`/api/projects/${p.id}/export`} className="btn-secondary px-3 py-2 text-xs">Exportar</a>
                <button className="btn-ghost px-3 py-2 text-xs text-red-300" onClick={() => remove(p)}>Excluir</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
