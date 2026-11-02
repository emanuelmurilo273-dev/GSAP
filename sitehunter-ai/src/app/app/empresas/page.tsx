import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { SEGMENTS } from "@/lib/site/templates";
import { CompaniesClient } from "./CompaniesClient";

export default async function CompaniesPage() {
  const user = await pageUser();
  const companies = await prisma.company.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { projects: { select: { id: true } } },
  });
  return (
    <>
      <PageHeader title="Empresas salvas" subtitle="Revise as empresas antes de criar sites ou entrar em contato." actions={<Link href="/app/buscar" className="btn-primary">Buscar mais</Link>} />
      <CompaniesClient
        premium={user.access.premium}
        segments={SEGMENTS.map((s) => ({ key: s.key, label: s.label }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name, category: c.category, address: c.address, phone: c.phone, website: c.website, mapsUrl: c.mapsUrl, notes: c.notes, fetchedAt: c.fetchedAt.toISOString(), researchedAt: c.researchedAt?.toISOString() ?? null, projectId: c.projects[0]?.id ?? null }))}
      />
    </>
  );
}
