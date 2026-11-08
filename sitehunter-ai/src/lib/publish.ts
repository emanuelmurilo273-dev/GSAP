import type { Project } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";
import { getSettings } from "./settings";
import { isValidSlug, slugify } from "./slug";
import { renderSite } from "./site/render";
import { SiteContentSchema } from "./site/types";
import { env } from "./env";
import { audit, log } from "./logger";
import { hostingConfig, publishExternal, unpublishExternal } from "./previewHosting";
import { VercelError, deployPreview, removePreview, vercelConfig } from "./vercel";
import { randomToken } from "./crypto";

export function publicUrlFor(slug: string, customDomain?: string | null, verified?: boolean) {
  if (customDomain && verified) return `https://${customDomain}`;
  const root = env.rootDomain;
  if (root.startsWith("localhost")) return `http://${slug}.${root}`;
  return `https://${slug}.${root}`;
}

/** Link para compartilhar com a empresa: o público fora do app (Vercel/GitHub) quando existe; senão o do próprio app. */
export function shareUrlFor(pub: { slug: string; customDomain?: string | null; customDomainVerifiedAt?: Date | null; externalUrl?: string | null }) {
  return pub.externalUrl ?? publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt);
}

export function pathUrlFor(slug: string) {
  return `${env.appUrl}/s/${slug}`;
}

async function uniqueSlug(desired: string, projectId: string) {
  let base = slugify(desired) || "site";
  if (base.length < 3) base = `${base}-site`;
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    if (isValidSlug(candidate)) {
      const taken = await prisma.publication.findUnique({ where: { slug: candidate } });
      if (!taken || taken.projectId === projectId) return candidate;
    }
    candidate = `${base.slice(0, 40)}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || i}`;
  }
  throw new HttpError(409, "Não foi possível gerar um endereço único. Escolha outro nome.");
}

/** Publica ou atualiza o site: gera o snapshot HTML a partir do conteúdo salvo. */
export async function publishProject(project: Project, userId: string, desiredSlug?: string) {
  const parsed = SiteContentSchema.safeParse(project.content);
  if (!parsed.success) throw new HttpError(400, "O conteúdo do site está inválido. Abra o editor e salve novamente.");
  const settings = await getSettings();
  const existing = await prisma.publication.findUnique({ where: { projectId: project.id } });

  if (existing?.status !== "PUBLISHED") {
    // Contagem e publicação na mesma transação serializada para respeitar o limite.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"publish:" + userId}))`;
      const live = await tx.publication.count({ where: { userId, status: "PUBLISHED" } });
      if (live >= settings.maxPublishedSites) {
        throw new HttpError(409, `Seu plano permite até ${settings.maxPublishedSites} sites publicados ao mesmo tempo. Despublique um site para publicar outro.`, "publish_limit");
      }
      await doPublish(tx as never);
    });
  } else {
    await doPublish(prisma);
  }

  async function doPublish(db: typeof prisma) {
    // three.js servido pelo próprio app (URL absoluta: o site publicado roda em origem isolada).
    const html = renderSite(parsed.data!, { footerCredit: true, threeSrc: `${env.appUrl}/vendor/three.min.js` });
    const now = new Date();
    if (existing) {
      let slug = existing.slug;
      if (desiredSlug && slugify(desiredSlug) !== existing.slug) slug = await uniqueSlug(desiredSlug, project.id);
      await db.publication.update({ where: { id: existing.id }, data: { slug, html, status: "PUBLISHED", lastDeployAt: now, publishedAt: existing.publishedAt ?? now, suspendedAt: null } });
    } else {
      const slug = await uniqueSlug(desiredSlug || parsed.data!.siteName || project.name, project.id);
      await db.publication.create({ data: { projectId: project.id, userId, slug, html, status: "PUBLISHED", publishedAt: now, lastDeployAt: now } });
    }
  }
  await audit(existing?.status === "PUBLISHED" ? "site_updated" : "site_published", { userId, meta: { projectId: project.id } });
  const pub = await prisma.publication.findUniqueOrThrow({ where: { projectId: project.id } });
  // Link público fora do app, para abrir em qualquer lugar (celular, WhatsApp) sem depender do localhost.
  // Vercel (API oficial) tem prioridade; o GitHub Pages continua valendo quando só ele está configurado.
  if (vercelConfig()) {
    try {
      const d = await deployPreview(parsed.data!, pub.slug, pub.vercelProject);
      return prisma.publication.update({ where: { id: pub.id }, data: { externalUrl: d!.url, externalProvider: "vercel", vercelProject: d!.project, externalVerifiedAt: d!.verified ? new Date() : null } });
    } catch (e) {
      log("error", "vercel_publish_failed", { status: e instanceof VercelError ? e.status : null, code: e instanceof VercelError ? e.code : null });
      throw new HttpError(502, e instanceof VercelError ? `A prévia foi liberada no app, mas o link público não foi atualizado. ${e.message}` : "A prévia foi liberada no app, mas o envio para a Vercel falhou. Tente de novo.");
    }
  }
  if (hostingConfig()) {
    try {
      const externalUrl = await publishExternal(parsed.data!, pub.slug);
      return prisma.publication.update({ where: { id: pub.id }, data: { externalUrl, externalProvider: "github", vercelProject: null, externalVerifiedAt: null } });
    } catch (e) {
      log("error", "external_publish_failed", { error: String(e).slice(0, 300) });
      throw new HttpError(502, "A prévia foi liberada no app, mas o envio para o link público (GitHub) falhou. Confira GITHUB_PREVIEWS_TOKEN e GITHUB_PREVIEWS_REPO em Configurações.");
    }
  }
  return pub;
}

export async function unpublishProject(projectId: string, userId: string) {
  const pub = await prisma.publication.findFirst({ where: { projectId, userId } });
  if (!pub) throw new HttpError(404, "Este site ainda não foi publicado.");
  await prisma.publication.update({ where: { id: pub.id }, data: { status: "UNPUBLISHED", externalUrl: null, externalProvider: null, externalVerifiedAt: null } });
  if (pub.vercelProject) await removePreview(pub.vercelProject).catch((e) => log("warn", "vercel_remove_failed", { error: String(e).slice(0, 200) }));
  await unpublishExternal(pub.slug).catch((e) => log("warn", "external_unpublish_failed", { error: String(e).slice(0, 200) }));
  await audit("site_unpublished", { userId, meta: { projectId } });
}
