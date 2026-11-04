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

/** Há sempre um banco disponível: Unsplash (com chave) ou Openverse (sem chave). */
export function imagesConfigured() {
  return !env.imageSearchDisabled;
}

export function imageProviderLabel() {
  return env.unsplashKey ? "Unsplash" : "Openverse";
}

export type LicensedImage = {
  url: string;
  thumb: string;
  alt: string;
  credit: { name: string; link: string };
  license: string;
  licenseUrl: string | null;
  source: string;
  sourceUrl: string;
  downloadLocation?: string;
};

// Openverse (Fundação WordPress): catálogo de imagens com licenças abertas.
// Filtro: licenças que permitem uso comercial E modificação (CC0, domínio público, CC BY, CC BY-SA).
// Documentação: https://api.openverse.org/v1/  (sem chave há limite por IP; OPENVERSE_TOKEN aumenta o limite)
type OVImage = { id: string; title?: string; url: string; thumbnail?: string; creator?: string | null; creator_url?: string | null; license: string; license_version?: string; license_url?: string; foreign_landing_url?: string; source?: string; provider?: string };

const LICENSE_NAME: Record<string, string> = { cc0: "CC0 (domínio público)", pdm: "Domínio público", by: "CC BY", "by-sa": "CC BY-SA" };

export function mapOpenverse(r: OVImage): LicensedImage | null {
  if (!r.url?.startsWith("https://") || !LICENSE_NAME[r.license]) return null;
  const lic = `${LICENSE_NAME[r.license]}${r.license_version && !["cc0", "pdm"].includes(r.license) ? ` ${r.license_version}` : ""}`;
  return {
    url: r.url,
    thumb: r.thumbnail ?? r.url,
    alt: r.title ?? "",
    credit: { name: r.creator?.trim() || "Autor não informado", link: r.creator_url || r.foreign_landing_url || r.url },
    license: lic,
    licenseUrl: r.license_url ?? null,
    source: `Openverse${r.source ? ` (${r.source})` : ""}`,
    sourceUrl: r.foreign_landing_url ?? r.url,
  };
}

// Preenchimento automático: só bancos de fotos atuais (CC0) e nada com cara de arquivo histórico
// ou de outra empresa real. Na busca manual o usuário vê todo o catálogo e escolhe.
const CURATED_SOURCES = "stocksnap,wordpress,nappy";
const OUTDATED = /vintage|historic|archive|retro|antig|old |19\d\d|18\d\d|\bwar\b|museum|street \(/i;

export async function searchOpenverse(query: string, perPage = 12, opts: { curated?: boolean } = {}): Promise<LicensedImage[]> {
  const params = new URLSearchParams({ q: query, license_type: "commercial,modification", page_size: String(Math.min(20, opts.curated ? perPage * 2 : perPage)), mature: "false" });
  if (opts.curated) {
    params.set("source", CURATED_SOURCES);
    params.set("category", "photograph");
    params.set("size", "large");
  }
  const headers: Record<string, string> = { "User-Agent": `SiteHunterAI/1.0 (+${env.appUrl})` };
  if (env.openverseToken) headers.Authorization = `Bearer ${env.openverseToken}`;
  try {
    const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, { headers, signal: AbortSignal.timeout(15_000), next: { revalidate: 3600 } });
    if (!res.ok) {
      log("warn", "openverse_failed", { status: res.status });
      return [];
    }
    const data = (await res.json()) as { results?: OVImage[] };
    const seen = new Set<string>();
    return (data.results ?? [])
      .filter((r) => !opts.curated || !OUTDATED.test(r.title ?? ""))
      .map(mapOpenverse)
      .filter((x): x is LicensedImage => !!x && !seen.has(x.url) && !!seen.add(x.url))
      .slice(0, perPage);
  } catch (e) {
    log("warn", "openverse_error", { error: String(e) });
    return [];
  }
}

/** Busca no banco disponível: Unsplash quando há chave, senão Openverse. */
export async function searchLicensedImages(query: string, perPage = 12, opts: { curated?: boolean } = {}): Promise<LicensedImage[]> {
  if (env.imageSearchDisabled) return [];
  if (env.unsplashKey) {
    const u = await searchImages(query, perPage);
    return u.map((i) => ({ url: i.url, thumb: i.thumb, alt: i.alt, credit: i.credit!, license: "Licença Unsplash", licenseUrl: "https://unsplash.com/license", source: "Unsplash", sourceUrl: i.credit!.link, downloadLocation: i.downloadLocation }));
  }
  return searchOpenverse(query, perPage, opts);
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
