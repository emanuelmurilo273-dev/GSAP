import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { audit } from "@/lib/logger";

const Body = z.object({ excluded: z.boolean().optional(), contacted: z.boolean().optional() }).refine((b) => b.excluded !== undefined || b.contacted !== undefined, "Nada para alterar.");

// Administrador: exclui/restaura ou marca uma empresa como contatada (você mesmo contata; o sistema nunca envia nada).
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, Body);
  const c = await prisma.company.findUnique({ where: { id }, select: { id: true } });
  if (!c) throw new HttpError(404, "Empresa não encontrada.", "not_found");
  const data: { excludedAt?: Date | null; contactedAt?: Date | null } = {};
  if (b.excluded !== undefined) data.excludedAt = b.excluded ? new Date() : null;
  if (b.contacted !== undefined) data.contactedAt = b.contacted ? new Date() : null;
  const company = await prisma.company.update({ where: { id }, data, select: { id: true, excludedAt: true, contactedAt: true } });
  await audit("admin_company_updated", { actorId: admin.id, meta: { companyId: id, ...b } });
  return json({ company });
});
