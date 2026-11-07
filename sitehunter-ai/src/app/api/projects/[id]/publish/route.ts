import { z } from "zod";
import { requirePremium, requireUser } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { ownProject } from "@/lib/projects";
import { pathUrlFor, publicUrlFor, publishProject, unpublishProject } from "@/lib/publish";
import { rateLimit } from "@/lib/rateLimit";
import { HttpError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
// confirmPublic: a liberação do link público é sempre um pedido explícito do proprietário.
const Body = z.object({ slug: z.string().trim().max(48).optional(), confirmPublic: z.boolean().optional() });

/** Publicar / Atualizar site. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requirePremium();
  await rateLimit(`publish:${user.id}`, 20, 60);
  const { id } = await params;
  const project = await ownProject(user.id, id);
  const b = await parseJson(req, Body);
  if (b.confirmPublic !== true) throw new HttpError(400, "Confirme a liberação do link público.", "confirmation_required");
  const pub = await publishProject(project, user.id, b.slug);
  // Link para compartilhar: o público fora do app (GitHub) quando configurado; senão o do próprio app.
  return json({ publication: { ...pub, html: undefined, url: pub.externalUrl ?? publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt), appUrl: publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt), externalUrl: pub.externalUrl, pathUrl: pathUrlFor(pub.slug) } });
});

/** Despublicar: permitido mesmo sem assinatura ativa. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await unpublishProject(id, user.id);
  return json({ ok: true });
});
