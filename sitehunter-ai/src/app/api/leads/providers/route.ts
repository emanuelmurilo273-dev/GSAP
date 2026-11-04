import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { providerStatus } from "@/lib/leads/providers";
import { aiConfigured } from "@/lib/ai";
import { imagesConfigured } from "@/lib/images";

/** Estado das integrações (nunca expõe as chaves). */
export const GET = route(async () => {
  await requireUser();
  return json({ providers: providerStatus(), ai: aiConfigured(), images: imagesConfigured(), flow: { api: false, mode: "assisted" } });
});
