import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import { Toaster } from "@/components/ui";
import { AmbientBackdrop, Spotlight } from "@/components/hunter/Ambient";
import { env } from "@/lib/env";
import { getUsage } from "@/lib/usage";
import { isPrivateMode } from "@/lib/owner";

export async function Shell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (admin && user.role !== "ADMIN") redirect("/app");
  const a = user.access;
  const usage = await getUsage(user.id);
  const warnings = [
    usage.searches.warn && `Você usou ${usage.searches.used} de ${usage.searches.limit} pesquisas deste mês.`,
    usage.generations.warn && `Você usou ${usage.generations.used} de ${usage.generations.limit} gerações de sites deste mês.`,
  ].filter(Boolean) as string[];
  const retention = user.subscription?.retentionUntil;

  return (
    <div className="min-h-screen">
      <AmbientBackdrop />
      <Spotlight />
      <div className="app-layer">
      <Sidebar name={user.name} email={user.email} isAdmin={user.role === "ADMIN"} privateMode={isPrivateMode()} />
      <div className="lg:pl-64">
      <div className="mx-auto w-full max-w-[1480px]">
        <div className="space-y-2 px-4 pt-4 sm:px-8">
          {!a.premium && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {a.message}
                {retention && ` Seus projetos ficam preservados até ${retention.toLocaleDateString("pt-BR")}.`}
              </span>
              <Link href="/app/assinatura" className="btn-primary shrink-0 py-2">Ver assinatura</Link>
            </div>
          )}
          {a.reason === "canceled_until_period_end" && a.periodEnd && (
            <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.07] px-4 py-3 text-sm text-brand-100">
              Renovação cancelada: seu acesso e seus sites continuam ativos até {new Date(a.periodEnd).toLocaleDateString("pt-BR")}. Depois disso os sites saem do ar.
            </div>
          )}
          {env.smtp && !user.emailVerifiedAt && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">Confirme seu e-mail pelo link que enviamos. <Link href="/app/conta" className="text-brand-300">Reenviar</Link></div>
          )}
          {warnings.map((w) => (
            <div key={w} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-200">⚠ {w}</div>
          ))}
        </div>
        <main className="px-4 pb-28 pt-6 sm:px-8 sm:py-8 lg:pb-8">{children}</main>
      </div>
      </div>
      <Toaster />
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        <h1 className="h-grad text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Paywall({ message }: { message: string }) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-2xl ring-1 ring-brand-500/25">🔒</div>
      <h2 className="text-xl font-semibold text-white">Recurso Premium</h2>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
      <Link href="/app/assinatura" className="btn-primary mt-6">Ver plano Premium</Link>
    </div>
  );
}
