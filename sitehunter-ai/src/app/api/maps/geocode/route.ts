import { z } from "zod";
import { requirePremium } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { geocode } from "@/lib/maps";

const Body = z.union([
  z.object({ address: z.string().trim().min(3, "digite um endereço").max(200) }),
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
]);

/** Pesquisa de endereço (ou endereço a partir de coordenadas). */
export const POST = route(async (req) => {
  const user = await requirePremium();
  await rateLimit(`geocode:${user.id}`, 30, 60);
  const b = await parseJson(req, Body);
  return json({ results: await geocode(b) });
});
