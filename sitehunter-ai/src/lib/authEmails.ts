import type { User } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { sendEmail } from "./email";
import { env } from "./env";

export async function issueToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlMinutes: number) {
  const token = randomToken(32);
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return token;
}

/** Consome um token de uso único. Retorna o userId ou null se inválido/expirado. */
export async function consumeToken(token: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET") {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const res = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return res.count === 1 ? row.userId : null;
}

export async function sendVerificationEmail(user: Pick<User, "id" | "email" | "name" | "emailVerifiedAt">) {
  if (user.emailVerifiedAt) return;
  const token = await issueToken(user.id, "EMAIL_VERIFY", 60 * 48);
  await sendEmail(
    user.email,
    "Confirme seu e-mail — SiteHunter AI",
    `Olá, ${user.name}!\n\nConfirme seu e-mail clicando no link abaixo (válido por 48 horas):\n${env.appUrl}/verificar-email?token=${token}\n\nSe você não criou esta conta, ignore esta mensagem.`,
  );
}

export async function sendPasswordResetEmail(user: Pick<User, "id" | "email" | "name">) {
  const token = await issueToken(user.id, "PASSWORD_RESET", 60);
  await sendEmail(
    user.email,
    "Redefinição de senha — SiteHunter AI",
    `Olá, ${user.name}.\n\nRecebemos um pedido para redefinir sua senha. Use o link abaixo (válido por 1 hora):\n${env.appUrl}/redefinir-senha?token=${token}\n\nSe você não fez esse pedido, ignore esta mensagem — sua senha continua a mesma.`,
  );
}
