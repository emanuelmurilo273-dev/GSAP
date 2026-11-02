"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { Alert, Spinner } from "@/components/ui";

export default function VerifyPage() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("token") ?? "";
    api("/api/auth/verify", { body: { token } })
      .then(() => setState("ok"))
      .catch((e) => {
        setMsg(e.message);
        setState("error");
      });
  }, []);
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-white">Confirmação de e-mail</h1>
      {state === "loading" && <p className="flex items-center gap-2 text-slate-400"><Spinner /> Confirmando...</p>}
      {state === "ok" && <Alert kind="success">E-mail confirmado com sucesso!</Alert>}
      {state === "error" && <Alert>{msg}</Alert>}
      <Link href="/app" className="btn-primary mt-6 w-full">Ir para o painel</Link>
    </>
  );
}
