"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Spinner, toast } from "@/components/ui";
import { DemoBadge, FACT_CLASS, FactBadge, ScoreMeter, STATUS_LABEL } from "./FactBadge";
import { LeadImages } from "./LeadImages";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { FACT_LABELS, type FactField } from "@/lib/leads/types";
import type { LeadView } from "./types";
import { designDirectionFor } from "@/lib/site/direction";

type Draft = { id: string; language: string; subject: string; body: string; ai: boolean; factsUsed: { field: string; value: string; source: string }[]; createdAt: string };
const LANG_LABEL: Record<string, string> = { "pt-BR": "Português", en: "English", es: "Español" };
const EDITABLE: FactField[] = ["name", "category", "address", "phone", "whatsapp", "email", "website"];

const SKIP_LABEL: Record<string, string> = {
  no_website: "Sem site informado: nada a verificar.",
  social_only: "A fonte informa só um perfil social; perfis não são analisados.",
  robots_disallowed: "O robots.txt do site não permite a verificação automática; nada foi lido.",
  demo: "Lead de demonstração: nenhum site real foi acessado.",
  invalid_url: "Endereço de site inválido.",
  blocked_address: "Endereço bloqueado por segurança (rede privada/interna).",
};

export function LeadProfile({ initialLead, segments, guessedSegment, initialDrafts, ai, premium, senderName, imageQuery, waText, previewUrl }: { waText: string; previewUrl: string | null; initialLead: LeadView; segments: { key: string; label: string }[]; guessedSegment: string; initialDrafts: Draft[]; ai: boolean; premium: boolean; senderName: string; imageQuery: string }) {
  const [lead, setLead] = useState(initialLead);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState(guessedSegment);
  const [siteLang, setSiteLang] = useState(lead.language);
  const [instructions, setInstructions] = useState("");
  const [reviewedOk, setReviewedOk] = useState(!!lead.reviewedAt);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [sender, setSender] = useState(senderName.split(" ")[0] ?? senderName);
  const hasFacts = Object.keys(lead.facts).length > 0;

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function startEdit() {
    setForm(Object.fromEntries(EDITABLE.map((k) => [k, (lead as unknown as Record<string, string | null>)[k] ?? ""])));
    setEditing(true);
  }

  async function saveEdit() {
    const fields = Object.fromEntries(EDITABLE.map((k) => [k, form[k]?.trim() ? form[k]!.trim() : k === "name" ? lead.name : null]));
    const r = await run("save", () => api<{ lead: LeadView }>(`/api/leads/${lead.id}`, { method: "PATCH", body: { fields } }));
    if (r) {
      setLead(r.lead);
      setEditing(false);
      toast("Correções salvas como “revisado por você”");
    }
  }

  async function patch(body: Record<string, unknown>, msg: string) {
    const r = await run("patch", () => api<{ lead: LeadView }>(`/api/leads/${lead.id}`, { method: "PATCH", body }));
    if (r) {
      setLead(r.lead);
      toast(msg);
    }
  }

  async function reanalyze() {
    const r = await run("reanalyze", () => api<{ lead: LeadView }>(`/api/leads/${lead.id}/reanalyze`, { method: "POST" }));
    if (r) {
      setLead(r.lead);
      toast("Presença digital verificada novamente");
    }
  }

  async function generateSite() {
    if (!lead.reviewedAt) await patch({ reviewed: true }, "Dados marcados como revisados");
    const r = await run("site", () => api<{ project: { id: string } }>("/api/projects", { body: { companyId: lead.id, segment, language: siteLang, instructions: instructions || undefined } }));
    if (r) location.href = `/app/sites/${r.project.id}`;
  }

  async function genOutreach() {
    const langs = [...new Set(["pt-BR", lead.language])];
    const r = await run("outreach", () => api<{ drafts: Draft[] }>(`/api/leads/${lead.id}/outreach`, { body: { languages: langs, senderName: sender } }));
    if (r) {
      setDrafts((d) => [...r.drafts.map((x) => ({ ...x, createdAt: String(x.createdAt) })), ...d]);
      toast("Rascunhos criados. Revise antes de usar.");
    }
  }

  async function saveDraft(d: Draft) {
    await run("draft", () => api(`/api/outreach/${d.id}`, { method: "PATCH", body: { subject: d.subject, body: d.body } }));
    toast("Rascunho salvo");
  }
  async function discard(d: Draft) {
    if (!confirm("Descartar este rascunho?")) return;
    await run("draft", () => api(`/api/outreach/${d.id}`, { method: "DELETE" }));
    setDrafts((x) => x.filter((y) => y.id !== d.id));
  }
  async function copy(d: Draft) {
    await navigator.clipboard.writeText(`${d.subject}\n\n${d.body}`);
    toast("Copiado. Envie você mesmo pelo seu e-mail ou canal preferido.");
  }

  async function removeForever() {
    if (!confirm(`Excluir definitivamente ${lead.name} e seus rascunhos?`)) return;
    await run("delete", () => api(`/api/leads/${lead.id}`, { method: "DELETE" }));
    location.href = "/app/leads";
  }

  const p = lead.presence;

  return (
    <div className="space-y-6">
      <Link href="/app/leads" className="text-sm text-slate-400 hover:text-white">← Estúdio de leads</Link>

      <header className="card relative overflow-hidden p-6 animate-fade-up">
        {lead.isDemo && <div className="demo-stripe absolute inset-x-0 top-0 h-1.5" />}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{lead.name}</h1>
              {lead.isDemo && <DemoBadge />}
              {lead.excluded && <span className="badge bg-red-500/15 text-red-300">Excluído da lista</span>}
              {lead.reviewedAt && <span className="badge bg-violet-500/15 text-violet-300">Revisado</span>}
            </div>
            <p className="mt-1 text-sm text-slate-400">{lead.category ?? "Categoria não informada"} · coletado em {new Date(lead.fetchedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
            <div className="mt-3"><ScoreMeter score={lead.opportunityScore} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary px-3 py-2 text-sm" onClick={reanalyze} disabled={!!busy}>{busy === "reanalyze" ? <Spinner /> : null} Verificar presença de novo</button>
            {lead.excluded ? (
              <button className="btn-secondary px-3 py-2 text-sm" onClick={() => patch({ excluded: false }, "Lead restaurado")}>Restaurar</button>
            ) : (
              <button className="btn-ghost px-3 py-2 text-sm" onClick={() => patch({ excluded: true }, "Lead excluído da lista")}>Excluir da lista</button>
            )}
            <button className="btn-ghost px-3 py-2 text-sm text-red-300" onClick={removeForever}>Apagar</button>
          </div>
        </div>
        {lead.isDemo && <p className="mt-4 text-sm text-amber-200/90">Este lead é <b>fictício</b> (modo demonstração). Use-o para conhecer o fluxo; não entre em contato com base nele.</p>}
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          {/* ---------- Fatos ---------- */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Dados encontrados</h2>
                <p className="text-xs text-slate-500">Cada campo mostra a fonte, a confiança e se é confirmado, inferido ou não encontrado.</p>
              </div>
              {!editing ? <button className="btn-secondary px-3 py-2 text-sm" onClick={startEdit}>Corrigir dados</button> : null}
            </div>
            {editing ? (
              <div className="mt-5 space-y-3">
                {EDITABLE.map((k) => (
                  <label key={k} className="block">
                    <span className="label">{FACT_LABELS[k]}</span>
                    <input className="input" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} type={k === "email" ? "email" : k === "website" ? "url" : "text"} placeholder={k === "website" ? "https://…" : "Deixe vazio se não confirmado"} maxLength={k === "address" ? 400 : 200} />
                  </label>
                ))}
                <p className="text-xs text-slate-500">Valores corrigidos ficam marcados como “revisado por você” e o valor anterior é guardado na nota do campo.</p>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={saveEdit} disabled={busy === "save"}>{busy === "save" ? <Spinner /> : null} Salvar correções</button>
                  <button className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <dl className="mt-5 divide-y divide-white/5">
                {(["name", "category", "address", "phone", "whatsapp", "email", "website", "socials", "hours"] as FactField[]).map((k) => {
                  const f = lead.facts[k];
                  const value = k === "socials" ? null : k === "hours" ? (lead.hours?.length ? lead.hours.map((h) => `${h.label}: ${h.value}`).join("\n") : null) : ((lead as unknown as Record<string, string | null>)[k] ?? null);
                  return (
                    <div key={k} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr_auto] sm:items-start sm:gap-4">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">{FACT_LABELS[k]}</dt>
                      <dd className="min-w-0 text-sm text-slate-200">
                        {k === "socials" ? (
                          lead.socials.length ? (
                            <ul className="space-y-1">{lead.socials.map((s) => <li key={s.url} className="truncate"><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">{s.network}</a> <span className="text-xs text-slate-500">· {s.source}</span></li>)}</ul>
                          ) : <span className="text-slate-500">—</span>
                        ) : k === "hours" && value ? (
                          <span className="whitespace-pre-line">{value}</span>
                        ) : k === "website" && value ? (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-brand-300 hover:underline">{value}</a>
                        ) : (
                          value ?? <span className="text-slate-500">—</span>
                        )}
                        {f && (
                          <p className="mt-1 text-xs text-slate-500">
                            {f.sourceUrl ? <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 hover:underline">{f.source}</a> : f.source}
                            {f.status !== "not_found" && f.confidence ? ` · confiança ${Math.round(f.confidence * 100)}%` : ""} · {new Date(f.collectedAt).toLocaleDateString("pt-BR")}
                            {f.note ? <span className="block text-slate-400">{f.note}</span> : null}
                          </p>
                        )}
                      </dd>
                      <div>{hasFacts ? <FactBadge fact={f} /> : <span className="badge bg-slate-500/10 text-slate-400">Fonte original</span>}</div>
                    </div>
                  );
                })}
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              {(["confirmed", "inferred", "not_found", "user"] as const).map((s) => <span key={s} className={FACT_CLASS[s]}>{STATUS_LABEL[s]}</span>)}
            </div>
          </section>

          {/* ---------- Oportunidades + presença ---------- */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-white">Oportunidades</h2>
            {lead.opportunities.length ? (
              <ul className="mt-4 space-y-3">
                {lead.opportunities.map((o) => (
                  <li key={o.code} className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${o.severity === "high" ? "bg-[var(--color-signal)]" : o.severity === "medium" ? "bg-amber-400" : "bg-slate-500"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{o.label} <span className={o.basis === "confirmed" ? "fact-confirmed ml-1" : "fact-inferred ml-1"}>{o.basis === "confirmed" ? "observado" : "inferência"}</span></p>
                      <p className="text-sm text-slate-400">{o.detail}</p>
                      {o.evidence && o.evidence !== "demo" && <p className="mt-0.5 truncate text-xs text-slate-500">Evidência: {o.evidence}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-slate-400">Nenhuma oportunidade detectada nas fontes consultadas.</p>}

            <h3 className="mt-6 text-sm font-semibold text-white">Verificação do site</h3>
            {!p ? <p className="mt-2 text-sm text-slate-500">Ainda não verificado. Use “Verificar presença de novo”.</p> : p.skipped ? (
              <p className="mt-2 text-sm text-slate-400">{SKIP_LABEL[p.skipped] ?? p.skipped} <span className="text-xs text-slate-500">({new Date(p.checkedAt).toLocaleString("pt-BR")})</span></p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {[
                  ["Respondeu", p.reachable ? `Sim (HTTP ${p.status})` : `Não${p.error ? ` · ${p.error}` : p.status ? ` · HTTP ${p.status}` : ""}`],
                  ["HTTPS", p.https === undefined ? "—" : p.https ? "Sim" : "Não"],
                  ["Adaptado ao celular", p.hasViewport === undefined ? "—" : p.hasViewport ? "Sim (viewport)" : "Não declarado"],
                  ["Ano no rodapé", p.copyrightYear ? `© ${p.copyrightYear}` : "—"],
                  ["Tempo de resposta", p.responseMs ? `${p.responseMs} ms` : "—"],
                  ["Título", p.title ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white/[0.03] p-3"><dt className="text-[11px] uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-1 truncate text-slate-200" title={String(v)}>{v}</dd></div>
                ))}
              </dl>
            )}
            {p && <p className="mt-3 text-xs text-slate-500">Somente a página inicial pública foi lida, após conferir o robots.txt. Verificado em {new Date(p.checkedAt).toLocaleString("pt-BR")}.</p>}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-white">Anotações</h2>
            <textarea className="input mt-3 min-h-24 text-sm" maxLength={2000} defaultValue={lead.notes ?? ""} placeholder="Ex.: confirmei por telefone que não têm site; falar com a gerente." onBlur={(e) => e.target.value !== (lead.notes ?? "") && patch({ notes: e.target.value }, "Anotação salva")} />
          </section>
        </div>

        <div className="space-y-6">
          {/* ---------- Prévia do site ---------- */}
          <section className="card relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-600/20 blur-3xl" />
            <h2 className="relative font-semibold text-white">Prévia de site</h2>
            {lead.projects.length > 0 && (
              <div className="relative mt-3 space-y-2">
                {lead.projects.map((pr) => (
                  <Link key={pr.id} href={`/app/sites/${pr.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white hover:border-brand-500/40">
                    {pr.name} <span className="text-xs text-amber-300">prévia não publicada · editar →</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="relative mt-4 space-y-3">
              <label className="block"><span className="label">Modelo</span>
                <select className="input" value={segment} onChange={(e) => setSegment(e.target.value)}>{segments.map((s) => <option key={s.key} value={s.key}>{s.label}{s.key === guessedSegment ? " (sugerido)" : ""}</option>)}</select>
              </label>
              {(() => {
                const d = designDirectionFor(segment, `${lead.name} ${lead.category ?? ""}`);
                return (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm" data-direction>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Direção visual para este ramo</p>
                    <p className="font-display mt-1 text-base font-semibold text-white">{d.name}</p>
                    <p className="mt-1 text-xs text-slate-400"><b className="text-slate-300">Público:</b> {d.audience}.</p>
                    <p className="mt-1 text-xs text-slate-400"><b className="text-slate-300">Por que combina:</b> {d.why}</p>
                    <p className="mt-1 text-xs text-slate-400"><b className="text-slate-300">Composição:</b> {d.composition}. <b className="text-slate-300">Movimento:</b> {d.motion}.</p>
                    {d.refs.length > 0 ? (
                      <details className="mt-2 text-xs text-slate-400">
                        <summary className="cursor-pointer text-brand-300 hover:text-brand-200">Referências pesquisadas ({d.refs.length})</summary>
                        <ul className="mt-1.5 space-y-1.5">{d.refs.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-slate-200 underline decoration-white/20 hover:decoration-brand-400">{r.title}</a><span className="block text-slate-500">{r.takeaway}</span></li>)}</ul>
                        <p className="mt-1.5 text-slate-600">Inspiração, não cópia. Alguns links são de agências e vendedores de template.</p>
                      </details>
                    ) : <p className="mt-2 text-xs text-slate-600">Ramo sem pesquisa própria ainda: direção conservadora.</p>}
                  </div>
                );
              })()}
              <label className="block"><span className="label">Idioma do site</span>
                <select className="input" value={siteLang} onChange={(e) => setSiteLang(e.target.value)}>{Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              {siteLang !== "pt-BR" && !ai && <p className="text-xs text-amber-300">Sem IA configurada, os textos-modelo saem em português; edite-os na prévia.</p>}
              <label className="block"><span className="label">Preferências de estilo (opcional)</span>
                <textarea className="input min-h-16 text-sm" maxLength={800} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex.: tom acolhedor, visual minimalista. Não informe fatos não confirmados." />
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-300">
                <input type="checkbox" className="mt-1 accent-[var(--color-signal)]" checked={reviewedOk} onChange={(e) => setReviewedOk(e.target.checked)} />
                Revisei os dados ao lado. Somente fatos confirmados ou revisados serão usados no site.
              </label>
              <button className="btn-primary w-full" disabled={!reviewedOk || busy === "site" || lead.excluded} onClick={generateSite}>
                {busy === "site" ? <><Spinner /> Gerando prévia…</> : lead.projects.length ? "Gerar nova prévia" : "Gerar prévia do site"}
              </button>
              <p className="text-xs text-slate-500">{premium ? "Usa 1 geração da cota mensal." : "Requer plano Premium."} {ai ? "Textos com IA" : "Textos-modelo (IA não configurada)"}; sem depoimentos, avaliações, preços ou horários inventados.</p>
            </div>
          </section>

          {/* ---------- Imagens ---------- */}
          <LeadImages leadId={lead.id} initial={lead.images} defaultQuery={imageQuery} isDemo={lead.isDemo} />

          {/* ---------- WhatsApp ---------- */}
          <WhatsAppPanel key={lead.whatsapp ?? "none"} whatsapp={lead.whatsapp} fact={lead.facts.whatsapp} initialText={waText} previewUrl={previewUrl} hasPreview={lead.projects.length > 0} isDemo={lead.isDemo} busy={busy === "patch"} onPatch={patch} />

          {/* ---------- Abordagem ---------- */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-white">Abordagem comercial</h2>
              <span className="badge bg-white/5 text-slate-400">nunca enviada automaticamente</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Rascunho em português{lead.language !== "pt-BR" ? ` e em ${LANG_LABEL[lead.language]}` : ""}, citando só fatos públicos verificados e uma observação sobre a presença digital.</p>
            <div className="mt-4 flex gap-2">
              <input className="input" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={80} aria-label="Seu nome (assinatura)" placeholder="Seu nome" />
              <button className="btn-primary shrink-0" onClick={genOutreach} disabled={busy === "outreach" || !sender.trim()}>{busy === "outreach" ? <Spinner /> : null} Gerar rascunho</button>
            </div>
            {lead.isDemo && <p className="mt-2 text-xs text-amber-300">Lead fictício: o rascunho serve apenas como exemplo.</p>}
            <div className="mt-4 space-y-4">
              {drafts.map((d) => (
                <article key={d.id} className="rounded-xl border border-white/10 bg-ink-900/60 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="badge bg-brand-500/15 text-brand-300">{LANG_LABEL[d.language] ?? d.language}</span>
                    <span className="badge bg-white/5 text-slate-400">{d.ai ? "IA" : "Modelo"}</span>
                    <span className="text-slate-500">{new Date(d.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <input className="input mt-3 font-medium" value={d.subject} maxLength={200} aria-label="Assunto" onChange={(e) => setDrafts((x) => x.map((y) => (y.id === d.id ? { ...y, subject: e.target.value } : y)))} />
                  <textarea className="input mt-2 min-h-48 text-sm leading-relaxed" value={d.body} maxLength={4000} aria-label="Mensagem" onChange={(e) => setDrafts((x) => x.map((y) => (y.id === d.id ? { ...y, body: e.target.value } : y)))} />
                  {d.factsUsed.length > 0 && <p className="mt-2 text-xs text-slate-500">Fatos citados: {d.factsUsed.map((f) => `${f.value} (${f.source})`).join(" · ")}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-secondary px-3 py-2 text-xs" onClick={() => copy(d)}>Copiar</button>
                    <button className="btn-ghost px-3 py-2 text-xs" onClick={() => saveDraft(d)}>Salvar edição</button>
                    <a className="btn-ghost px-3 py-2 text-xs" href={`/api/outreach/${d.id}/export?format=txt`}>Exportar .txt</a>
                    <a className="btn-ghost px-3 py-2 text-xs" href={`/api/outreach/${d.id}/export?format=md`}>Exportar .md</a>
                    <button className="btn-ghost px-3 py-2 text-xs text-red-300" onClick={() => discard(d)}>Descartar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
