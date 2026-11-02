import { prisma } from "./db";
import type { PlatformSettings } from "@prisma/client";

export async function getSettings(): Promise<PlatformSettings> {
  return prisma.platformSettings.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} });
}

export function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}
