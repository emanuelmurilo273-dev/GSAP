import { env } from "./env";
import { HttpError } from "./http";
import { log } from "./logger";

// Google Places API (New) — Text Search e Place Details.
// Documentação: https://developers.google.com/maps/documentation/places/web-service/text-search

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.location",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.regularOpeningHours",
  "places.photos",
  "nextPageToken",
].join(",");

export type PlaceResult = {
  sourceId: string;
  name: string;
  category: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  websiteKind: "none" | "social" | "site";
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  businessStatus: string | null;
  hours: string[];
  photos: PlacePhoto[];
};

/** Referência a uma foto do Google (o arquivo não é baixado nem armazenado). */
export type PlacePhoto = { name: string; widthPx: number; heightPx: number; author: string; authorUri: string };

const SOCIAL = /(^|\.)(instagram\.com|facebook\.com|fb\.com|linktr\.ee|wa\.me|whatsapp\.com|tiktok\.com|ifood\.com\.br|linkedin\.com|youtube\.com)$/i;

export function classifyWebsite(url: string | null | undefined): PlaceResult["websiteKind"] {
  if (!url) return "none";
  try {
    return SOCIAL.test(new URL(url).hostname) ? "social" : "site";
  } catch {
    return "site";
  }
}

type GPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name: string; widthPx?: number; heightPx?: number; authorAttributions?: { displayName?: string; uri?: string }[] }[];
};

export function mapPlace(p: GPlace): PlaceResult {
  const comp = (type: string, short = false) => {
    const c = p.addressComponents?.find((a) => a.types?.includes(type));
    return (short ? c?.shortText : c?.longText) ?? null;
  };
  return {
    sourceId: p.id,
    name: p.displayName?.text ?? "(sem nome)",
    category: p.primaryTypeDisplayName?.text ?? null,
    address: p.formattedAddress ?? null,
    neighborhood: comp("sublocality_level_1") ?? comp("sublocality") ?? comp("neighborhood"),
    city: comp("administrative_area_level_2") ?? comp("locality"),
    state: comp("administrative_area_level_1", true),
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    websiteKind: classifyWebsite(p.websiteUri),
    mapsUrl: p.googleMapsUri ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    businessStatus: p.businessStatus ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    photos: (p.photos ?? []).slice(0, 10).map((ph) => ({
      name: ph.name,
      widthPx: ph.widthPx ?? 0,
      heightPx: ph.heightPx ?? 0,
      author: ph.authorAttributions?.[0]?.displayName ?? "",
      authorUri: ph.authorAttributions?.[0]?.uri ?? "",
    })),
  };
}

export async function searchPlaces(params: { textQuery: string; includedType?: string; pageToken?: string; near?: { lat: number; lng: number; radiusMeters?: number } }) {
  const key = env.googlePlacesKey;
  if (!key) throw new HttpError(503, "A busca de empresas ainda não foi configurada (GOOGLE_MAPS_SERVER_KEY).", "not_configured");
  const body: Record<string, unknown> = { textQuery: params.textQuery, languageCode: "pt-BR", regionCode: "BR", pageSize: 20 };
  if (params.includedType) body.includedType = params.includedType;
  if (params.pageToken) body.pageToken = params.pageToken;
  if (params.near) body.locationBias = { circle: { center: { latitude: params.near.lat, longitude: params.near.lng }, radius: Math.min(50000, params.near.radiusMeters ?? 5000) } };
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    log("error", "places_search_failed", { status: res.status, body: text.slice(0, 500) });
    throw new HttpError(502, "A fonte de dados de empresas não respondeu corretamente. Tente novamente.", "upstream");
  }
  const data = (await res.json()) as { places?: GPlace[]; nextPageToken?: string };
  return {
    results: (data.places ?? []).filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY").map(mapPlace),
    nextPageToken: data.nextPageToken ?? null,
  };
}

export async function placeDetails(placeId: string): Promise<PlaceResult> {
  const key = env.googlePlacesKey;
  if (!key) throw new HttpError(503, "A busca de empresas ainda não foi configurada (GOOGLE_MAPS_SERVER_KEY).", "not_configured");
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS.split(",").filter((f) => f !== "nextPageToken").map((f) => f.replace("places.", "")).join(",") },
    cache: "no-store",
  });
  if (!res.ok) throw new HttpError(502, "Não foi possível atualizar os dados da empresa.", "upstream");
  return mapPlace((await res.json()) as GPlace);
}

/**
 * URL temporária de uma foto do Google (Place Photos, Places API New).
 * skipHttpRedirect=true devolve só o endereço da imagem na CDN do Google;
 * a imagem não passa pelo nosso servidor e não é armazenada.
 */
export async function placePhotoUri(photoName: string, maxWidthPx: number): Promise<string | null> {
  const key = env.googlePlacesKey;
  if (!key || !/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) return null;
  const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`, {
    headers: { "X-Goog-Api-Key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { photoUri?: string };
  return data.photoUri?.startsWith("https://") ? data.photoUri : null;
}
