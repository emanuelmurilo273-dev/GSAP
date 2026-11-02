import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runSubscriptionSweep } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/** Rotina periódica (chamar a cada hora): suspensões, retenção e limpeza. */
export async function POST(req: Request) {
  const secret = env.cronSecret;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await runSubscriptionSweep();
  return NextResponse.json({ ok: true, ...r });
}
