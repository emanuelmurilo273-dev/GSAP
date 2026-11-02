import { NextResponse } from "next/server";
import { handleKiwifyWebhook } from "@/lib/kiwify";

export const dynamic = "force-dynamic";

/**
 * Endpoint de notificações da Kiwify. Cadastre na Kiwify (Apps → Webhooks):
 *   URL: https://SEU_DOMINIO/api/webhooks/kiwify
 *   Token: o mesmo valor de KIWIFY_WEBHOOK_TOKEN
 * O corpo é lido como texto bruto, pois a assinatura é calculada sobre ele.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "payload muito grande" }, { status: 413 });
  const signature = new URL(req.url).searchParams.get("signature");
  const r = await handleKiwifyWebhook(raw, signature);
  return NextResponse.json(r.body, { status: r.status });
}
