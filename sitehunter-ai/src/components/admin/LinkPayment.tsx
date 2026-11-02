"use client";
import { api } from "@/components/api";

export function LinkPayment({ paymentId, hint }: { paymentId: string; hint: string | null }) {
  return (
    <button
      className="text-xs text-amber-300 hover:text-amber-200"
      onClick={async () => {
        const email = prompt("E-mail da conta para vincular este pagamento:", hint ?? "");
        if (!email) return;
        try {
          await api(`/api/admin/payments/${paymentId}`, { body: { email } });
          location.reload();
        } catch (e) {
          alert((e as Error).message);
        }
      }}
    >
      Sem conta{hint ? ` (${hint})` : ""} — vincular
    </button>
  );
}
