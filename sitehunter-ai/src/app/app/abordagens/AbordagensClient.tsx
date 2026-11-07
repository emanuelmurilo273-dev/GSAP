"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/api";
import { toast } from "@/components/ui";
import { formatBrPhone, validBrPhone, waMeLink } from "@/lib/whatsapp";

export type WaItem = {
  id: string; name: string; city: string | null; category: string | null; isDemo: boolean;
  whatsapp: string | null; phone: string | null; email: string | null; instagram: string | null; waSource: string; waSourceUrl: string | null; waWarning: string | null;
  stage: "new" | "review" | "published" | "contacted";
  suggested: string; saved: string | null; basis: "problem" | "opportunity"; needsEdit: boolean; observation: string | null;
  hasPreview: boolean; previewUrl: string | null; projectId: string | null;
};

const pretty = (n: string) => { const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${n}`; };

export function AbordagensClient({ items }: { items: WaItem[] }) {
  const [filter, setFilter] = useState<"todos" | "pendentes" | "contatados">("pendentes");
  const [q, setQ] = useState("");
  const [state, setState] = useState(() => Object.fromEntries(items.map((i) => [i.id, { text: i.saved ?? i.suggested, contacted: i.stage === "contacted" }])));
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  useEffect(() => { const h = location.hash.replace("#lead-", ""); if (h && items.some((i) => i.id === h)) { setOpen(h); setFilter("todos"); setTimeout(() => document.getElementById(`lead-${h}`)?.scrollIntoView({ block: "start" }), 60); } }, [items]);
  const shown = useMemo(() => items.filter((i) => (filter === "todos" || (filter === "contatados") === state[i.id]!.contacted) && `${i.name} ${i.city ?? ""} ${i.category ?? ""}`.toLowerCase().includes(q.toLowerCase())), [items, filter, q, state]);

  async function save(id: string, text: string | null) {
    await api(`/api/leads/${id}`, { method: "PATCH", body: { waMessage: text } }).catch((e) => toast((e as Error).message));
  }
  async function mark(id: string, contacted: boolean) {
    await api(`/api/leads/${id}`, { method: "PATCH", body: { contacted } });
    setState((s) => ({ ...s, [id]: { ...s[id]!, contacted } }));
    toast(contacted ? "Marcado como contatado" : "Marcação removida");
  }

  if (!items.length) {
    return <div className="card p-10 text-center"><p className="text-lg font-semibold text-white">Nenhuma abordagem ainda</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-400">As abordagens aparecem para cada lead com algum canal publicado (WhatsApp confirmado, telefone, e-mail ou Instagram). Comece em <Link href="/app/buscar" className="text-brand-300 underline">Buscar empresas</Link>.</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filtro" className="flex flex-wrap gap-2">
          {(["pendentes", "contatados", "todos"] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === f ? "bg-[var(--color-signal)] text-ink-950" : "border border-white/10 text-slate-300"}`}>
              {f === "pendentes" ? "Para enviar" : f === "contatados" ? "Contatados" : "Todas"} <span className="opacity-70">{items.filter((i) => f === "todos" || (f === "contatados") === state[i.id]!.contacted).length}</span>
            </button>
          ))}
        </div>
        <input className="input w-full py-2 sm:w-56" placeholder="Buscar empresa…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar empresa" />
      </div>

      <ul className="space-y-3">
        {shown.map((i) => {
          const st = state[i.id]!;
          const isOpen = open === i.id;
          const link = i.whatsapp ? waMeLink(i.whatsapp, st.text.trim()) : null;
          const channel = i.whatsapp ? (i.isDemo ? "WhatsApp fictício (demo)" : `WhatsApp ${pretty(i.whatsapp)}`) : [i.phone && `Telefone ${formatBrPhone(i.phone)}`, i.email && "E-mail", i.instagram && "Instagram"].filter(Boolean).join(" · ");
          return (
            <li key={i.id} id={`lead-${i.id}`} className="card scroll-mt-24 overflow-hidden">
              <button className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : i.id)} aria-expanded={isOpen}>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{i.name} {st.contacted && <span className="badge ml-1 bg-violet-500/15 text-violet-200">Contatado</span>}</p>
                  <p className="text-xs text-slate-500">{[i.category, i.city].filter(Boolean).join(" · ")} · <span className={i.whatsapp ? "text-emerald-300" : "text-slate-400"}>{channel}</span></p>
                </div>
                <span className={`badge ${i.needsEdit ? "bg-amber-500/15 text-amber-200" : i.basis === "problem" ? "bg-sky-500/15 text-sky-200" : "bg-white/5 text-slate-300"}`}>
                  {i.needsEdit ? "Precisa da sua edição" : i.basis === "problem" ? "Começa por um problema observado" : "Começa por uma oportunidade"}
                </span>
              </button>
              {isOpen && (
                <div className="grid gap-4 border-t border-white/5 p-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    {i.whatsapp ? <p className="text-xs text-slate-500">WhatsApp confirmado · fonte: {i.waSourceUrl ? <a href={i.waSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{i.waSource}</a> : i.waSource}</p>
                      : <p className="text-xs text-slate-500">Sem WhatsApp confirmado em fonte pública. Use um dos canais publicados abaixo.</p>}
                    {i.waWarning && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-100">{i.waWarning}</p>}
                    {i.observation && <p className="rounded-lg bg-white/[0.03] p-2 text-xs text-slate-400"><b className="text-slate-300">Fato usado:</b> {i.observation}</p>}
                    <label className="block">
                      <span className="label">Mensagem (editável)</span>
                      <textarea className="input min-h-56 text-sm" maxLength={1500} value={st.text}
                        onChange={(e) => setState((s) => ({ ...s, [i.id]: { ...s[i.id]!, text: e.target.value } }))}
                        onBlur={(e) => save(i.id, e.target.value === i.suggested ? null : e.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button className="btn-ghost px-2 py-1" onClick={() => { setState((s) => ({ ...s, [i.id]: { ...s[i.id]!, text: i.suggested } })); save(i.id, null); }}>Restaurar texto sugerido</button>
                      {!i.hasPreview ? <Link href={`/app/leads/${i.id}#previa`} className="btn-ghost px-2 py-1">Criar prévia</Link> : !i.previewUrl ? <span className="px-2 py-1 text-slate-500">A prévia é privada: a mensagem oferece enviar o link. <Link href="/app/sites" className="underline">Liberar link</Link></span> : null}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="label">Prévia da mensagem</p>
                    <div className="rounded-2xl bg-[#0b141a] p-4">
                      <div className="ml-auto max-w-[94%] whitespace-pre-wrap break-words rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[13px] leading-relaxed text-[#e9edef]">{st.text.trim() || <span className="opacity-60">(mensagem vazia)</span>}</div>
                    </div>
                    {i.isDemo ? (
                      <button className="btn-primary w-full" disabled>Lead fictício: contato desativado</button>
                    ) : i.needsEdit && st.text.includes("[Escreva aqui") ? (
                      <button className="btn-primary w-full" disabled>Edite a mensagem antes de abrir</button>
                    ) : (
                      <div className="grid gap-2">
                        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="btn-primary w-full justify-center" style={{ background: "#1fa855" }}>Abrir no WhatsApp para revisar e enviar</a>}
                        {!link && i.phone && <a href={`tel:${validBrPhone(i.phone) ? `+${validBrPhone(i.phone)}` : i.phone.replace(/[^\d+]/g, "")}`} className="btn-primary w-full justify-center">Ligar para {formatBrPhone(i.phone)}</a>}
                        {i.email && <a href={`mailto:${i.email}?subject=${encodeURIComponent(`Ideia para o site da ${i.name}`)}&body=${encodeURIComponent(st.text.trim())}`} className={`${link || i.phone ? "btn-secondary" : "btn-primary"} w-full justify-center`}>Abrir e-mail com o texto (você envia)</a>}
                        {i.instagram && <a href={i.instagram} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center" onClick={() => navigator.clipboard.writeText(st.text).then(() => toast("Texto copiado: cole na mensagem direta do Instagram"))}>Copiar texto e abrir o Instagram</a>}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500">Os botões só abrem o canal com o texto pronto (ou copiado). Nada é enviado automaticamente.</p>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary px-3 py-2 text-xs" onClick={() => navigator.clipboard.writeText(st.text).then(() => toast("Texto copiado"))}>Copiar texto</button>
                      <button className="btn-secondary px-3 py-2 text-xs" onClick={() => mark(i.id, !st.contacted)}>{st.contacted ? "Desmarcar contatado" : "Marcar como enviada"}</button>
                      {i.projectId && <Link href={`/app/sites/${i.projectId}/revisar`} className="btn-ghost px-3 py-2 text-xs">Ver prévia</Link>}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
