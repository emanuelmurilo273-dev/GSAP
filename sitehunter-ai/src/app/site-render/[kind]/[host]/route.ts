import { serveSite } from "@/lib/serveSite";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ kind: string; host: string }> };

// Destino interno das reescritas do middleware (subdomínios e domínios próprios).
async function handle(req: Request, { params }: Ctx) {
  const { kind, host } = await params;
  const value = decodeURIComponent(host).toLowerCase();
  return serveSite(kind === "d" ? { domain: value } : { slug: value }, req.method);
}
export const GET = handle;
export const HEAD = handle;
