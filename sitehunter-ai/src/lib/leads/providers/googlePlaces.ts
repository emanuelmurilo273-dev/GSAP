import { env } from "../../env";
import { HttpError } from "../../http";
import { log } from "../../logger";
import { mapPlace } from "../../places";
import { parseGoogleHours } from "../hours";
import type { LeadCriteria, RawBusiness } from "../types";
import type { BusinessSearchProvider } from "./types";

// Google Places API (New) — Text Search, paginado até a quantidade pedida.
// Termos: https://cloud.google.com/maps-platform/terms — o place_id pode ser
// guardado indefinidamente; demais campos devem ser atualizados periodicamente
// (ver "Atualizar dados" no perfil do lead).

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
  "places.regularOpeningHours.weekdayDescriptions",
  "places.internationalPhoneNumber",
  "nextPageToken",
].join(",");

export const googlePlacesProvider: BusinessSearchProvider = {
  id: "google_places",
  label: "Google Places",
  kind: "real",
  configured: () => !!env.googlePlacesKey,
  setupHint: "Defina GOOGLE_PLACES_API_KEY no servidor (Places API (New) habilitada no Google Cloud).",
  async search(c: LeadCriteria): Promise<RawBusiness[]> {
    const key = env.googlePlacesKey;
    if (!key) throw new HttpError(503, "A busca real ainda não foi configurada (GOOGLE_PLACES_API_KEY).", "not_configured");
    const out: RawBusiness[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3 && out.length < c.count; page++) {
      const body: Record<string, unknown> = {
        textQuery: `${c.niche} em ${c.location}`,
        languageCode: c.language,
        pageSize: Math.min(20, c.count - out.length),
      };
      if (pageToken) body.pageToken = pageToken;
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        log("error", "places_search_failed", { status: res.status, body: (await res.text()).slice(0, 300) });
        if (out.length) break; // devolve o que já foi obtido
        throw new HttpError(res.status === 429 ? 503 : 502, res.status === 429 ? "Limite de requisições do Google Places atingido. Tente mais tarde." : "O Google Places não respondeu corretamente.", "upstream");
      }
      const data = (await res.json()) as { places?: (Parameters<typeof mapPlace>[0] & { regularOpeningHours?: { weekdayDescriptions?: string[] }; internationalPhoneNumber?: string })[]; nextPageToken?: string };
      for (const p of data.places ?? []) {
        if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
        const m = mapPlace(p);
        out.push({
          sourceId: m.sourceId,
          name: m.name,
          category: m.category,
          address: m.address,
          neighborhood: m.neighborhood,
          city: m.city,
          state: m.state,
          phone: m.phone,
          email: null, // o Google Places não fornece e-mail
          website: m.website,
          mapsUrl: m.mapsUrl,
          lat: m.lat,
          lng: m.lng,
          businessStatus: m.businessStatus,
          source: { provider: "google_places", label: "Google Maps", url: m.mapsUrl },
          hours: parseGoogleHours(p.regularOpeningHours?.weekdayDescriptions),
          hoursRaw: p.regularOpeningHours?.weekdayDescriptions?.join("; ") ?? null,
        });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return out.slice(0, c.count);
  },
};
