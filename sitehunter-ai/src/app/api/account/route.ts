import { z } from "zod";
import { prisma } from "@/lib/db";
import { destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { audit } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

const Patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const b = await parseJson(req, Patch);
  const data: { name?: string; passwordHash?: string } = {};
  if (b.name) data.name = b.name;
  if (b.newPassword) {
    await rateLimit(`pwchange:${user.id}`, 5, 900);
    if (!b.currentPassword || !(await verifyPassword(b.currentPassword, user.passwordHash))) throw new HttpError(400, "Senha atual incorreta.");
    data.passwordHash = await hashPassword(b.newPassword);
  }
  await prisma.user.update({ where: { id: user.id }, data });
  return json({ ok: true });
});

const Del = z.object({ password: z.string().min(1).max(200), confirm: z.literal("EXCLUIR") });

/**
 * Exclusão de conta (LGPD, art. 18): remove dados pessoais, projetos, empresas
 * salvas, propostas e sites. Registros de pagamento são mantidos sem vínculo
 * pessoal pelo prazo exigido pela legislação fiscal.
 */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  const b = await parseJson(req, Del);
  if (!(await verifyPassword(b.password, user.passwordHash))) throw new HttpError(400, "Senha incorreta.");
  if (user.role === "ADMIN") throw new HttpError(400, "A conta do administrador não pode ser excluída por aqui.");
  await audit("account_deleted", { meta: { userIdHash: user.id.slice(0, 6) } });
  await prisma.payment.updateMany({ where: { userId: user.id }, data: { customerEmail: null } });
  await destroySession();
  await prisma.user.delete({ where: { id: user.id } });
  return json({ ok: true });
});
