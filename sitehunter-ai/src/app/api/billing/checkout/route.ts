import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { checkoutUrlFor } from "@/lib/kiwify";
import { audit } from "@/lib/logger";

/** "Assinar agora": redireciona ao checkout real da Kiwify com a referência da conta. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/cadastro?next=/app/assinatura", env.appUrl));
  const settings = await getSettings();
  const base = settings.checkoutUrl ?? env.kiwifyCheckoutUrl;
  if (!base) return NextResponse.redirect(new URL("/app/assinatura?erro=checkout", env.appUrl));
  await audit("checkout_started", { userId: user.id });
  return NextResponse.redirect(checkoutUrlFor(base, user));
}
