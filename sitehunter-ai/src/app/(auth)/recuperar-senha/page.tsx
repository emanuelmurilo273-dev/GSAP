"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner } from "@/components/ui";

export default function ForgotPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { body: { email: new FormData(e.currentTarget).get("email") } });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-white">Recuperar senha</h1>
      <p className="mt-1 text-sm text-slate-400">Enviaremos um link de redefinição para o seu e-mail.</p>
      <div className="mt-6 space-y-4">
        {done ? (
          <Alert kind="success">Se houver uma conta com este e-mail, você receberá o link em instantes. Verifique também a caixa de spam.</Alert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="E-mail"><input name="email" type="email" required className="input" /></Field>
            <button className="btn-primary w-full py-3" disabled={loading}>{loading && <Spinner />}Enviar link</button>
          </form>
        )}
        <Link href="/login" className="block text-center text-sm text-brand-300">Voltar ao login</Link>
      </div>
    </>
  );
}
