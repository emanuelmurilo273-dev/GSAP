import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { newImageId } from "@/lib/leads/leadImages";
import type { ImageCandidate } from "@/lib/leads/types";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const c = await prisma.company.findFirst({ where: { id, userId }, select: { id: true, images: true } });
  if (!c) throw new HttpError(404, "Lead não encontrado.");
  return { id: c.id, images: (c.images ?? []) as ImageCandidate[] };
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  return json({ images: (await own(user.id, (await params).id)).images });
});

const Review = z.object({
  imageId: z.string().min(1).max(40),
  status: z.enum(["approved", "rejected", "candidate"]),
  // Imagens da própria empresa: aprovar exige declarar que há autorização dela.
  confirmPermission: z.boolean().optional(),
  alt: z.string().max(200).optional(),
});

/** Revisão de uma imagem candidata (aprovar para o site, rejeitar, voltar a candidata). */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const c = await own(user.id, (await params).id);
  const b = await parseJson(req, Review);
  const img = c.images.find((i) => i.id === b.imageId);
  if (!img) throw new HttpError(404, "Imagem não encontrada.");
  if (b.status === "approved" && img.requiresPermission && b.confirmPermission !== true) {
    throw new HttpError(400, "Confirme que você tem autorização da empresa para usar esta imagem.", "permission_required");
  }
  img.status = b.status;
  img.approvedAt = b.status === "approved" ? new Date().toISOString() : null;
  if (b.status === "approved" && img.requiresPermission) img.note = "Autorização da empresa declarada pelo usuário.";
  if (b.alt !== undefined) img.alt = b.alt;
  await prisma.company.update({ where: { id: c.id }, data: { images: c.images as never } });
  return json({ images: c.images });
});

const Add = z.object({
  url: z.string().url().startsWith("https://").max(2000),
  thumb: z.string().url().max(2000).optional(),
  alt: z.string().max(200).default(""),
  credit: z.object({ name: z.string().max(120), link: z.string().url().max(2000) }),
  license: z.string().min(2).max(120),
  licenseUrl: z.string().url().max(500).nullable().optional(),
  source: z.string().min(2).max(80),
  sourceUrl: z.string().url().max(2000),
});

/** Adiciona uma imagem de banco com licença compatível (já aprovada, com crédito e licença). */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const c = await own(user.id, (await params).id);
  const b = await parseJson(req, Add);
  if (c.images.some((i) => i.url === b.url)) return json({ images: c.images });
  if (c.images.length >= 40) throw new HttpError(400, "Limite de imagens por lead atingido.");
  c.images.push({ id: newImageId(), url: b.url, thumb: b.thumb ?? b.url, alt: b.alt, origin: "stock", source: b.source, sourceUrl: b.sourceUrl, license: b.license, licenseUrl: b.licenseUrl ?? null, credit: b.credit, status: "approved", requiresPermission: false, approvedAt: new Date().toISOString() });
  await prisma.company.update({ where: { id: c.id }, data: { images: c.images as never } });
  return json({ images: c.images }, 201);
});
