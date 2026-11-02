import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { consumeToken } from "@/lib/authEmails";

const Body = z.object({ token: z.string().min(10).max(200) });

export const POST = route(async (req) => {
  const { token } = await parseJson(req, Body);
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) throw new HttpError(400, "Link inválido ou expirado.");
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return json({ ok: true });
});
