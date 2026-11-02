import { NextResponse } from "next/server";
import { resolvePlacePhoto } from "@/lib/placePhotos";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Redireciona para a foto do estabelecimento na CDN do Google (sem expor a chave). */
export async function GET(req: Request, { params }: { params: Promise<{ companyId: string; index: string }> }) {
  const { companyId, index } = await params;
  const i = Number(index);
  const w = Number(new URL(req.url).searchParams.get("w") ?? 1600);
  if (!/^[a-z0-9]{10,40}$/i.test(companyId) || !Number.isInteger(i) || i < 0 || i > 9 || !Number.isFinite(w)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    await rateLimit(`photo:${clientIp(req)}`, 300, 60);
  } catch {
    return new NextResponse("Too many requests", { status: 429 });
  }
  const uri = await resolvePlacePhoto(companyId, i, w);
  if (!uri) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  return NextResponse.redirect(uri, { status: 302, headers: { "Cache-Control": "public, max-age=1800" } });
}
