"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { toast } from "@/components/ui";

/** Ações rápidas de uma empresa no painel: marcar como contatada (você contata; o Hunter nunca envia) e excluir/restaurar. */
export function CompanyActions({ id, excluded, contacted }: { id: string; excluded: boolean; contacted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function patch(body: { excluded?: boolean; contacted?: boolean }, msg: string) {
    setBusy(true);
    try { await api(`/api/admin/companies/${id}`, { method: "PATCH", body }); toast(msg); router.refresh(); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  }
  const b = "rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50";
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <button disabled={busy} className={b} onClick={() => patch({ contacted: !contacted }, contacted ? "Marca de contato removida" : "Marcada como contatada")}>{contacted ? "Desmarcar contato" : "Marcar contatada"}</button>
      <button disabled={busy} className={b} onClick={() => patch({ excluded: !excluded }, excluded ? "Empresa restaurada" : "Empresa excluída da lista")}>{excluded ? "Restaurar" : "Excluir"}</button>
    </div>
  );
}
