import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "./lib/publicPaths";

// Roteamento por domínio:
//  - domínio do painel (APP_URL)        → aplicação normal
//  - <slug>.<ROOT_DOMAIN>               → site publicado
//  - qualquer outro domínio (próprio)   → site publicado com domínio conectado
export function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase().replace(/\.$/, "");
  const root = (process.env.ROOT_DOMAIN ?? "localhost:3000").toLowerCase();
  let appHost = "localhost:3000";
  try {
    appHost = new URL(process.env.APP_URL ?? "http://localhost:3000").host.toLowerCase();
  } catch {}
  const hostNoPort = host.replace(/:\d+$/, "");
  const isApp = host === appHost || host === root || host === `www.${root}` || hostNoPort === "localhost" || hostNoPort === "127.0.0.1" || hostNoPort === "app" || /^\d+\.\d+\.\d+\.\d+$/.test(hostNoPort);
  if (isApp) {
    // O destino interno não é acessível diretamente pelo domínio do painel.
    if (req.nextUrl.pathname.startsWith("/site-render")) return new NextResponse("Not found", { status: 404 });
    return privateGate(req);
  }
  // Sites publicados: a página única é servida em "/"; os demais caminhos não existem.
  if (req.nextUrl.pathname !== "/") return new NextResponse("Not found", { status: 404 });
  const url = req.nextUrl.clone();
  if (host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -(root.length + 1));
    url.pathname = `/site-render/s/${encodeURIComponent(slug)}`;
  } else {
    url.pathname = `/site-render/d/${encodeURIComponent(hostNoPort)}`;
  }
  return NextResponse.rewrite(url);
}

// ---------- Modo privado ----------
// Camada extra (barata) antes do servidor: sem cookie de sessão, nada além das
// rotas públicas chega a ser renderizado. A verificação definitiva continua no
// servidor (getCurrentUser → mayAuthenticate) em cada página e API.
const SESSION_COOKIE = "sh_session";
function privateGate(req: NextRequest) {
  if (process.env.ACCESS_MODE?.trim() === "saas") return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (isPublicPath(path) || req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Faça login para continuar.", code: "unauthenticated" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Exclui arquivos internos do Next e o webhook/health (sempre no domínio do painel).
  matcher: ["/((?!_next/|favicon.ico|robots.txt).*)"],
  runtime: "nodejs",
};
