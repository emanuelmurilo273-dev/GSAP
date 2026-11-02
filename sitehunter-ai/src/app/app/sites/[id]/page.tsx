import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { SiteContentSchema } from "@/lib/site/types";
import { publicUrlFor, pathUrlFor } from "@/lib/publish";
import { env } from "@/lib/env";
import { imagesConfigured } from "@/lib/images";
import { whatsappLink } from "@/lib/whatsapp";
import { Editor } from "./Editor";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id }, include: { publication: true, company: true } });
  if (!project) notFound();
  const parsed = SiteContentSchema.safeParse(project.content);
  if (!parsed.success) notFound();
  const pub = project.publication;
  return (
    <Editor
      projectId={project.id}
      projectName={project.name}
      initialContent={parsed.data}
      aiGenerated={project.aiGenerated}
      premium={user.access.premium}
      imagesEnabled={imagesConfigured()}
      rootDomain={env.rootDomain}
      companyPhone={project.company?.phone ?? null}
      initialOutreach={project.outreachMessage ?? ""}
      initialWhatsapp={whatsappLink(project.company?.phone, project.outreachMessage ?? undefined)}
      publication={
        pub
          ? {
              status: pub.status,
              slug: pub.slug,
              url: publicUrlFor(pub.slug, pub.customDomain, !!pub.customDomainVerifiedAt),
              pathUrl: pathUrlFor(pub.slug),
              customDomain: pub.customDomain,
              customDomainVerified: !!pub.customDomainVerifiedAt,
              lastDeployAt: pub.lastDeployAt?.toISOString() ?? null,
            }
          : null
      }
      updatedAt={project.updatedAt.toISOString()}
    />
  );
}
