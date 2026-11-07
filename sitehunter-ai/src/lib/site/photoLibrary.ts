import catalog from "./photoCatalog.json";
import type { ModelKind } from "./immersive/kinds";
import type { SiteContent, SiteImage } from "./types";

// Biblioteca de fotos do próprio app (public/photos): escolhidas uma a uma por ramo, domínio público
// (CC0/PDM), guardadas no tamanho original (sem ampliar) e com uma versão de 640 px para celular.
// Servidas pelo app, carregam sempre; no conteúdo ficam como "lib:<ramo>/<n>.jpg" e o endereço real
// é resolvido na hora de montar a página (app, site publicado ou pacote estático).

export type LibPhoto = { file: string; mobile: string; w: number; h: number; alt: string; credit: string; creditUrl: string | null; license: string; source: string; sourceUrl: string };
const CATALOG = catalog as Record<string, LibPhoto[]>;

export const LIB_PREFIX = "lib:";

/** Descrição em português de cada ramo (texto alternativo das fotos). */
const ALT: Record<string, string> = {
  pizza: "Pizza artesanal", barbearia: "Ambiente e ferramentas de barbearia", restaurante: "Prato servido em restaurante", salao: "Atendimento em salão de beleza",
  estetica: "Tratamento de estética e bem-estar", cafe: "Café especial", padaria: "Pães artesanais", confeitaria: "Doces e bolos de confeitaria",
  odonto: "Consultório odontológico", clinica: "Atendimento em clínica", academia: "Equipamentos de academia", oficina: "Serviço em oficina mecânica",
  roupas: "Loja de roupas", pet: "Cuidado com pets", imobiliaria: "Ambiente de imóvel", hamburguer: "Hambúrguer artesanal", otica: "Óculos de grau",
  construcao: "Ferramentas e obra",
};

const BY_MODEL: Record<ModelKind, string> = {
  scissors: "barbearia", razor: "barbearia", pole: "barbearia", comb: "salao", hairdryer: "salao", bottle: "estetica", polish: "estetica",
  tooth: "odonto", implant: "odonto", cup: "cafe", bean: "cafe", loaf: "padaria", croissant: "padaria", cake: "confeitaria",
  plate: "restaurante", cloche: "restaurante", cutlery: "restaurante", pizza: "pizza", burger: "hamburguer",
  dumbbell: "academia", kettlebell: "academia", wheel: "oficina", wrench: "oficina", gear: "oficina",
  hanger: "roupas", tshirt: "roupas", bone: "pet", paw: "pet", key: "imobiliaria", house: "imobiliaria", pill: "clinica", glasses: "otica",
};
/** Ramos com poucas fotos completam com um ramo vizinho (sem repetir foto). */
const NEIGHBOR: Record<string, string> = { salao: "estetica", estetica: "salao", clinica: "odonto", hamburguer: "restaurante", pizza: "restaurante", cafe: "confeitaria", confeitaria: "padaria", padaria: "confeitaria", construcao: "oficina" };

export function libraryKey(model: ModelKind | undefined, segmentKey?: string): string {
  if (segmentKey === "construcao") return "construcao";
  return (model && BY_MODEL[model]) || (segmentKey && CATALOG[segmentKey] ? segmentKey : "restaurante");
}

export function libraryPhotos(key: string): LibPhoto[] {
  return CATALOG[key] ?? [];
}

const toImage = (key: string, p: LibPhoto): SiteImage => ({
  url: `${LIB_PREFIX}${p.file}`,
  alt: `${ALT[key] ?? "Foto ilustrativa"} (foto ilustrativa)`,
  credit: { name: p.credit, link: p.creditUrl || p.sourceUrl },
  origin: "stock",
  license: p.license,
  sourceUrl: p.sourceUrl,
});

/**
 * n fotos do ramo, sem repetir. A capa sai das melhores fotos do ramo (as primeiras do catálogo, em alta
 * resolução) e evita as capas já usadas em outras prévias do mesmo usuário (`avoid`), para que duas
 * empresas do mesmo ramo não abram com a mesma foto. A ordem das demais gira pela semente da empresa.
 */
export function libraryImages(key: string, seed: number, n: number, avoid: Set<string> = new Set()): SiteImage[] {
  const own = libraryPhotos(key);
  const extra = libraryPhotos(NEIGHBOR[key] ?? "").map((p) => [NEIGHBOR[key]!, p] as const);
  if (!own.length) return [];
  const top = own.slice(0, Math.min(6, own.length));
  const fresh = top.filter((p) => !avoid.has(`${LIB_PREFIX}${p.file}`));
  const pool = fresh.length ? fresh : top;
  const cover = pool[seed % pool.length]!;
  const rest = own.filter((p) => p !== cover);
  const start = rest.length ? (seed >>> 3) % rest.length : 0;
  const rotated = [...rest.slice(start), ...rest.slice(0, start)];
  return [[key, cover] as const, ...rotated.map((p) => [key, p] as const), ...extra].slice(0, n).map(([k, p]) => toImage(k, p));
}

export function isLibraryUrl(url: string | undefined): boolean {
  return !!url && url.startsWith(LIB_PREFIX);
}

/** Tamanho original de uma foto da biblioteca (para nunca exibi-la maior do que ela é). */
export function libraryMeta(url: string): LibPhoto | null {
  if (!isLibraryUrl(url)) return null;
  const file = url.slice(LIB_PREFIX.length);
  return CATALOG[file.split("/")[0]!]?.find((p) => p.file === file) ?? null;
}

/** Metadados de uma foto da biblioteca já resolvida para endereço real (…/photos/<ramo>/<n>.jpg). */
export function libraryMetaBySrc(src: string): LibPhoto | null {
  const m = src.match(/\/photos\/([a-z]+)\/(h?\d+)\.jpg$/);
  return m ? CATALOG[m[1]!]?.find((p) => p.file === `${m[1]}/${m[2]}.jpg`) ?? null : null;
}

/** Arquivos de public/ usados pelas fotos da biblioteca no conteúdo (para o pacote estático). */
export function libraryFilesIn(content: SiteContent): string[] {
  const urls = JSON.stringify(content).match(/"lib:[a-z]+\/h?\d+\.jpg"/g) ?? [];
  return [...new Set(urls.map((u) => u.slice(5, -1)))].flatMap((f) => [`photos/${f}`, `photos/${f.replace(/\.jpg$/, "-m.jpg")}`]);
}

/** Troca "lib:..." pelo endereço real (base termina em "/"). */
export function resolveLibrary(content: SiteContent, base: string | ((path: string) => string)): SiteContent {
  const resolve = typeof base === "function" ? base : (p: string) => base + p;
  const json = JSON.stringify(content).replace(/"lib:([a-z]+\/h?\d+\.jpg)"/g, (_, f: string) => JSON.stringify(resolve(`photos/${f}`)));
  return JSON.parse(json) as SiteContent;
}

/** Fontes que geravam imagens automáticas fracas (borradas, sem relação ou com link quebrado). */
const WEAK_AUTO = /openverse|stocksnap|rawpixel|flickr|staticflickr|wordpress\.org\/photos|unsplash/i;

/**
 * Atualiza prévias antigas: fotos de banco escolhidas automaticamente (Openverse/Unsplash) viram fotos
 * da biblioteca do ramo. Fotos da empresa, enviadas pelo usuário, geradas por IA ou do Commons ficam.
 */
export function upgradeContentImages(content: SiteContent, key: string, seed: number): SiteContent {
  if (content.libraryVersion === 1) return content;
  const pool = libraryImages(key, seed, 12);
  let k = 0;
  const swap = (i: SiteImage | undefined): SiteImage | undefined => {
    if (!i || i.origin !== "stock" || isLibraryUrl(i.url) || !WEAK_AUTO.test(`${i.url} ${i.sourceUrl ?? ""} ${i.license ?? ""}`)) return i;
    return pool[k++ % Math.max(1, pool.length)] ?? i;
  };
  const sections = content.sections.map((s) => {
    if (s.type === "hero" || s.type === "about") return { ...s, image: swap(s.image) };
    if (s.type === "gallery") {
      const seen = new Set<string>();
      return { ...s, images: s.images.map((i) => swap(i)!).filter((i) => !seen.has(i.url) && !!seen.add(i.url)) };
    }
    return s;
  });
  // Poucas fotos deixam a página vazia: completa a galeria com fotos do ramo que ainda não aparecem.
  const usedUrls = new Set(JSON.stringify(sections).match(/"url":"[^"]+"/g) ?? []);
  const fill = pool.filter((p) => !usedUrls.has(`"url":"${p.url}"`));
  const count = sections.reduce((n, s) => n + (s.type === "gallery" ? s.images.length : (s.type === "hero" || s.type === "about") && s.image ? 1 : 0), 0);
  const missing = Math.max(0, 6 - count);
  if (missing && fill.length) {
    const g = sections.findIndex((s) => s.type === "gallery");
    if (g >= 0) {
      const gs = sections[g] as Extract<SiteContent["sections"][number], { type: "gallery" }>;
      sections[g] = { ...gs, visible: true, images: [...gs.images, ...fill.slice(0, missing)] };
    } else {
      const at = Math.max(1, sections.findIndex((s) => s.type === "hours"));
      sections.splice(at, 0, { id: "galeria", type: "gallery", visible: true, title: "Galeria", images: fill.slice(0, missing) });
    }
  }
  return { ...content, sections, libraryVersion: 1 } as SiteContent;
}
