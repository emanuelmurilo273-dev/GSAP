import { env } from "./env";
import { HttpError } from "./http";
import { log } from "./logger";

// Serviços do Google Maps Platform chamados SOMENTE pelo servidor:
// - Geocoding API: https://developers.google.com/maps/documentation/geocoding
// - Routes API (computeRoutes): https://developers.google.com/maps/documentation/routes
// A chave de servidor nunca é enviada ao navegador.

export type LatLng = { lat: number; lng: number };
export type GeocodeResult = { formattedAddress: string; lat: number; lng: number; placeId: string | null; types: string[] };
export type TravelMode = "DRIVE" | "WALK" | "BICYCLE" | "TWO_WHEELER" | "TRANSIT";
export type RouteResult = { distanceMeters: number; durationSeconds: number; distanceText: string; durationText: string; polyline: string; warnings: string[] };

function serverKey() {
  const k = env.googleMapsServerKey;
  if (!k) throw new HttpError(503, "O Google Maps ainda não foi configurado no servidor (GOOGLE_MAPS_SERVER_KEY).", "maps_not_configured");
  return k;
}

const GEOCODE_ERRORS: Record<string, [number, string]> = {
  ZERO_RESULTS: [404, "Endereço não encontrado. Confira a grafia ou inclua a cidade."],
  OVER_QUERY_LIMIT: [503, "Limite de consultas do Google Maps atingido. Tente em alguns minutos."],
  OVER_DAILY_LIMIT: [503, "Limite diário do Google Maps atingido ou faturamento desativado."],
  REQUEST_DENIED: [503, "O Google recusou a consulta. Verifique se a Geocoding API está ativada para a chave do servidor."],
  INVALID_REQUEST: [400, "Endereço inválido."],
};

export async function geocode(params: { address: string } | LatLng): Promise<GeocodeResult[]> {
  const q = new URLSearchParams({ key: serverKey(), language: "pt-BR", region: "br" });
  if ("address" in params) {
    q.set("address", params.address);
    q.set("components", "country:BR");
  } else q.set("latlng", `${params.lat},${params.lng}`);
  let res: Response;
  try {
    res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${q}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new HttpError(502, "Não foi possível falar com o Google Maps. Tente novamente.", "maps_unreachable");
  }
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    error_message?: string;
    results?: { formatted_address: string; place_id?: string; types?: string[]; geometry: { location: { lat: number; lng: number } } }[];
  };
  if (data.status !== "OK") {
    const [status, msg] = GEOCODE_ERRORS[data.status ?? ""] ?? [502, "Falha ao consultar o endereço."];
    if (status >= 500) log("error", "geocode_failed", { status: data.status, message: data.error_message });
    throw new HttpError(status, msg, "geocode_" + (data.status ?? "error").toLowerCase());
  }
  return (data.results ?? []).slice(0, 5).map((r) => ({
    formattedAddress: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    placeId: r.place_id ?? null,
    types: r.types ?? [],
  }));
}

function fmtDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}
function fmtDuration(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60 ? `${min % 60} min` : ""}`.trim();
}

export async function computeRoute(origin: LatLng, destination: LatLng, mode: TravelMode = "DRIVE"): Promise<RouteResult> {
  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: mode,
    languageCode: "pt-BR",
    regionCode: "BR",
    units: "METRIC",
  };
  if (mode === "DRIVE" || mode === "TWO_WHEELER") body.routingPreference = "TRAFFIC_AWARE";
  let res: Response;
  try {
    res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": serverKey(),
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.warnings",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new HttpError(502, "Não foi possível falar com o Google Maps. Tente novamente.", "maps_unreachable");
  }
  if (!res.ok) {
    const text = await res.text();
    log("error", "routes_failed", { status: res.status, body: text.slice(0, 400) });
    if (res.status === 403) throw new HttpError(503, "O Google recusou o cálculo de rota. Verifique se a Routes API está ativada para a chave do servidor.", "routes_denied");
    if (res.status === 429) throw new HttpError(503, "Limite de consultas de rota atingido. Tente em alguns minutos.", "routes_quota");
    throw new HttpError(502, "Falha ao calcular a rota.", "routes_error");
  }
  const data = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string }; warnings?: string[] }[] };
  const r = data.routes?.[0];
  if (!r?.polyline?.encodedPolyline) throw new HttpError(404, "Nenhuma rota encontrada para esse meio de transporte.", "route_not_found");
  const distanceMeters = r.distanceMeters ?? 0;
  const durationSeconds = parseInt(String(r.duration ?? "0").replace(/s$/, ""), 10) || 0;
  return { distanceMeters, durationSeconds, distanceText: fmtDistance(distanceMeters), durationText: fmtDuration(durationSeconds), polyline: r.polyline.encodedPolyline, warnings: r.warnings ?? [] };
}
