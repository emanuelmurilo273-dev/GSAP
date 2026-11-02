import { serveSite } from "@/lib/serveSite";

export const dynamic = "force-dynamic";

// Endereço alternativo por caminho: https://APP/s/<slug> (útil antes de configurar o DNS curinga).
async function handle(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return serveSite({ slug: (await params).slug.toLowerCase() }, req.method);
}
export const GET = handle;
export const HEAD = handle;
