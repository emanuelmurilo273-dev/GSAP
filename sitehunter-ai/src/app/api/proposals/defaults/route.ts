import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { ProposalDefaultsSchema } from "@/lib/proposal";

/** Preços e condições padrão do usuário (configuráveis por ele). */
export const GET = route(async () => {
  const user = await requireUser();
  return json({ defaults: ProposalDefaultsSchema.parse(user.proposalDefaults ?? {}) });
});

export const PUT = route(async (req) => {
  const user = await requireUser();
  const defaults = await parseJson(req, ProposalDefaultsSchema);
  await prisma.user.update({ where: { id: user.id }, data: { proposalDefaults: defaults } });
  return json({ defaults });
});
