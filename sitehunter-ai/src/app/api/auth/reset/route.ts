import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { HttpError, clientIp, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { consumeToken } from "@/lib/authEmails";
import { audit } from "@/lib/logger";

const Body = z.object({ token: z.string().min(10).max(200), password: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres").max(200) });

export const POST = route(async (req) => {
  await rateLimit(`reset:${clientIp(req)}`, 10, 3600);
  const body = await parseJson(req, Body);
  const userId = await consumeToken(body.token, "PASSWORD_RESET");
  if (!userId) throw new HttpError(400, "Link inválido ou expirado. Solicite um novo.");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(body.password), emailVerifiedAt: new Date() } });
  // O link chegou pelo e-mail, então o e-mail fica confirmado.
  // Encerra todas as sessões abertas após a troca de senha.
  await prisma.session.deleteMany({ where: { userId } });
  await audit("password_reset", { userId });
  return json({ ok: true });
});
