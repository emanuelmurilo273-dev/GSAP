import { randomBytes } from "node:crypto";
import { env } from "../env";
import { log } from "../logger";
import type { ImageCandidate } from "./types";

// Wikimedia Commons: fotos reais com licença livre declarada em cada arquivo.
// 1) busca pelo nome da empresa + cidade (às vezes alguém fotografou a fachada);
// 2) fotos tiradas a até 150 m das coordenadas (o local e o entorno).
// Nenhuma é tratada como "foto da empresa" automaticamente: o painel mostra a licença, o autor e o
// que a foto provavelmente mostra, e o usuário aprova. API: https://commons.wikimedia.org/w/api.php

const API = "https://commons.wikimedia.org/w/api.php";
const OK_LICENSE = /^(cc0|public domain|pd|cc by(-sa)? ?[1-4]\.0|cc by(-sa)?$|cc-by(-sa)?-[1-4]\.0)/i;

type Info = { url: string; thumburl?: string; width: number; height: number; descriptionurl: string; mime: string; extmetadata?: Record<string, { value: string }> };

const strip = (h = "") => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const ua = () => `SiteHunterAI/1.0 (+${env.appUrl}${env.osmContactEmail ? `; ${env.osmContactEmail}` : ""})`;

async function api(params: Record<string, string>) {
  const r = await fetch(`${API}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`, { headers: { "User-Agent": ua() }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!r.ok) throw new Error(`commons ${r.status}`);
  return r.json() as Promise<{ query?: { pages?: { title: string; imageinfo?: Info[] }[] } }>;
}

export function mapCommons(page: { title: string; imageinfo?: Info[] }, kind: "name" | "near", businessName: string): ImageCandidate | null {
  const i = page.imageinfo?.[0];
  if (!i || !/^image\/(jpeg|png|webp)$/.test(i.mime) || i.width < 900) return null;
  const m = i.extmetadata ?? {};
  const license = strip(m.LicenseShortName?.value);
  if (!OK_LICENSE.test(license)) return null;
  const artist = strip(m.Artist?.value) || "autor no Commons";
  const desc = strip(m.ImageDescription?.value).slice(0, 140) || page.title.replace(/^File:|\.\w+$/g, "");
  return {
    id: randomBytes(6).toString("hex"),
    url: i.thumburl ?? i.url,
    thumb: i.thumburl ?? i.url,
    alt: desc,
    origin: "stock",
    source: "Wikimedia Commons",
    sourceUrl: i.descriptionurl,
    license,
    licenseUrl: m.LicenseUrl?.value ?? null,
    credit: { name: artist.slice(0, 80), link: i.descriptionurl },
    status: "candidate",
    requiresPermission: false,
    note: kind === "name"
      ? `Encontrada pela busca "${businessName}". Confira se a foto mostra mesmo esta empresa antes de aprovar.`
      : "Foto real tirada perto do endereço (rua ou entorno). Não é foto da empresa: entra no site como imagem do local.",
  };
}

const SKIP = new Set(["academia", "clinica", "odontologia", "barbearia", "salao", "padaria", "restaurante", "oficina", "loja", "studio", "casa", "centro", "cafe", "pizzaria", "otica", "shop", "beleza", "auto", "center"]);
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function relevant(name: string, text: string) {
  const t = fold(text);
  const toks = fold(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  const own = toks.filter((w) => !SKIP.has(w));
  return (own.length ? own : toks).some((w) => t.includes(w));
}

const PROPS = { prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ImageDescription" };

export async function commonsCandidates(name: string, city: string | null, lat: number | null, lng: number | null): Promise<ImageCandidate[]> {
  const out: ImageCandidate[] = [];
  try {
    if (city) {
      const q = `"${name.replace(/"/g, "")}" ${city}`;
      const r = await api({ action: "query", generator: "search", gsrsearch: q, gsrnamespace: "6", gsrlimit: "4", ...PROPS });
      for (const p of r.query?.pages ?? []) { const c = mapCommons(p, "name", name); if (c && relevant(name, `${p.title} ${c.alt}`)) out.push(c); }
    }
    if (lat != null && lng != null) {
      const r = await api({ action: "query", generator: "geosearch", ggscoord: `${lat}|${lng}`, ggsradius: "150", ggsnamespace: "6", ggslimit: "6", ...PROPS });
      // Fotos perto do endereço só entram se o título/descrição citar uma palavra própria do nome (ex.: "Mercado" no Café do Mercado).
      for (const p of r.query?.pages ?? []) { const c = mapCommons(p, "near", name); if (c && relevant(name, `${p.title} ${c.alt}`) && !out.some((o) => o.sourceUrl === c.sourceUrl)) out.push(c); }
    }
  } catch (e) {
    log("warn", "commons_failed", { error: String(e) });
  }
  return out.slice(0, 6);
}
