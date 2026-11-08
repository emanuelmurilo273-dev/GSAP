import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { ownProject } from "@/lib/projects";
import { generateOutreach } from "@/lib/ai";
import { getSegment } from "@/lib/site/templates";
import { publicUrlFor, shareUrlFor } from "@/lib/publish";
import { whatsappLink } from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

/** "Preparar mensagem de abordagem" — gera o texto; o envio é sempre manual. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requirePremium();
  await rateLimit(`outreach:${user.id}`, 15, 60);
  const project = await ownProject(user.id, (await params).id);
  if (!project.company) throw new HttpError(400, "Este projeto não está associado a uma empresa.");
  const pub = project.publication;
  const previewUrl = pub?.status === "PUBLISHED" ? shareUrlFor(pub) : null;
  const { message, ai } = await generateOutreach(project.company, getSegment(project.segment), { senderName: user.name.split(" ")[0] ?? user.name, previewUrl });
  await prisma.project.update({ where: { id: project.id }, data: { outreachMessage: message } });
  return json({ message, ai, whatsapp: whatsappLink(project.company.phone, message) });
});

const Save = z.object({ message: z.string().max(1500) });
export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requirePremium();
  const project = await ownProject(user.id, (await params).id);
  const { message } = await parseJson(req, Save);
  await prisma.project.update({ where: { id: project.id }, data: { outreachMessage: message } });
  return json({ ok: true, whatsapp: whatsappLink(project.company?.phone, message) });
});
