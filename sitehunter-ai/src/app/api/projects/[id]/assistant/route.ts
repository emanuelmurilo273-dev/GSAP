import { z } from "zod";
import { requirePremium } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { assistantConfigured } from "@/lib/assistant";
import { EditBody, applyChanges, proposeSiteEdit } from "@/lib/siteEdit";
import { ownProject } from "@/lib/projects";
import { log } from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

/** Claude propõe edições de texto para o site aberto no editor. Nada é salvo aqui: a pessoa aplica e salva no editor. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requirePremium();
  const { id } = await params;
  await ownProject(user.id, id);
  if (!assistantConfigured()) throw new HttpError(503, "O Claude ainda não está configurado neste servidor.", "assistant_not_configured");
  await rateLimit(`site-edit:${user.id}`, 20, 600);
  const b = await parseJson(req, EditBody);
  try {
    return json({ proposal: await proposeSiteEdit(b.content, b.instruction) });
  } catch (e) {
    log("warn", "site_edit_failed", { error: e instanceof Error ? e.message : String(e) });
    throw new HttpError(502, "Não foi possível falar com o Claude agora. Tente de novo em instantes.", "assistant_failed");
  }
});

// Aplicar é feito no navegador sobre o conteúdo aberto; este endpoint valida o resultado para não salvar texto fora do schema.
const Apply = z.object({ content: EditBody.shape.content, changes: z.array(z.object({ path: z.string().max(200), after: z.string().max(2000) })).max(60) });
export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requirePremium();
  await ownProject(user.id, (await params).id);
  const b = await parseJson(req, Apply);
  return json({ content: applyChanges(b.content, b.changes) });
});
