import type { User } from "@prisma/client";

// Regra única de "quem pode usar o painel" no modo privado. Vale para páginas,
// APIs e a geração de conteúdo, porque é aplicada dentro de getCurrentUser():
// qualquer outra conta é tratada como não autenticada no servidor.

export function accessMode(): "private" | "saas" {
  return process.env.ACCESS_MODE?.trim() === "saas" ? "saas" : "private";
}

export function isPrivateMode() {
  return accessMode() === "private";
}

export function isOwner(user: Pick<User, "role" | "email">): boolean {
  if (user.role !== "ADMIN") return false;
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return owner ? user.email.toLowerCase() === owner : true;
}

/** No modo privado, só o proprietário pode ter sessão. */
export function mayAuthenticate(user: Pick<User, "role" | "email" | "adminSuspendedAt">): boolean {
  if (!isPrivateMode()) return true;
  return isOwner(user) && !user.adminSuspendedAt;
}

export const MIN_OWNER_PASSWORD = 12;
