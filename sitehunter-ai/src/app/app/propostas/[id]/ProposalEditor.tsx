"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner, toast } from "@/components/ui";
import { PageHeaderClient } from "@/components/app/PageHeaderClient";
import type { ProposalContent } from "@/lib/proposal";

const toReais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const toCents = (v: string) => Math.max(0, Math.round(parseFloat(v.replace(/\./g, "").replace(",", ".") || "0") * 100));

function Money({ label, cents, onChange, suffix }: { label: string; cents: number; onChange: (c: number) => void; suffix?: string }) {
  const [v, setV] = useState(toReais(cents));
  return (
    <Field label={label}>
      <div className="flex items-center gap-2"><span className="text-sm text-slate-500">R$</span><input className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const c = toCents(v); onChange(c); setV(toReais(c)); }} />{suffix && <span className="shrink-0 text-xs text-slate-500">{suffix}</span>}</div>
    </Field>
  );
}

export function ProposalEditor({ id, title, initial, initialText, projectId }: { id: string; title: string; initial: ProposalContent; initialText: string; projectId: string | null }) {
  const [c, setC] = useState(initial);
  const [text, setText] = useState(initialText);
  const [view, setView] = useState<"edit" | "final">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ text: string }>(`/api/proposals/${id}`, { method: "PATCH", body: { content: c } });
      setText(r.text);
      toast("Proposta salva");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  const list = (arr: string[]) => arr.join("\n");
  const unlist = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  return (
    <>
      <PageHeaderClient
        title={title}
        subtitle="Revise e ajuste os valores. Nada é enviado automaticamente ao cliente."
        actions={
          <>
            {projectId && <Link href={`/app/sites/${projectId}`} className="btn-ghost">Abrir site</Link>}
            <button className="btn-secondary" onClick={() => setView(view === "edit" ? "final" : "edit")}>{view === "edit" ? "Visualizar versão final" : "Voltar a editar"}</button>
            <button className="btn-secondary" onClick={async () => { if (await save()) { navigator.clipboard.writeText(text); toast("Texto copiado"); } }}>Copiar texto</button>
            <button className="btn-secondary" onClick={async () => { if (await save()) location.href = `/api/proposals/${id}/pdf`; }}>Baixar PDF</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving && <Spinner />}Salvar</button>
          </>
        }
      />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {view === "final" ? (
        <div className="card mx-auto max-w-3xl whitespace-pre-wrap p-8 font-[450] leading-relaxed text-slate-200">{text}</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <section className="card space-y-4 p-5">
            <Field label="Empresa"><input className="input" value={c.companyName} onChange={(e) => setC({ ...c, companyName: e.target.value })} /></Field>
            <Field label="Resumo do projeto"><textarea className="input" rows={5} value={c.summary} maxLength={3000} onChange={(e) => setC({ ...c, summary: e.target.value })} /></Field>
            <Field label="Benefícios do site (um por linha)"><textarea className="input" rows={6} defaultValue={list(c.benefits)} onBlur={(e) => setC({ ...c, benefits: unlist(e.target.value).slice(0, 15) })} /></Field>
            <Field label="Funcionalidades incluídas (uma por linha)"><textarea className="input" rows={7} defaultValue={list(c.features)} onBlur={(e) => setC({ ...c, features: unlist(e.target.value).slice(0, 20) })} /></Field>
            <Field label="Condições adicionais"><textarea className="input" rows={4} value={c.extraTerms} maxLength={2000} onChange={(e) => setC({ ...c, extraTerms: e.target.value })} /></Field>
            <Field label="Encerramento"><textarea className="input" rows={3} value={c.closing} maxLength={1500} onChange={(e) => setC({ ...c, closing: e.target.value })} /></Field>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold text-white">Valores e condições</h2>
            <Money label="Preço do desenvolvimento" cents={c.developmentPriceCents} onChange={(developmentPriceCents) => setC({ ...c, developmentPriceCents })} />
            <Field label="Prazo estimado (dias)"><input type="number" min={1} className="input" value={c.deliveryDays} onChange={(e) => setC({ ...c, deliveryDays: Math.max(1, +e.target.value || 1) })} /></Field>
            <Field label="Condições de pagamento"><textarea className="input" rows={2} value={c.paymentTerms} maxLength={1000} onChange={(e) => setC({ ...c, paymentTerms: e.target.value })} /></Field>
            <Money label="Domínio (estimativa anual)" suffix="/ano" cents={c.domainYearlyCents} onChange={(domainYearlyCents) => setC({ ...c, domainYearlyCents })} />
            <Money label="Hospedagem (0 = incluída)" suffix="/mês" cents={c.hostingMonthlyCents} onChange={(hostingMonthlyCents) => setC({ ...c, hostingMonthlyCents })} />
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-brand-500" checked={c.includeMaintenance} onChange={(e) => setC({ ...c, includeMaintenance: e.target.checked })} /> Oferecer manutenção mensal</label>
            {c.includeMaintenance && <Money label="Manutenção mensal" suffix="/mês" cents={c.maintenanceMonthlyCents} onChange={(maintenanceMonthlyCents) => setC({ ...c, maintenanceMonthlyCents })} />}
            <Field label="Validade (dias)"><input type="number" min={1} className="input" value={c.validityDays} onChange={(e) => setC({ ...c, validityDays: Math.max(1, +e.target.value || 1) })} /></Field>
            <Field label="Seu nome"><input className="input" value={c.senderName} onChange={(e) => setC({ ...c, senderName: e.target.value })} /></Field>
            <Field label="Seu contato"><input className="input" value={c.senderContact} onChange={(e) => setC({ ...c, senderContact: e.target.value })} /></Field>
            <p className="text-xs text-slate-500">Os valores padrão podem ser alterados em “Minha conta → Preços padrão das propostas”.</p>
          </section>
        </div>
      )}
    </>
  );
}
