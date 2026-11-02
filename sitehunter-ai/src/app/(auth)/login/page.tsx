"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner } from "@/components/ui";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-white">Entrar</h1>
      <p className="mt-1 text-sm text-slate-400">Acesse seu painel do SiteHunter AI.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="E-mail"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
        <Field label="Senha"><input name="password" type="password" required autoComplete="current-password" className="input" /></Field>
        <button className="btn-primary w-full py-3" disabled={loading}>{loading && <Spinner />}Entrar</button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link href="/recuperar-senha" className="text-brand-300 hover:text-brand-200">Esqueci minha senha</Link>
        <Link href="/cadastro" className="text-slate-400 hover:text-white">Criar conta</Link>
      </div>
    </>
  );
}
