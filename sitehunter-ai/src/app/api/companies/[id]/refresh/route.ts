import { prisma } from "@/lib/db";
import { requirePremium } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { placeDetails } from "@/lib/places";

/** Atualiza os dados públicos da empresa diretamente na fonte (Place Details). */
export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requirePremium();
  await rateLimit(`refresh:${user.id}`, 20, 60);
  const { id } = await params;
  const c = await prisma.company.findFirst({ where: { id, userId: user.id } });
  if (!c) throw new HttpError(404, "Empresa não encontrada.");
  const p = await placeDetails(c.sourceId);
  const company = await prisma.company.update({
    where: { id },
    data: { name: p.name, category: p.category, address: p.address, neighborhood: p.neighborhood, city: p.city, state: p.state, phone: p.phone, website: p.website, mapsUrl: p.mapsUrl, lat: p.lat, lng: p.lng, fetchedAt: new Date() },
  });
  return json({ company });
});
