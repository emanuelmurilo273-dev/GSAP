import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Usado pelo Caddy (on_demand_tls → ask) antes de emitir um certificado SSL.
 * Responde 200 apenas para domínios que a plataforma realmente serve,
 * evitando emissão de certificados para domínios arbitrários.
 */
export async function GET(req: Request) {
  const domain = (new URL(req.url).searchParams.get("domain") ?? "").toLowerCase().replace(/\.$/, "");
  const root = env.rootDomain;
  const appHost = new URL(env.appUrl).host;
  if (!domain) return new NextResponse("missing", { status: 400 });
  if (domain === appHost || domain === root || domain === `www.${root}` || domain === `sites.${root}`) return new NextResponse("ok");
  if (domain.endsWith(`.${root}`)) {
    const slug = domain.slice(0, -(root.length + 1));
    const pub = await prisma.publication.findUnique({ where: { slug }, select: { id: true } });
    return pub ? new NextResponse("ok") : new NextResponse("unknown", { status: 404 });
  }
  const pub = await prisma.publication.findFirst({ where: { customDomain: domain, customDomainVerifiedAt: { not: null } }, select: { id: true } });
  return pub ? new NextResponse("ok") : new NextResponse("unknown", { status: 404 });
}
