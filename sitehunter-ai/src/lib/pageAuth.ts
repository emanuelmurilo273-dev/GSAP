import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

/** Para páginas (server components): exige login e, opcionalmente, administrador. */
export async function pageUser(opts: { admin?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (opts.admin && user.role !== "ADMIN") redirect("/app");
  return user;
}
