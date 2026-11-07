// Rotas acessíveis sem sessão no modo privado (todo o resto exige login).
const PUBLIC_PREFIXES = [
  "/login", "/recuperar-senha", "/redefinir-senha", "/verificar-email", "/cadastro", "/bot", "/termos", "/privacidade",
  "/s/", // sites publicados por link público (somente o snapshot HTML)
  "/vendor/", // bibliotecas estáticas usadas pelos sites publicados (three.js)
  "/models/", // modelos 3D escaneados e luz de estúdio (CC0) usados pelos sites publicados
  "/photos/", // biblioteca de fotos (domínio público) usada pelos sites publicados
  "/api/auth/login", "/api/auth/logout", "/api/auth/forgot", "/api/auth/reset", "/api/auth/verify", "/api/auth/register",
  "/api/health", "/api/webhooks/", "/api/cron/", "/api/domains/check",
];

export function isPublicPath(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/") || (p.endsWith("/") && path.startsWith(p)));
}

