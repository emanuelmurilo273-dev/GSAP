import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { publicUrlFor, pathUrlFor } from "@/lib/publish";
import { hostingConfig } from "@/lib/previewHosting";
import { SitesClient } from "./SitesClient";
import Link from "next/link";

export default async function SitesPage() {
  const user = await pageUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, createdAt: true, updatedAt: true, content: true, company: { select: { name: true, city: true, category: true } }, publication: { select: { slug: true, status: true, visits: true, lastDeployAt: true, customDomain: true, customDomainVerifiedAt: true, externalUrl: true } } },
  });
  return (
    <>
      <PageHeader title="Prévia dos sites" subtitle="Uma prévia independente para cada empresa. Todas nascem privadas: revise, edite e só libere o link quando decidir." actions={<Link href="/app/leads" className="btn-primary">Criar prévia a partir de um lead</Link>} />
      {!hostingConfig() && (
        <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100">
          O link público ainda não está configurado: com o app só no seu computador, um link “localhost” não abre em outros aparelhos. Veja <a href="/app/configuracoes#link-publico" className="underline">Configurações → Link público das prévias</a>.
        </div>
      )}
      <SitesClient
        premium={user.access.premium}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          company: p.company?.name ?? null,
          place: [p.company?.category, p.company?.city].filter(Boolean).join(" · "),
          concept: (() => { const k = (p.content as { concept?: { name: string; palette: Record<string, string>; display: string } } | null)?.concept; return k ? { name: k.name, palette: Object.values(k.palette), display: k.display } : null; })(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          status: p.publication?.status ?? "DRAFT",
          url: p.publication ? p.publication.externalUrl ?? publicUrlFor(p.publication.slug, p.publication.customDomain, !!p.publication.customDomainVerifiedAt) : null,
          external: !!p.publication?.externalUrl,
          pathUrl: p.publication ? pathUrlFor(p.publication.slug) : null,
          visits: p.publication?.visits ?? 0,
          lastDeployAt: p.publication?.lastDeployAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
