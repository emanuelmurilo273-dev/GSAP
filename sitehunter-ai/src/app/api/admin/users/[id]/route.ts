import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { syncUserSites } from "@/lib/subscriptions";
import { audit } from "@/lib/logger";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: z.string().max(300).default("") }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("set_role"), role: z.enum(["ADMIN", "SUBSCRIBER"]) }),
]);

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Usuário não encontrado.");
  const b = await parseJson(req, Body);
  if (id === admin.id) throw new HttpError(400, "Você não pode alterar a própria conta por aqui.");
  if (b.action === "suspend") {
    await prisma.user.update({ where: { id }, data: { adminSuspendedAt: new Date(), adminSuspendReason: b.reason || null } });
    await prisma.session.deleteMany({ where: { userId: id } });
  } else if (b.action === "reactivate") {
    await prisma.user.update({ where: { id }, data: { adminSuspendedAt: null, adminSuspendReason: null } });
  } else {
    await prisma.user.update({ where: { id }, data: { role: b.role } });
  }
  await syncUserSites(id);
  await audit(`admin_${b.action}`, { userId: id, actorId: admin.id, meta: b });
  return json({ ok: true });
});
