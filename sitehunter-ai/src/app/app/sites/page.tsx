import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { publicUrlFor, pathUrlFor } from "@/lib/publish";
import { SitesClient } from "./SitesClient";
import Link from "next/link";

export default async function SitesPage() {
  const user = await pageUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, createdAt: true, updatedAt: true, company: { select: { name: true } }, publication: { select: { slug: true, status: true, visits: true, lastDeployAt: true, customDomain: true, customDomainVerifiedAt: true } } },
  });
  return (
    <>
      <PageHeader title="Meus sites" subtitle="Hospedagem incluída enquanto sua assinatura estiver ativa." actions={<Link href="/app/empresas" className="btn-primary">Novo site</Link>} />
      <SitesClient
        premium={user.access.premium}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          company: p.company?.name ?? null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          status: p.publication?.status ?? "DRAFT",
          url: p.publication ? publicUrlFor(p.publication.slug, p.publication.customDomain, !!p.publication.customDomainVerifiedAt) : null,
          pathUrl: p.publication ? pathUrlFor(p.publication.slug) : null,
          visits: p.publication?.visits ?? 0,
          lastDeployAt: p.publication?.lastDeployAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
