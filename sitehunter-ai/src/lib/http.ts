import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { log } from "./logger";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição inválido (JSON esperado).");
  }
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new HttpError(400, r.error.issues.map((i) => `${i.path.join(".") || "campo"}: ${i.message}`).join("; "), "validation");
  }
  return r.data;
}

/** Proteção CSRF básica: requisições que alteram dados precisam vir da própria origem. */
export function assertSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin) {
    // Navegadores modernos sempre enviam Origin em POST/PATCH/DELETE via fetch.
    if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Origem não permitida.");
    return;
  }
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Origem não permitida.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Origem não permitida.");
  }
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Envolve um handler de rota: CSRF, tratamento de erros e logs. */
export function route<C = { params: Promise<Record<string, string>> }>(handler: Handler<C>, opts: { csrf?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (opts.csrf !== false) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message, code: e.code, ...e.extra }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return NextResponse.json({ error: "Dados inválidos.", code: "validation" }, { status: 400 });
      }
      log("error", "route_error", { url: req.url, method: req.method, error: e instanceof Error ? e.stack : String(e) });
      return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
    }
  };
}
