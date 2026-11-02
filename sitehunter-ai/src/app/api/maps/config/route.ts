import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { env } from "@/lib/env";

/**
 * Entrega a chave de NAVEGADOR da Maps JavaScript API apenas a usuários logados,
 * em tempo de execução (não fica embutida no código do site).
 * Essa chave é pública por natureza: restrinja-a por referenciador HTTP no Google Cloud.
 */
export const GET = route(async () => {
  await requireUser();
  const key = env.googleMapsBrowserKey;
  return json({ configured: !!key, browserKey: key ?? null, mapId: env.googleMapsMapId ?? null, servicesConfigured: !!env.googleMapsServerKey });
});
