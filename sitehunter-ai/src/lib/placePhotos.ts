import { prisma } from "./db";
import { placeDetails, placePhotoUri, type PlacePhoto } from "./places";
import { log } from "./logger";

// Fotos do estabelecimento vindas do Google (Place Photos).
// - A chave nunca vai ao navegador: o site pede /api/place-photo/<empresa>/<n>?w=<largura>
//   e recebe um redirecionamento para a imagem na CDN do Google.
// - Nenhum arquivo de imagem é baixado ou armazenado; só a URL temporária fica
//   em memória por alguns minutos para não repetir chamadas pagas.
// - A autoria exigida pelo Google é exibida junto de cada foto no site.

export const PHOTO_WIDTHS = [480, 960, 1600] as const;
export const snapWidth = (w: number) => PHOTO_WIDTHS.find((x) => x >= w) ?? 1600;

const cache = new Map<string, { uri: string; exp: number }>();
const TTL = 30 * 60_000;

export function photoUrl(appUrl: string, companyId: string, index: number) {
  return `${appUrl}/api/place-photo/${companyId}/${index}`;
}

export async function resolvePlacePhoto(companyId: string, index: number, width: number): Promise<string | null> {
  const w = snapWidth(width);
  const key = `${companyId}:${index}:${w}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.uri;

  // Só empresas que já têm um site gerado (evita uso da rota como proxy genérico).
  const company = await prisma.company.findFirst({ where: { id: companyId, projects: { some: {} } }, select: { id: true, sourceId: true, photos: true } });
  if (!company) return null;
  let photos = (company.photos as PlacePhoto[] | null) ?? [];
  const photo = photos[index];
  if (!photo) return null;

  let uri = await placePhotoUri(photo.name, w);
  if (!uri) {
    // Referências de foto expiram: atualiza a lista na fonte e tenta de novo uma vez.
    try {
      const fresh = await placeDetails(company.sourceId);
      photos = fresh.photos;
      await prisma.company.update({ where: { id: company.id }, data: { photos: photos as never } });
      if (photos[index]) uri = await placePhotoUri(photos[index]!.name, w);
    } catch (e) {
      log("warn", "place_photo_refresh_failed", { companyId, error: String(e) });
    }
  }
  if (!uri) return null;
  if (cache.size > 5000) cache.clear();
  cache.set(key, { uri, exp: Date.now() + TTL });
  return uri;
}
