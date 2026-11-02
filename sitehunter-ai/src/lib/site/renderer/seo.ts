// Metadados de SEO e dados estruturados (schema.org) dos sites gerados.
import type { SiteContent } from "../types";
import { icon } from "../icons";
import { esc, optimizedImage, safeUrl } from "./util";

const SCHEMA_TYPE: Record<string, string> = {
  utensils: "Restaurant", bread: "Bakery", scissors: "HairSalon", sparkles: "BeautySalon", tooth: "Dentist", stethoscope: "MedicalClinic",
  dumbbell: "ExerciseGym", wrench: "AutoRepair", shirt: "ClothingStore", home: "RealEstateAgent", paw: "PetStore", hammer: "GeneralContractor", briefcase: "ProfessionalService",
};

export function headMeta(c: SiteContent, canonicalUrl: string | null): string {
  const title = c.seo.title || c.siteName;
  const hero = c.sections.find((s) => s.type === "hero");
  const img = hero && hero.type === "hero" && hero.image?.url ? optimizedImage(safeUrl(hero.image.url), 1200) : null;
  const favicon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${c.theme.accent}"/><g transform="translate(4 4)" color="#111">${icon(c.icon)}</g></svg>`.replace('class="ic"', 'width="24" height="24"'))}`;
  const hours = c.sections.find((s) => s.type === "hours");
  const clean = (u: string) => {
    const v = safeUrl(u);
    return /^https?:/.test(v) ? v : undefined;
  };
  const ig = c.business.instagram ? clean(c.business.instagram.startsWith("http") ? c.business.instagram : `https://instagram.com/${c.business.instagram.replace(/^@/, "")}`) : undefined;
  const openingHours = hours && hours.type === "hours" ? hours.lines.filter((l) => l.value.trim()).map((l) => `${l.label}: ${l.value}`) : [];
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[c.icon] ?? "LocalBusiness",
    name: c.business.name,
    description: c.seo.description || undefined,
    telephone: c.business.phone || undefined,
    email: c.business.email || undefined,
    url: canonicalUrl ? clean(canonicalUrl) : undefined,
    image: img ?? undefined,
    address: c.business.address ? { "@type": "PostalAddress", streetAddress: c.business.address, addressCountry: "BR" } : undefined,
    geo: c.business.lat != null && c.business.lng != null ? { "@type": "GeoCoordinates", latitude: c.business.lat, longitude: c.business.lng } : undefined,
    hasMap: c.business.mapsUrl ? clean(c.business.mapsUrl) : undefined,
    sameAs: ig ? [ig] : undefined,
    openingHours: openingHours.length ? openingHours : undefined,
  };
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(c.seo.description)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    canonicalUrl ? `<link rel="canonical" href="${esc(canonicalUrl)}">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:site_name" content="${esc(c.siteName)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(c.seo.description)}">`,
    canonicalUrl ? `<meta property="og:url" content="${esc(canonicalUrl)}">` : "",
    img ? `<meta property="og:image" content="${esc(img)}">` : "",
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">`,
    `<meta name="theme-color" content="${esc(c.theme.background)}">`,
    `<meta name="format-detection" content="telephone=no">`,
    `<link rel="icon" href="${esc(favicon)}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
  ]
    .filter(Boolean)
    .join("\n");
}
