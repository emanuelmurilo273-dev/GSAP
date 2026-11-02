import { z } from "zod";
import { requirePremium } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { computeRoute } from "@/lib/maps";

const Point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const Body = z.object({ origin: Point, destination: Point, mode: z.enum(["DRIVE", "WALK", "BICYCLE", "TWO_WHEELER", "TRANSIT"]).default("DRIVE") });

/** Calcula a rota entre dois pontos (Routes API, no servidor). */
export const POST = route(async (req) => {
  const user = await requirePremium();
  await rateLimit(`route:${user.id}`, 30, 60);
  const b = await parseJson(req, Body);
  return json({ route: await computeRoute(b.origin, b.destination, b.mode) });
});
