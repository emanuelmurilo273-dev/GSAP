import { prisma } from "./db";
import { HttpError } from "./http";

/**
 * Limitador de janela fixa armazenado no PostgreSQL — funciona com várias
 * instâncias da aplicação. Lança 429 quando o limite é excedido.
 */
export async function rateLimit(key: string, max: number, windowSec: number) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" = ${windowStart} THEN "RateLimit"."count" + 1 ELSE 1 END,
      "windowStart" = ${windowStart}
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  if (count > max) {
    throw new HttpError(429, "Muitas requisições. Aguarde um pouco e tente novamente.", "rate_limited");
  }
}
