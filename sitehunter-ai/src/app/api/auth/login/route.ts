import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { HttpError, clientIp, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { audit } from "@/lib/logger";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(160), password: z.string().min(1).max(200) });
// Hash fixo para manter o tempo de resposta igual quando o e-mail não existe.
let DUMMY: string | null = null;
async function dummyHash() {
  return (DUMMY ??= await hashPassword("senha-inexistente-para-tempo-constante"));
}

export const POST = route(async (req) => {
  const body = await parseJson(req, Body);
  await rateLimit(`login:${clientIp(req)}`, 20, 900);
  await rateLimit(`login:${body.email}`, 10, 900);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) {
    await audit("login_failed", { userId: user?.id, meta: { ip: clientIp(req) } });
    throw new HttpError(401, "E-mail ou senha incorretos.");
  }
  await createSession(user.id, req.headers.get("user-agent"));
  await audit("login", { userId: user.id });
  return json({ ok: true, role: user.role });
});
