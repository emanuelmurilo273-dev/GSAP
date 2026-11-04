import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Exporta o rascunho como .txt ou .md para o usuário enviar por conta própria. */
export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const d = await prisma.outreachDraft.findFirst({ where: { id: (await params).id, userId: user.id }, include: { company: { select: { name: true, isDemo: true } } } });
  if (!d) throw new HttpError(404, "Rascunho não encontrado.");
  const format = new URL(req.url).searchParams.get("format") === "md" ? "md" : "txt";
  const facts = ((d.factsUsed ?? []) as { field: string; value: string; source: string }[]).map((f) => `- ${f.value} (fonte: ${f.source})`).join("\n");
  const demo = d.company.isDemo ? "ATENÇÃO: lead de demonstração com dados fictícios.\n\n" : "";
  const body =
    format === "md"
      ? `${demo}# ${d.subject}\n\n${d.body}\n\n---\nFatos citados:\n${facts || "- (nenhum)"}\n\nRascunho gerado pelo SiteHunter AI. Revise antes de enviar; nada foi enviado automaticamente.\n`
      : `${demo}Assunto: ${d.subject}\n\n${d.body}\n`;
  const slug = d.company.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return new Response(body, {
    headers: { "Content-Type": `${format === "md" ? "text/markdown" : "text/plain"}; charset=utf-8`, "Content-Disposition": `attachment; filename="abordagem-${slug}-${d.language}.${format}"` },
  });
});
