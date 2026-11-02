import { resolve4, resolveCname } from "node:dns/promises";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePremium } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { ownProject } from "@/lib/projects";
import { isValidDomain } from "@/lib/slug";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ domain: z.string().trim().toLowerCase().max(253) });

async function pub(userId: string, id: string) {
  const p = await ownProject(userId, id);
  if (!p.publication) throw new HttpError(400, "Publique o site antes de conectar um domínio próprio.");
  return p.publication;
}

/** Define o domínio próprio (pendente de verificação de DNS). */
export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requirePremium();
  const publication = await pub(user.id, (await params).id);
  const { domain } = await parseJson(req, Body);
  const d = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!isValidDomain(d)) throw new HttpError(400, "Domínio inválido. Exemplo: www.empresa.com.br");
  if (d === env.rootDomain || d.endsWith("." + env.rootDomain)) throw new HttpError(400, "Use um domínio próprio da empresa.");
  const taken = await prisma.publication.findUnique({ where: { customDomain: d } });
  if (taken && taken.id !== publication.id) throw new HttpError(409, "Este domínio já está conectado a outro site.");
  await prisma.publication.update({ where: { id: publication.id }, data: { customDomain: d, customDomainVerifiedAt: null } });
  return json({ ok: true, domain: d, target: `sites.${env.rootDomain}` });
});

/** Verifica se o DNS do domínio aponta para a plataforma. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requirePremium();
  await rateLimit(`dns:${user.id}`, 10, 60);
  const publication = await pub(user.id, (await params).id);
  const d = publication.customDomain;
  if (!d) throw new HttpError(400, "Nenhum domínio definido.");
  const target = `sites.${env.rootDomain}`;
  let ok = false;
  try {
    const cnames = await resolveCname(d).catch(() => [] as string[]);
    if (cnames.some((c) => c.replace(/\.$/, "") === target)) ok = true;
    if (!ok) {
      const [mine, theirs] = await Promise.all([env.serverIps.length ? Promise.resolve(env.serverIps) : resolve4(target).catch(() => []), resolve4(d).catch(() => [])]);
      ok = theirs.length > 0 && theirs.every((ip) => mine.includes(ip));
    }
  } catch {
    ok = false;
  }
  if (!ok) throw new HttpError(400, `O DNS de ${d} ainda não aponta para ${target}. A propagação pode levar algumas horas.`, "dns_pending");
  await prisma.publication.update({ where: { id: publication.id }, data: { customDomainVerifiedAt: new Date() } });
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requirePremium();
  const publication = await pub(user.id, (await params).id);
  await prisma.publication.update({ where: { id: publication.id }, data: { customDomain: null, customDomainVerifiedAt: null } });
  return json({ ok: true });
});
