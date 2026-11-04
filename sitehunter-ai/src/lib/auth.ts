import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { User, Subscription } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { HttpError } from "./http";
import { computeAccess, type Access } from "./access";
import { getSettings } from "./settings";
import { mayAuthenticate } from "./owner";

export const SESSION_COOKIE = "sh_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({ data: { userId, tokenHash: sha256(token), expiresAt, userAgent: userAgent?.slice(0, 200) } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    // Sem "domain": o cookie é exclusivo do domínio do painel e nunca é
    // enviado aos subdomínios dos sites publicados.
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = User & { subscription: Subscription | null; access: Access };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { subscription: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  // Modo privado: qualquer conta que não seja a proprietária não tem acesso, mesmo com sessão válida.
  if (!mayAuthenticate(session.user)) return null;
  const settings = await getSettings();
  const access = computeAccess(session.user, session.user.subscription, settings);
  return { ...session.user, access };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Faça login para continuar.", "unauthenticated");
  return u;
}

/** Exige assinatura Premium ativa (verificado no servidor a cada requisição). */
export async function requirePremium(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.access.premium) {
    throw new HttpError(402, u.access.message, "premium_required", { reason: u.access.reason });
  }
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new HttpError(403, "Acesso restrito ao administrador.", "forbidden");
  return u;
}

export function publicUser(u: CurrentUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerified: !!u.emailVerifiedAt,
    access: u.access,
    subscription: u.subscription && {
      status: u.subscription.status,
      currentPeriodEnd: u.subscription.currentPeriodEnd,
      retentionUntil: u.subscription.retentionUntil,
    },
  };
}
