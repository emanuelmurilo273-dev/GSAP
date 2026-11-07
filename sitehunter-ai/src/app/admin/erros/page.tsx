import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { AdminNav } from "@/components/admin/AdminNav";
import { HealthCheck } from "@/components/admin/HealthCheck";
import { providerStatus } from "@/lib/leads/providers";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Step = { at: string; step: string; detail?: string };

export default async function AdminErrors() {
  await pageUser({ admin: true });
  const since = new Date(Date.now() - 14 * 86400e3);
  const [failed, partial, webhooks, logins, recent] = await Promise.all([
    prisma.leadSearch.findMany({ where: { status: "FAILED", startedAt: { gte: since } }, orderBy: { startedAt: "desc" }, take: 15 }),
    prisma.leadSearch.findMany({ where: { startedAt: { gte: since }, isDemo: false, status: { in: ["DONE", "PARTIAL"] } }, orderBy: { startedAt: "desc" }, take: 40, select: { id: true, niche: true, location: true, startedAt: true, log: true } }),
    prisma.webhookEvent.findMany({ where: { OR: [{ error: { not: null } }, { signatureOk: false }], receivedAt: { gte: since } }, orderBy: { receivedAt: "desc" }, take: 10 }),
    prisma.auditLog.count({ where: { action: "login_failed", createdAt: { gte: since } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  // Um aviso por busca (o primeiro registro de falha da fonte), para não repetir o resumo final da mesma busca.
  const degraded = partial.flatMap((s) => {
    const hit = (Array.isArray(s.log) ? (s.log as Step[]) : []).find((x) => /indispon|só Nominatim|tempo esgotado/i.test(x.detail ?? ""));
    return hit ? [{ s, msg: hit.detail! }] : [];
  }).slice(0, 8);
  const providers = providerStatus();
  const checks: { label: string; ok: boolean; hint: string }[] = [
    { label: "Banco de dados", ok: true, hint: "Conectado (esta página leu os dados)." },
    { label: "Busca real: OpenStreetMap", ok: true, hint: "Não precisa de chave. O servidor público oscila: use “Testar fontes agora”." },
    { label: "Busca real: Google Maps", ok: providers.some((p) => p.id === "google_places" && p.configured), hint: "Opcional. Defina GOOGLE_PLACES_API_KEY no servidor." },
    { label: "Link público das prévias (GitHub Pages)", ok: !!env.githubPreviewsToken && !!env.githubPreviewsRepo, hint: "Opcional. Defina GITHUB_PREVIEWS_TOKEN e GITHUB_PREVIEWS_REPO." },
    { label: "E-mail (verificação e recuperação de senha)", ok: !!env.smtp, hint: "Opcional. Defina as variáveis SMTP_*." },
    { label: "Pagamentos (webhook da Kiwify)", ok: env.kiwifyWebhookTokens.length > 0, hint: "Só para vender assinaturas. Defina KIWIFY_WEBHOOK_TOKENS." },
  ];
  return (
    <>
      <PageHeader title="Erros e saúde do sistema" subtitle="O que falhou nos últimos 14 dias, o que está configurado e o que ainda falta." />
      <AdminNav />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Fontes de dados</h2>
          <p className="mb-3 mt-1 text-sm text-slate-400">Teste ao vivo dos servidores usados na busca de empresas.</p>
          <HealthCheck />
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Configuração</h2>
          <ul className="mt-3 divide-y divide-white/5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="text-sm text-slate-200">{c.label}</p>{!c.ok && <p className="mt-0.5 text-xs text-slate-500">{c.hint}</p>}</div>
                <span className={`badge shrink-0 ${c.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-400"}`}>{c.ok ? "ativo" : "não configurado"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Valores secretos ficam só nas variáveis de ambiente do servidor e nunca aparecem aqui.</p>
        </section>
      </div>

      <section className="card mt-5 p-5">
        <h2 className="font-display text-lg font-semibold text-white">Buscas que falharam</h2>
        {failed.length === 0 ? <p className="mt-2 text-sm text-emerald-300">Nenhuma busca falhou nos últimos 14 dias.</p> : (
          <ul className="mt-3 divide-y divide-white/5">
            {failed.map((s) => (
              <li key={s.id} className="py-3"><p className="text-sm font-medium text-white">{s.niche} · {s.location} <span className="text-xs font-normal text-slate-500">{s.startedAt.toLocaleString("pt-BR")}</span></p><p className="mt-1 text-xs text-red-200">{s.error ?? "Sem detalhe registrado."}</p><Link className="mt-1 inline-block text-xs text-brand-300 hover:text-brand-200" href={`/app/buscar?niche=${encodeURIComponent(s.niche)}&local=${encodeURIComponent(s.location)}`}>Tentar de novo</Link></li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Avisos das fontes</h2>
          <p className="mt-1 text-xs text-slate-500">Buscas que terminaram, mas com a fonte principal fora do ar.</p>
          {degraded.length === 0 ? <p className="mt-3 text-sm text-emerald-300">Sem avisos recentes.</p> : (
            <ul className="mt-3 space-y-2">{degraded.map((d, i) => <li key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100"><b>{d.s.niche} · {d.s.location}</b><br />{d.msg}</li>)}</ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Segurança e pagamentos</h2>
          <p className="mt-3 text-sm text-slate-300">Tentativas de login que falharam: <b className="tabular-nums text-white">{logins}</b> <span className="text-xs text-slate-500">(14 dias)</span></p>
          {webhooks.length === 0 ? <p className="mt-2 text-sm text-emerald-300">Nenhum webhook com erro.</p> : (
            <ul className="mt-3 space-y-2">{webhooks.map((w) => <li key={w.id} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-100">{w.provider} · {w.eventType} · {w.receivedAt.toLocaleString("pt-BR")}<br />{w.signatureOk ? w.error : "assinatura inválida"}</li>)}</ul>
          )}
        </section>
      </div>

      <section className="card mt-5 overflow-x-auto p-5">
        <h2 className="font-display text-lg font-semibold text-white">Registro de atividade</h2>
        <table className="mt-3 w-full min-w-[520px] text-sm"><tbody className="divide-y divide-white/5">
          {recent.map((a) => <tr key={a.id}><td className="whitespace-nowrap py-2 pr-4 text-xs text-slate-500">{a.createdAt.toLocaleString("pt-BR")}</td><td className="py-2 text-slate-200">{ACTIONS[a.action] ?? a.action}</td></tr>)}
        </tbody></table>
      </section>
    </>
  );
}

const ACTIONS: Record<string, string> = {
  login: "Login", login_failed: "Tentativa de login falhou", lead_search: "Busca de empresas", site_generated: "Site gerado", site_published: "Site publicado", site_unpublished: "Site retirado do ar",
  settings_updated: "Configurações alteradas", admin_company_updated: "Empresa alterada pelo painel", user_registered: "Usuário cadastrado", password_reset: "Senha redefinida",
};
