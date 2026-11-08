"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Spinner, toast } from "@/components/ui";
import type { SiteContent } from "@/lib/site/types";

type Change = { path: string; label: string; before: string; after: string };
type Proposal = { summary: string; changes: Change[]; skipped: { path: string; reason: string }[] };

const IDEAS = ["Deixe o texto da abertura mais direto", "Reescreva o Sobre com tom mais acolhedor", "Melhore o título e a descrição para o Google", "Encurte as descrições dos serviços"];

/** Pedir ao Claude (dentro do Hunter) para reescrever textos do site. Ele propõe; você marca o que aceita e aplica. */
export function ClaudeEdit({ projectId, content, onApply, disabled }: { projectId: string; content: SiteContent; onApply: (c: SiteContent, note: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prop, setProp] = useState<Proposal | null>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setErr(null); setProp(null);
    try {
      const r = await api<{ proposal: Proposal }>(`/api/projects/${projectId}/assistant`, { body: { instruction: text.trim(), content } });
      setProp(r.proposal);
      setPick(Object.fromEntries(r.proposal.changes.map((c) => [c.path, true])));
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Erro inesperado."); } finally { setBusy(false); }
  }
  async function apply() {
    if (!prop) return;
    const chosen = prop.changes.filter((c) => pick[c.path]);
    if (!chosen.length) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ content: SiteContent }>(`/api/projects/${projectId}/assistant`, { method: "PUT", body: { content, changes: chosen.map((c) => ({ path: c.path, after: c.after })) } });
      onApply(r.content, `Claude: ${text.trim().slice(0, 90)}`);
      toast(`${chosen.length} alteração(ões) aplicada(s). Revise e salve.`);
      setProp(null); setText("");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Erro inesperado."); } finally { setBusy(false); }
  }

  return (
    <section className="rounded-xl border border-brand-500/25 bg-brand-500/5" aria-label="Claude no editor">
      <button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>✦ Pedir ao Claude</span><span className="text-xs text-slate-400">{open ? "fechar" : "editar textos"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <form onSubmit={ask} className="space-y-2">
            <label className="sr-only" htmlFor="claude-edit">O que você quer mudar no texto?</label>
            <textarea id="claude-edit" className="input min-h-[84px]" maxLength={800} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: deixe a abertura mais direta e fale do atendimento rápido" disabled={disabled || busy} />
            <div className="flex flex-wrap gap-1">{IDEAS.map((i) => <button key={i} type="button" className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-300 hover:text-white" onClick={() => setText(i)}>{i}</button>)}</div>
            <button className="btn-primary py-2" disabled={disabled || busy || text.trim().length < 3}>{busy && <Spinner />}Pedir sugestão</button>
          </form>
          <p className="text-[11px] text-slate-400">O Claude só troca textos e nunca inventa preço, número, horário ou contato. Nada muda até você aplicar e salvar.</p>
          {err && <Alert>{err}</Alert>}
          {prop && (
            <div className="space-y-2" aria-live="polite">
              {prop.summary && <p className="text-sm text-slate-200">{prop.summary}</p>}
              {prop.changes.length === 0 && <p className="text-xs text-slate-400">Nenhuma troca de texto proposta.</p>}
              <ul className="space-y-2">
                {prop.changes.map((c) => (
                  <li key={c.path} className="rounded-lg border border-white/10 p-2 text-xs">
                    <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={!!pick[c.path]} onChange={(e) => setPick({ ...pick, [c.path]: e.target.checked })} /><span className="font-medium text-slate-200">{c.label}</span></label>
                    <p className="mt-1 text-slate-500 line-through">{c.before}</p>
                    <p className="mt-0.5 text-emerald-200">{c.after}</p>
                  </li>
                ))}
              </ul>
              {prop.skipped.length > 0 && <p className="text-[11px] text-amber-200/80">{prop.skipped.length} sugestão(ões) descartada(s): {prop.skipped.map((s) => s.reason).filter((v, i, a) => a.indexOf(v) === i).join(" ")}</p>}
              {prop.changes.length > 0 && <button className="btn-primary py-2" onClick={apply} disabled={busy || !Object.values(pick).some(Boolean)}>Aplicar selecionadas</button>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
