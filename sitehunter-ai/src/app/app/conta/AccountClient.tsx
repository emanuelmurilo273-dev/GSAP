"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, toast } from "@/components/ui";
import type { ProposalDefaults } from "@/lib/proposal";

const r = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const c = (v: string) => Math.max(0, Math.round(parseFloat(v.replace(/\./g, "").replace(",", ".") || "0") * 100));

export function AccountClient({ name, email, verified, isAdmin, defaults }: { name: string; email: string; verified: boolean; isAdmin: boolean; defaults: ProposalDefaults }) {
  const [err, setErr] = useState<string | null>(null);
  const [d, setD] = useState(defaults);
  const wrap = (fn: () => Promise<void>) => async () => { setErr(null); try { await fn(); } catch (e) { setErr((e as Error).message); } };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {err && <div className="lg:col-span-2"><Alert>{err}</Alert></div>}
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void wrap(async () => { await api("/api/account", { method: "PATCH", body: { name: f.get("name") } }); toast("Dados atualizados"); })(); }}>
        <h2 className="font-semibold text-white">Perfil</h2>
        <Field label="Nome"><input name="name" defaultValue={name} className="input" minLength={2} maxLength={80} /></Field>
        <Field label="E-mail"><input value={email} disabled className="input opacity-60" /></Field>
        <p className="text-xs text-slate-500">{verified ? "✓ E-mail confirmado" : <>E-mail não confirmado. <button type="button" className="text-brand-300" onClick={wrap(async () => { await api("/api/auth/resend", { method: "POST" }); toast("Link reenviado"); })}>Reenviar link</button></>}</p>
        <button className="btn-primary">Salvar</button>
      </form>

      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; void wrap(async () => { await api("/api/account", { method: "PATCH", body: { currentPassword: f.get("current"), newPassword: f.get("new") } }); form.reset(); toast("Senha alterada"); })(); }}>
        <h2 className="font-semibold text-white">Alterar senha</h2>
        <Field label="Senha atual"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
        <Field label="Nova senha"><input name="new" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
        <button className="btn-primary">Alterar senha</button>
      </form>

      <form className="card space-y-4 p-5 lg:col-span-2" onSubmit={(e) => { e.preventDefault(); void wrap(async () => { await api("/api/proposals/defaults", { method: "PUT", body: d }); toast("Preços padrão salvos"); })(); }}>
        <h2 className="font-semibold text-white">Preços padrão das propostas</h2>
        <p className="text-xs text-slate-500">Valores sugeridos por você — usados como ponto de partida em cada nova proposta.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Desenvolvimento (R$)"><input className="input" defaultValue={r(d.developmentPriceCents)} onBlur={(e) => setD({ ...d, developmentPriceCents: c(e.target.value) })} /></Field>
          <Field label="Manutenção mensal (R$)"><input className="input" defaultValue={r(d.maintenanceMonthlyCents)} onBlur={(e) => setD({ ...d, maintenanceMonthlyCents: c(e.target.value) })} /></Field>
          <Field label="Domínio anual (R$)"><input className="input" defaultValue={r(d.domainYearlyCents)} onBlur={(e) => setD({ ...d, domainYearlyCents: c(e.target.value) })} /></Field>
          <Field label="Hospedagem mensal (R$)"><input className="input" defaultValue={r(d.hostingMonthlyCents)} onBlur={(e) => setD({ ...d, hostingMonthlyCents: c(e.target.value) })} /></Field>
          <Field label="Prazo (dias)"><input type="number" min={1} className="input" value={d.deliveryDays} onChange={(e) => setD({ ...d, deliveryDays: Math.max(1, +e.target.value || 1) })} /></Field>
          <Field label="Validade (dias)"><input type="number" min={1} className="input" value={d.validityDays} onChange={(e) => setD({ ...d, validityDays: Math.max(1, +e.target.value || 1) })} /></Field>
          <Field label="Seu nome na proposta"><input className="input" value={d.senderName} onChange={(e) => setD({ ...d, senderName: e.target.value })} /></Field>
          <Field label="Seu contato"><input className="input" value={d.senderContact} onChange={(e) => setD({ ...d, senderContact: e.target.value })} /></Field>
        </div>
        <Field label="Condições de pagamento"><input className="input" value={d.paymentTerms} onChange={(e) => setD({ ...d, paymentTerms: e.target.value })} /></Field>
        <button className="btn-primary">Salvar preços padrão</button>
      </form>

      <section className="card space-y-3 p-5 lg:col-span-2">
        <h2 className="font-semibold text-white">Privacidade e dados (LGPD)</h2>
        <p className="text-sm text-slate-400">Você pode baixar uma cópia dos seus dados ou excluir sua conta. A exclusão remove permanentemente projetos, sites publicados, empresas salvas e propostas. Registros de pagamento são mantidos, sem seus dados pessoais, pelo prazo exigido pela legislação fiscal.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/account/export" className="btn-secondary">Baixar meus dados (JSON)</a>
          {!isAdmin && (
            <button className="btn-danger" onClick={wrap(async () => {
              const password = prompt("Para excluir sua conta, digite sua senha:");
              if (!password) return;
              if (prompt('Digite EXCLUIR para confirmar a exclusão definitiva:') !== "EXCLUIR") return;
              await api("/api/account", { method: "DELETE", body: { password, confirm: "EXCLUIR" } });
              location.href = "/";
            })}>Excluir minha conta</button>
          )}
        </div>
      </section>
    </div>
  );
}
