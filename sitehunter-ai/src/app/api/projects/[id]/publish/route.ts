import { z } from "zod";
import { requirePremium, requireUser } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { ownProject } from "@/lib/projects";
import { pathUrlFor, publicUrlFor, publishProject, unpublishProject } from "@/lib/publish";
import { rateLimit } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ slug: z.string().trim().max(48).optional() });

/** Publicar / Atualizar site. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requirePremium();
  await rateLimit(`publish:${user.id}`, 20, 60);
  const { id } = await params;
  const project = await ownProject(user.id, id);
  const b = await parseJson(req, Body);
  const pub = await publishProject(project, user.id, b.slug);
  return json({ publication: { ...pub, html: undefined, url: publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt), pathUrl: pathUrlFor(pub.slug) } });
});

/** Despublicar: permitido mesmo sem assinatura ativa. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await unpublishProject(id, user.id);
  return json({ ok: true });
});
