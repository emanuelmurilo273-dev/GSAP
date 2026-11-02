"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";

type Item = { href: string; label: string; icon: string };

const MAIN: Item[] = [
  { href: "/app", label: "Painel", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/app/buscar", label: "Buscar empresas", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4" },
  { href: "/app/empresas", label: "Empresas salvas", icon: "M4 21V5a2 2 0 0 1 2-2h8l6 6v12M9 21v-6h6v6" },
  { href: "/app/sites", label: "Meus sites", icon: "M3 5h18v14H3zM3 9h18" },
  { href: "/app/propostas", label: "Propostas", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  { href: "/app/assinatura", label: "Assinatura", icon: "M3 7h18v10H3zM3 11h18" },
  { href: "/app/conta", label: "Minha conta", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" },
];
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
        const active = i.href === "/app" || i.href === "/admin" ? path === i.href : path.startsWith(i.href);
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-gradient-to-r from-brand-600/25 to-brand-500/5 text-white ring-1 ring-brand-500/30" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${active ? "text-brand-400" : "text-slate-500 group-hover:text-brand-400"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={i.icon} />
              </svg>
              {i.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ name, email, isAdmin }: { name: string; email: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }
  const content = (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5"><Logo href="/app" /></div>
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
        <button onClick={logout} className="mt-2 text-xs text-slate-400 hover:text-red-300">Sair</button>
      </div>
    </div>
  );
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo href="/app" />
        <button onClick={() => setOpen(true)} className="btn-ghost px-2.5" aria-label="Abrir menu">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
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
