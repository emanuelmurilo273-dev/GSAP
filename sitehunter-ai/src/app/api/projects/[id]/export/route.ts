import { requireUser } from "@/lib/auth";
import { HttpError, route } from "@/lib/http";
import { ownProject } from "@/lib/projects";
import { exportSiteZip } from "@/lib/exportSite";
import { SiteContentSchema } from "@/lib/site/types";
import { slugify } from "@/lib/slug";

/** Exportar arquivos do site — disponível também durante o período de retenção. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await ownProject(user.id, (await params).id);
  const parsed = SiteContentSchema.safeParse(project.content);
  if (!parsed.success) throw new HttpError(400, "Conteúdo inválido.");
  const zip = await exportSiteZip(parsed.data);
  return new Response(Buffer.from(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slugify(project.name) || "site"}.zip"` },
  });
});
