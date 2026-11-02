"use client";
import { api } from "@/components/api";

export function AdminUserActions({ userId, suspended, role }: { userId: string; suspended: boolean; role: string }) {
  async function act(body: Record<string, unknown>, msg: string) {
    if (!confirm(msg)) return;
    try {
      await api(`/api/admin/users/${userId}`, { method: "PATCH", body });
      location.reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  return (
    <>
      {suspended ? (
        <button className="btn-secondary" onClick={() => act({ action: "reactivate" }, "Reativar esta conta? Os sites elegíveis voltam ao ar se a assinatura estiver ativa.")}>Reativar conta</button>
      ) : (
        <button className="btn-danger" onClick={() => { const reason = prompt("Motivo da suspensão (opcional):") ?? ""; void act({ action: "suspend", reason }, "Suspender esta conta? O usuário perde o acesso e os sites saem do ar."); }}>Suspender conta</button>
      )}
      <button className="btn-ghost" onClick={() => act({ action: "set_role", role: role === "ADMIN" ? "SUBSCRIBER" : "ADMIN" }, role === "ADMIN" ? "Remover permissão de administrador?" : "Tornar este usuário administrador?")}>{role === "ADMIN" ? "Remover admin" : "Tornar admin"}</button>
    </>
  );
}
