import { requirePremium } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { imagesConfigured, searchImages, trackImageDownload } from "@/lib/images";

export const GET = route(async (req) => {
  const user = await requirePremium();
  await rateLimit(`images:${user.id}`, 30, 60);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!imagesConfigured()) return json({ configured: false, images: [] });
  if (q.length < 2 || q.length > 80) throw new HttpError(400, "Digite um termo de busca.");
  return json({ configured: true, images: await searchImages(q, 18) });
});

/** Registra o uso de uma foto (exigência das diretrizes do Unsplash). */
export const POST = route(async (req) => {
  await requirePremium();
  const { downloadLocation } = (await req.json()) as { downloadLocation?: string };
  if (downloadLocation) await trackImageDownload(downloadLocation);
  return json({ ok: true });
});
