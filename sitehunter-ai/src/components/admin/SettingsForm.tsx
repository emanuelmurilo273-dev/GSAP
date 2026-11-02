"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, toast } from "@/components/ui";

type S = { priceCents: number; checkoutUrl: string | null; maxSearchesPerMonth: number; maxGenerationsPerMonth: number; maxPublishedSites: number; graceDays: number; retentionDays: number; usageWarnPercent: number };

export function SettingsForm({ initial, envCheckout, webhookUrl }: { initial: S; envCheckout: string | null; webhookUrl: string }) {
  const [s, setS] = useState(initial);
  const [price, setPrice] = useState((initial.priceCents / 100).toFixed(2).replace(".", ","));
  const [err, setErr] = useState<string | null>(null);
  const num = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Math.max(0, parseInt(e.target.value || "0", 10)) });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const priceCents = Math.round(parseFloat(price.replace(/\./g, "").replace(",", ".")) * 100);
      await api("/api/admin/settings", { method: "PUT", body: { ...s, priceCents, checkoutUrl: s.checkoutUrl || null } });
      toast("Configurações salvas");
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  return (
    <form onSubmit={save} className="grid gap-5 lg:grid-cols-2">
      {err && <div className="lg:col-span-2"><Alert>{err}</Alert></div>}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold text-white">Plano e pagamento</h2>
        <Field label="Preço exibido da assinatura (R$/mês)" hint="O valor cobrado é o configurado no produto da Kiwify — mantenha os dois iguais."><input className="input" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="URL do checkout Kiwify" hint={envCheckout ? `Se vazio, usa KIWIFY_CHECKOUT_URL: ${envCheckout}` : "Link de pagamento do produto de assinatura na Kiwify (https://pay.kiwify.com.br/...)."}><input className="input" value={s.checkoutUrl ?? ""} onChange={(e) => setS({ ...s, checkoutUrl: e.target.value })} placeholder="https://pay.kiwify.com.br/..." /></Field>
        <Field label="URL do webhook (cadastre na Kiwify)"><input className="input" readOnly value={webhookUrl} /></Field>
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold text-white">Limites por assinante</h2>
        <Field label="Pesquisas de empresas por mês"><input type="number" className="input" value={s.maxSearchesPerMonth} onChange={num("maxSearchesPerMonth")} /></Field>
        <Field label="Gerações de sites por mês"><input type="number" className="input" value={s.maxGenerationsPerMonth} onChange={num("maxGenerationsPerMonth")} /></Field>
        <Field label="Sites publicados simultaneamente"><input type="number" className="input" value={s.maxPublishedSites} onChange={num("maxPublishedSites")} /></Field>
        <Field label="Aviso de uso a partir de (%)"><input type="number" className="input" value={s.usageWarnPercent} onChange={num("usageWarnPercent")} /></Field>
      </section>
      <section className="card space-y-4 p-5 lg:col-span-2">
        <h2 className="font-semibold text-white">Suspensão e retenção</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carência após o vencimento (dias)" hint="Dias extras com acesso quando a renovação atrasa (0 = suspende no vencimento)."><input type="number" className="input" value={s.graceDays} onChange={num("graceDays")} /></Field>
          <Field label="Preservação dos projetos após a suspensão (dias)" hint="Depois desse prazo os projetos são excluídos. Informado ao usuário nos Termos e por e-mail."><input type="number" className="input" value={s.retentionDays} onChange={num("retentionDays")} /></Field>
        </div>
      </section>
      <div className="lg:col-span-2"><button className="btn-primary">Salvar configurações</button></div>
    </form>
  );
}
