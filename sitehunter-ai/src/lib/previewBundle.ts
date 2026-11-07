import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderSite } from "./site/render";
import type { SiteContent } from "./site/types";
import { assetForModel } from "./site/immersive/kinds";
import { conceptOf } from "./site/immersive/render";
import { prepareContent } from "./site/render";

// Pacote estático de UMA prévia (HTML + recursos 3D), para hospedar fora do app.
// Estrutura:  <dir>/<slug>/index.html  e  <dir>/_assets/{vendor,models}/...  (compartilhados)

export type BundleFile = { path: string; data: Buffer };

/** Arquivos de /public que a prévia usa: fotos da biblioteca e, com modelo escaneado, three.js + modelo + HDR. */
export async function assetFilesFor(content: SiteContent): Promise<string[]> {
  // Fotos usadas depois da atualização das prévias antigas (ainda com endereços "lib:").
  const prepared = prepareContent(content, { assetUrl: (p) => `lib-resolved:${p}` });
  const photos = [...new Set((JSON.stringify(prepared).match(/lib-resolved:photos\/[a-z]+\/\d+\.jpg/g) ?? []).map((u) => u.slice("lib-resolved:".length)))]
    .flatMap((f) => [f, f.replace(/\.jpg$/, "-m.jpg")]);
  const files = [...photos, ...(photos.length ? ["photos/LICENSES.md"] : [])];
  if (content.theme.style !== "immersive") return files;
  const k = conceptOf(content);
  const asset = assetForModel(k.model, k.seed);
  if (!asset) return files;
  files.push("vendor/three.min.js", "vendor/three.LICENSE.txt", "vendor/GLTFLoader.js", "vendor/RGBELoader.js", "models/LICENSES.md", "models/hdri/studio_small_09_1k.hdr");
  const dir = path.join(process.cwd(), "public", "models", asset);
  const gltf = JSON.parse(await readFile(path.join(dir, "model.gltf"), "utf8")) as { buffers?: { uri: string }[]; images?: { uri: string }[] };
  files.push(`models/${asset}/model.gltf`, ...[...(gltf.buffers ?? []), ...(gltf.images ?? [])].map((x) => `models/${asset}/${x.uri}`));
  return files;
}

export async function buildPreviewBundle(content: SiteContent, slug: string, dir = "previas"): Promise<BundleFile[]> {
  const html = renderSite(content, { footerCredit: true, noindex: true, threeSrc: "../_assets/vendor/three.min.js", assetBase: "../_assets/models/" });
  const out: BundleFile[] = [{ path: `${dir}/${slug}/index.html`, data: Buffer.from(html, "utf8") }];
  for (const f of await assetFilesFor(content)) out.push({ path: `${dir}/_assets/${f}`, data: await readFile(path.join(process.cwd(), "public", f)) });
  return out;
}
