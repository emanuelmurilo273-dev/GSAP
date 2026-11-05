import { prisma } from "./db";
import { computeAccess } from "./access";
import { getSettings } from "./settings";
import { publishedSiteCsp, esc } from "./site/render";
import { env } from "./env";
import { syncUserSites } from "./subscriptions";

function page(status: number, title: string, message: string) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0b0f17;color:#e2e8f0;text-align:center;padding:24px}h1{font-size:1.6rem;margin:0 0 8px}p{color:#94a3b8;max-width:460px;line-height:1.6}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(message)}</p></main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Robots-Tag": "noindex" } });
}

/**
 * Serve um site publicado. O acesso do dono é verificado no servidor a cada
 * requisição, então um site sai do ar assim que a assinatura vence — mesmo
 * que a rotina periódica ainda não tenha rodado.
 */
export async function serveSite(lookup: { slug?: string; domain?: string }, method = "GET") {
  const pub = lookup.slug
    ? await prisma.publication.findUnique({ where: { slug: lookup.slug } })
    : await prisma.publication.findFirst({ where: { customDomain: lookup.domain, customDomainVerifiedAt: { not: null } } });
  if (!pub || pub.status === "DRAFT" || !pub.html) return page(404, "Site não encontrado", "Não existe nenhum site publicado neste endereço.");
  if (pub.status === "UNPUBLISHED") return page(404, "Site não encontrado", "Este site não está publicado no momento.");

  const unavailable = () => page(503, "Site temporariamente indisponível", "Este site está temporariamente fora do ar. Se você é o responsável, acesse o painel do SiteHunter AI para reativá-lo.");
  if (pub.status === "SUSPENDED") return unavailable();

  const owner = await prisma.user.findUnique({ where: { id: pub.userId }, include: { subscription: true } });
  const settings = await getSettings();
  if (!owner || !computeAccess(owner, owner.subscription, settings).premium) {
    if (owner) void syncUserSites(owner.id, settings).catch(() => undefined);
    return unavailable();
  }
  if (method === "GET") void prisma.publication.update({ where: { id: pub.id }, data: { visits: { increment: 1 } } }).catch(() => undefined);
  return new Response(method === "HEAD" ? null : pub.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": publishedSiteCsp(new URL(env.appUrl).origin),
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // Sites de demonstração para prospecção não devem aparecer em buscadores.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
