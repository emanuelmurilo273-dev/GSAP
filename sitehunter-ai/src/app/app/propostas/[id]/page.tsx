import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { ProposalContentSchema, proposalToText } from "@/lib/proposal";
import { ProposalEditor } from "./ProposalEditor";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const p = await prisma.proposal.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!p) notFound();
  const content = ProposalContentSchema.parse(p.content);
  return <ProposalEditor id={p.id} title={p.title} initial={content} initialText={proposalToText(content)} projectId={p.projectId} />;
}
