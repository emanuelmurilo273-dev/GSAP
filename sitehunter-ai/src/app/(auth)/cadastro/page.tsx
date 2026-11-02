"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner } from "@/components/ui";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) return setError("As senhas não coincidem.");
    setLoading(true);
    try {
      await api("/api/auth/register", { body: { name: f.get("name"), email: f.get("email"), password: f.get("password"), acceptTerms: f.get("terms") === "on" } });
      location.href = "/app/assinatura?bemvindo=1";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-white">Criar conta</h1>
      <p className="mt-1 text-sm text-slate-400">Encontre clientes. Crie sites. Venda mais.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nome"><input name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" /></Field>
        <Field label="E-mail" hint="Use o mesmo e-mail no pagamento da Kiwify para a liberação automática."><input name="email" type="email" required autoComplete="email" className="input" /></Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres."><input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /></Field>
        <Field label="Confirme a senha"><input name="password2" type="password" required minLength={8} autoComplete="new-password" className="input" /></Field>
        <label className="flex items-start gap-2.5 text-sm text-slate-400">
          <input type="checkbox" name="terms" required className="mt-1 accent-brand-500" />
          <span>Li e aceito os <Link href="/termos" target="_blank" className="text-brand-300">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank" className="text-brand-300">Política de Privacidade</Link>.</span>
        </label>
        <button className="btn-primary w-full py-3" disabled={loading}>{loading && <Spinner />}Criar conta</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">Já tem conta? <Link href="/login" className="text-brand-300">Entrar</Link></p>
    </>
  );
}
