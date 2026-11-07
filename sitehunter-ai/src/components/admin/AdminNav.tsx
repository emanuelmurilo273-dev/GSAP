"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/operacao", label: "Central" },
  { href: "/admin/empresas", label: "Empresas" },
  { href: "/admin/buscas", label: "Buscas" },
  { href: "/admin/sites", label: "Sites gerados" },
  { href: "/admin/erros", label: "Erros e saúde" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

/** Navegação interna do painel operacional: rola na horizontal no celular, sem cortar nenhuma aba. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Painel administrativo" className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-brand-500/60 bg-brand-500/15 font-semibold text-white" : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
