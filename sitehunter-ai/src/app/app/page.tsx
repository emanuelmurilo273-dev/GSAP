import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { UsageBar } from "@/components/app/UsageBar";
import { ActivityChart } from "@/components/app/Charts";
import { getUsage } from "@/lib/usage";
import { aiConfigured } from "@/lib/ai";
import { env } from "@/lib/env";
import { imagesConfigured } from "@/lib/images";
import { Scene3D } from "@/components/studio/Scene3D";

function months(n: number) {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: `${x.getFullYear()}-${x.getMonth()}`, label: x.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
  }
  return out;
}

export default async function Dashboard() {
  const user = await pageUser();
  const since = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
  const [companies, projects, published, proposals, visits, recentProjects, recentProposals, usage] = await Promise.all([
    prisma.company.count({ where: { userId: user.id, excludedAt: null } }),
    prisma.project.count({ where: { userId: user.id } }),
    prisma.publication.count({ where: { userId: user.id, status: "PUBLISHED" } }),
    prisma.proposal.count({ where: { userId: user.id } }),
    prisma.publication.aggregate({ where: { userId: user.id }, _sum: { visits: true } }),
    prisma.project.findMany({ where: { userId: user.id, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.proposal.findMany({ where: { userId: user.id, createdAt: { gte: since } }, select: { createdAt: true } }),
    getUsage(user.id),
  ]);
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const chart = months(6).map((m) => ({
    label: m.label,
    sites: recentProjects.filter((p) => key(p.createdAt) === m.key).length,
    propostas: recentProposals.filter((p) => key(p.createdAt) === m.key).length,
  }));
  const stats = [
    { label: "Leads ativos", value: companies, href: "/app/leads" },
    { label: "Sites criados", value: projects, href: "/app/sites" },
    { label: "Sites no ar", value: published, href: "/app/sites?status=PUBLISHED" },
    { label: "Propostas", value: proposals, href: "/app/propostas" },
    { label: "Visitas nos sites", value: visits._sum.visits ?? 0, href: "/app/sites" },
  ];
  const steps = [
    { done: user.access.premium, label: "Assinar o plano Premium", href: "/app/assinatura" },
    { done: companies > 0, label: "Descobrir leads", href: "/app/leads" },
    { done: projects > 0, label: "Gerar uma prévia de site", href: "/app/leads" },
    { done: published > 0, label: "Publicar um site", href: "/app/sites" },
    { done: proposals > 0, label: "Gerar uma proposta comercial", href: "/app/sites" },
  ];
  const integrations = [
    { name: "Google Places (busca)", ok: !!env.googlePlacesKey },
    { name: "IA (Anthropic Claude)", ok: aiConfigured() },
    { name: "Banco de imagens (Unsplash)", ok: imagesConfigured() },
    { name: "Google Flow (fluxo assistido, sem API)", ok: true },
    { name: "Webhook Kiwify", ok: env.kiwifyWebhookTokens.length > 0 },
    { name: "E-mail (SMTP)", ok: !!env.smtp },
  ];

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}!`} subtitle="Seu estúdio de prospecção: dados públicos viram prévias de site e abordagens prontas para revisar." actions={<Link href="/app/leads" className="btn-primary">Descobrir leads</Link>} />
      <section className="card relative mb-5 grid overflow-hidden lg:grid-cols-[1fr_1.2fr]">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_right,black_10%,transparent_70%)]" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-signal)]">Fluxo do estúdio</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Descobrir → verificar → prévia → abordagem</h2>
          <ol className="mt-5 space-y-2 text-sm text-slate-300">
            <li><b className="text-white">1.</b> Defina nicho, região, idioma e quantidade.</li>
            <li><b className="text-white">2.</b> Revise cada fato com sua fonte e confiança; corrija o que precisar.</li>
            <li><b className="text-white">3.</b> Gere a prévia do site (não publicada) e edite à vontade.</li>
            <li><b className="text-white">4.</b> Copie ou exporte a abordagem. Nada é enviado automaticamente.</li>
          </ol>
          <Link href="/app/leads" className="btn-primary mt-6">Abrir estúdio de leads</Link>
        </div>
        <div className="relative hidden sm:block"><Scene3D compact /></div>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s, i) => (
          <Link key={s.label} href={s.href} className="card card-hover p-4 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{s.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <h2 className="font-semibold text-white">Atividade nos últimos 6 meses</h2>
          <div className="mt-4"><ActivityChart data={chart} /></div>
        </section>
        <section className="card space-y-5 p-5">
          <h2 className="font-semibold text-white">Uso do plano · {usage.period}</h2>
          <UsageBar label="Pesquisas de empresas" used={usage.searches.used} limit={usage.searches.limit} />
          <UsageBar label="Gerações de sites" used={usage.generations.used} limit={usage.generations.limit} />
          <UsageBar label="Sites publicados" used={usage.published.used} limit={usage.published.limit} />
        </section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold text-white">Primeiros passos</h2>
          <ul className="mt-4 space-y-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${s.done ? "bg-emerald-500/20 text-emerald-300" : "border border-white/15 text-slate-500"}`}>{s.done ? "✓" : ""}</span>
                  <span className={s.done ? "text-slate-500 line-through" : "text-slate-200"}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {user.role === "ADMIN" && (
          <section className="card p-5">
            <h2 className="font-semibold text-white">Integrações da plataforma</h2>
            <p className="mt-1 text-xs text-slate-500">Visível apenas para administradores. Configure as variáveis no servidor (.env).</p>
            <ul className="mt-4 space-y-2 text-sm">
              {integrations.map((i) => (
                <li key={i.name} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                  <span className="text-slate-300">{i.name}</span>
                  <span className={`badge ${i.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{i.ok ? "Configurado" : "Pendente"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
