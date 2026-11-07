"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";

type Item = { href: string; label: string; icon: string };

// As 5 abas do app, na ordem do fluxo de trabalho.
export const TABS: (Item & { short: string; step: string })[] = [
  { href: "/app/buscar", label: "Buscar empresas", short: "Buscar", step: "1", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4" },
  { href: "/app/leads", label: "Leads encontrados", short: "Leads", step: "2", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/app/sites", label: "Prévia dos sites", short: "Prévias", step: "3", icon: "M3 5h18v14H3zM3 9h18" },
  { href: "/app/abordagens", label: "Abordagens", short: "Abordagens", step: "4", icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" },
  { href: "/app/configuracoes", label: "Configurações", short: "Config.", step: "5", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7 5 11l2 1-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z" },
];
const MAIN: Item[] = TABS;
const ADMIN: Item[] = [
  { href: "/admin", label: "Visão geral", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/admin/usuarios", label: "Usuários", icon: "M16 20v-2a4 4 0 0 0-8 0v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7 5 11l2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z" },
];

function NavList({ items, onNavigate }: { items: Item[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((i) => {
        const active = i.href === "/app" || i.href === "/admin" ? path === i.href : path.startsWith(i.href) || (i.href === "/app/leads" && path.startsWith("/app/leads/")) || (i.href === "/app/configuracoes" && (path.startsWith("/app/conta") || path.startsWith("/app/assinatura") || path.startsWith("/app/propostas")));
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`nav-item group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-gradient-to-r from-brand-600/25 to-brand-500/5 text-white ring-1 ring-brand-500/30" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${active ? "text-brand-400" : "text-slate-500 group-hover:text-brand-400"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={i.icon} />
              </svg>
              <span className="flex-1">{i.label}</span>
              {"step" in i && i.step ? <span className="nav-step" aria-hidden="true">{i.step as string}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ name, email, isAdmin, privateMode = false }: { name: string; email: string; isAdmin: boolean; privateMode?: boolean }) {
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }
  const content = (
    <div className="flex h-full flex-col">
      <div className="logo-glow px-4 py-5"><Logo href="/app/buscar" /></div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        <NavList items={MAIN} onNavigate={() => setOpen(false)} />
        {isAdmin && (
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Administração</p>
            <NavList items={ADMIN} onNavigate={() => setOpen(false)} />
          </div>
        )}
      </nav>
      <div className="m-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="truncate text-xs text-slate-500">{email}</p>
        {privateMode && <p className="mt-1 text-[11px] text-emerald-300/80">Painel privado · conta proprietária</p>}
        <button onClick={logout} className="mt-2 text-xs text-slate-400 hover:text-red-300">Sair</button>
      </div>
    </div>
  );
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo href="/app/buscar" />
        <button onClick={() => setOpen(true)} className="btn-ghost px-2.5" aria-label="Abrir menu">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      <BottomTabs />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-white/5 bg-ink-900/80 backdrop-blur-xl lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/5 bg-ink-900 animate-fade-up">{content}</aside>
        </div>
      )}
    </>
  );
}

/** Barra de abas fixa no celular: as 5 abas sempre à mão, com a ativa destacada. */
function BottomTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Abas" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {TABS.map((t) => {
        const on = path.startsWith(t.href) || (t.href === "/app/configuracoes" && (path.startsWith("/app/conta") || path.startsWith("/app/assinatura")));
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-1 py-2 text-[10.5px] font-medium ${on ? "text-white" : "text-slate-500"}`}>
            <span className={`grid h-7 w-12 place-items-center rounded-full transition ${on ? "bg-brand-500/25 text-brand-300" : ""}`}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={t.icon} /></svg>
            </span>
            {t.short}
          </Link>
        );
      })}
    </nav>
  );
}
