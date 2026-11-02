import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, route } from "@/lib/http";
import { ProposalContentSchema, proposalToText } from "@/lib/proposal";
import { proposalPdf } from "@/lib/pdf";
import { slugify } from "@/lib/slug";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const p = await prisma.proposal.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!p) throw new HttpError(404, "Proposta não encontrada.");
  const content = ProposalContentSchema.parse(p.content);
  const pdf = await proposalPdf(content, proposalToText(content));
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="proposta-${slugify(content.companyName) || "site"}.pdf"` },
  });
});
