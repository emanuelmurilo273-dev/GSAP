import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { HttpError, clientIp, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/lib/env";
import { audit } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/authEmails";
import { linkPendingPayments } from "@/lib/kiwify";

const Body = z.object({
  name: z.string().trim().min(2, "informe seu nome").max(80),
  email: z.string().trim().toLowerCase().email("e-mail inválido").max(160),
  password: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres").max(200),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "aceite os Termos de Uso e a Política de Privacidade" }) }),
});

export const POST = route(async (req) => {
  await rateLimit(`register:${clientIp(req)}`, 5, 3600);
  const body = await parseJson(req, Body);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new HttpError(409, "Já existe uma conta com este e-mail.");
  const isAdmin = env.adminEmails.includes(body.email);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: isAdmin ? "ADMIN" : "SUBSCRIBER",
      subscription: { create: { status: "NONE" } },
    },
  });
  await audit("user_registered", { userId: user.id });
  await sendVerificationEmail(user).catch(() => undefined);
  // Pagamento feito antes do cadastro com o mesmo e-mail → vincula agora.
  await linkPendingPayments(user.id, { email: user.email });
  await createSession(user.id, req.headers.get("user-agent"));
  return json({ ok: true }, 201);
});
