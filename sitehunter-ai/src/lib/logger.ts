import { prisma } from "./db";

type Level = "info" | "warn" | "error";

export function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...meta });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Registra um evento importante no banco (auditoria). Nunca lança erro. */
export async function audit(action: string, opts: { userId?: string | null; actorId?: string | null; meta?: Record<string, unknown> } = {}) {
  try {
    await prisma.auditLog.create({
      data: { action, userId: opts.userId ?? null, actorId: opts.actorId ?? null, meta: (opts.meta ?? undefined) as never },
    });
  } catch (e) {
    log("error", "audit_failed", { action, error: String(e) });
  }
}
