"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner } from "@/components/ui";

export default function ResetPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) return setError("As senhas não coincidem.");
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/reset", { body: { token: new URLSearchParams(location.search).get("token") ?? "", password: f.get("password") } });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-white">Nova senha</h1>
      <div className="mt-6 space-y-4">
        {done ? (
          <>
            <Alert kind="success">Senha alterada. Por segurança, todas as sessões foram encerradas.</Alert>
            <Link href="/login" className="btn-primary w-full">Entrar</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Nova senha"><input name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></Field>
            <Field label="Confirme a senha"><input name="password2" type="password" minLength={8} required autoComplete="new-password" className="input" /></Field>
            <button className="btn-primary w-full py-3" disabled={loading}>{loading && <Spinner />}Salvar nova senha</button>
          </form>
        )}
      </div>
    </>
  );
}
