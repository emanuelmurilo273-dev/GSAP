import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { linkPendingPayments } from "@/lib/kiwify";
import { audit } from "@/lib/logger";

const Body = z.object({ email: z.string().trim().toLowerCase().email() });

/** Vincula manualmente um pagamento recebido sem conta correspondente. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { email } = await parseJson(req, Body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(404, "Nenhuma conta com este e-mail.");
  const n = await linkPendingPayments(user.id, { paymentId: id });
  if (!n) throw new HttpError(400, "Pagamento não encontrado ou já vinculado.");
  await audit("admin_payment_linked", { userId: user.id, actorId: admin.id, meta: { paymentId: id } });
  return json({ ok: true });
});
