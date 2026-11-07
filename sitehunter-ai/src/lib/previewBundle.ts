import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderSite } from "./site/render";
import type { SiteContent } from "./site/types";
import { DISHES } from "./site/immersive/kinds";

// Pacote estático de UMA prévia (HTML + recursos 3D), para hospedar fora do app.
// Estrutura:  <dir>/<slug>/index.html  e  <dir>/_assets/{vendor,models}/...  (compartilhados)

export type BundleFile = { path: string; data: Buffer };

/** Arquivos de /public que a prévia usa (three.js sempre; modelo/foto 3D conforme o conceito). */
export async function assetFilesFor(content: SiteContent): Promise<string[]> {
  if (content.theme.style !== "immersive") return [];
  const k = content.concept;
  const files = ["vendor/three.min.js", "vendor/three.LICENSE.txt", "models/LICENSES.md"];
  const gl = [...new Set([k?.asset, k?.secondary.includes("wrench") ? "combination_wrench" : null, k?.secondary.includes("croissant") ? "croissant" : null].filter((x): x is string => !!x))];
  if (gl.length) files.push("vendor/GLTFLoader.js");
  for (const id of gl) {
    const dir = path.join(process.cwd(), "public", "models", id);
    const gltf = JSON.parse(await readFile(path.join(dir, "model.gltf"), "utf8")) as { buffers?: { uri: string }[]; images?: { uri: string }[] };
    files.push(`models/${id}/model.gltf`, ...[...(gltf.buffers ?? []), ...(gltf.images ?? [])].map((x) => `models/${id}/${x.uri}`));
  }
  if (k?.dish && DISHES[k.dish]) files.push(`models/dishes/${DISHES[k.dish]!.file}`);
  return files;
}

export async function buildPreviewBundle(content: SiteContent, slug: string, dir = "previas"): Promise<BundleFile[]> {
  const html = renderSite(content, { footerCredit: true, noindex: true, threeSrc: "../_assets/vendor/three.min.js", assetBase: "../_assets/models/" });
  const out: BundleFile[] = [{ path: `${dir}/${slug}/index.html`, data: Buffer.from(html, "utf8") }];
  for (const f of await assetFilesFor(content)) out.push({ path: `${dir}/_assets/${f}`, data: await readFile(path.join(process.cwd(), "public", f)) });
  return out;
}
