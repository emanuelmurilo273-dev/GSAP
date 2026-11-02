import { prisma } from "@/lib/db";
import { requirePremium } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeUsage, refundUsage } from "@/lib/usage";
import { placeReviews } from "@/lib/places";
import { researchCompany } from "@/lib/research";
import { audit } from "@/lib/logger";

export const maxDuration = 300;

/**
 * Pesquisa a empresa na web (site e perfis oficiais) e busca as avaliações públicas do Google.
 * Guarda só o que foi confirmado e verificado; o que não foi vai para "a confirmar".
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requirePremium();
  await rateLimit(`research:${user.id}`, 6, 600);
  const { id } = await params;
  const c = await prisma.company.findFirst({ where: { id, userId: user.id } });
  if (!c) throw new HttpError(404, "Empresa não encontrada.");
  await consumeUsage(user.id, "generations");
  try {
    const [research, reviews] = await Promise.all([researchCompany(c), c.source === "google_places" ? placeReviews(c.sourceId).catch(() => null) : Promise.resolve(null)]);
    const company = await prisma.company.update({
      where: { id },
      data: { research: research as never, reviews: (reviews ?? undefined) as never, researchedAt: new Date() },
    });
    await audit("company_researched", { userId: user.id, meta: { companyId: id, sources: research.sources.length, photos: research.photos.length } });
    return json({ company, research, reviews });
  } catch (e) {
    await refundUsage(user.id, "generations");
    throw e;
  }
});
