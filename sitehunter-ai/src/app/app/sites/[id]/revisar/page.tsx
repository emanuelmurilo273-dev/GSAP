import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { renderSite } from "@/lib/site/render";
import { SiteContentSchema } from "@/lib/site/types";
import { ReviewViewer } from "./ReviewViewer";

/** Revisão em tela cheia de uma prévia (privada): computador ou celular, com o conceito ao lado. */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, userId: user.id }, include: { publication: { select: { status: true } }, company: { select: { id: true, name: true } } } });
  if (!p) notFound();
  const parsed = SiteContentSchema.safeParse(p.content);
  if (!parsed.success) notFound();
  const c = parsed.data;
  const html = renderSite(c, { footerCredit: false, previewRibbon: p.publication?.status === "PUBLISHED" ? null : "Prévia privada · não publicada" });
  return (
    <div className="space-y-4">
      <Link href="/app/sites" className="text-sm text-slate-400 hover:text-white">← Prévia dos sites</Link>
      <ReviewViewer
        html={html}
        name={p.company?.name ?? p.name}
        projectId={p.id}
        leadId={p.company?.id ?? null}
        published={p.publication?.status === "PUBLISHED"}
        concept={c.concept ? { name: c.concept.name, summary: c.concept.summary, reasons: c.concept.reasons } : null}
        notes={c.reviewNotes}
      />
    </div>
  );
}
