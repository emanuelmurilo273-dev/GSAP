import { env } from "./env";
import { log } from "./logger";
import type { SiteImage } from "./site/types";

// Banco de imagens autorizado: Unsplash API (licença Unsplash, uso gratuito
// com crédito ao fotógrafo). Diretrizes: https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines

type UPhoto = {
  id: string;
  alt_description?: string | null;
  urls: { regular: string; small: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
};

const UTM = "utm_source=sitehunter_ai&utm_medium=referral";

export function imagesConfigured() {
  return !!env.unsplashKey;
}

export async function searchImages(query: string, perPage = 12): Promise<(SiteImage & { downloadLocation: string; thumb: string })[]> {
  const key = env.unsplashKey;
  if (!key) return [];
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&content_filter=high`,
    { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }, next: { revalidate: 3600 } },
  );
  if (!res.ok) {
    log("warn", "unsplash_failed", { status: res.status });
    return [];
  }
  const data = (await res.json()) as { results: UPhoto[] };
  return data.results.map((p) => ({
    url: p.urls.regular,
    thumb: p.urls.small,
    alt: p.alt_description ?? "",
    credit: { name: p.user.name, link: `${p.user.links.html}?${UTM}` },
    downloadLocation: p.links.download_location,
  }));
}

/** Exigido pelas diretrizes do Unsplash quando uma foto é usada. */
export async function trackImageDownload(downloadLocation: string) {
  const key = env.unsplashKey;
  if (!key || !downloadLocation.startsWith("https://api.unsplash.com/")) return;
  try {
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` } });
  } catch {
    /* não crítico */
  }
}
