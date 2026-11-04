import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { sendPasswordResetEmail } from "@/lib/authEmails";
import { mayAuthenticate } from "@/lib/owner";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(160) });

export const POST = route(async (req) => {
  await rateLimit(`forgot:${clientIp(req)}`, 5, 3600);
  const { email } = await parseJson(req, Body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Modo privado: só a conta proprietária pode redefinir a senha.
  if (user && mayAuthenticate(user)) await sendPasswordResetEmail(user);
  // Resposta idêntica exista ou não a conta (evita descobrir e-mails cadastrados).
  return json({ ok: true });
});
