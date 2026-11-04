// Rotas acessíveis sem sessão no modo privado (todo o resto exige login).
const PUBLIC_PREFIXES = [
  "/login", "/recuperar-senha", "/redefinir-senha", "/verificar-email", "/cadastro", "/bot", "/termos", "/privacidade",
  "/s/", // sites publicados por link público (somente o snapshot HTML)
  "/api/auth/login", "/api/auth/logout", "/api/auth/forgot", "/api/auth/reset", "/api/auth/verify", "/api/auth/register",
  "/api/health", "/api/webhooks/", "/api/cron/", "/api/domains/check",
];

export function isPublicPath(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/") || (p.endsWith("/") && path.startsWith(p)));
}

