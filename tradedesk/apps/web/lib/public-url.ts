/**
 * Endereço PÚBLICO do site para montar redirecionamentos.
 * Dentro do Docker o Next só conhece a porta interna (3000); `req.url` aponta para ela e o redirect cairia em
 * localhost:3000 (outro app seu!). Por isso usamos NEXT_PUBLIC_APP_URL ou, na falta dele, o cabeçalho Host.
 */
export function publicUrl(req: Request, path: string): URL {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return new URL(path, env);
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https');
  return new URL(path, `${proto}://${host}`);
}
