import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { renderSite } from "./site/render";
import { assetFilesFor } from "./previewBundle";
import type { SiteContent } from "./site/types";

/** Pacote para levar o site para outra hospedagem: HTML estático + conteúdo em JSON. */
export async function exportSiteZip(content: SiteContent): Promise<Uint8Array> {
  const zip = new JSZip();
  // Mesma estrutura de /public (vendor/, models/, photos/): fotos e modelo 3D vão junto, o site funciona offline.
  zip.file("index.html", renderSite(content, { footerCredit: false, threeSrc: "vendor/three.min.js" }));
  for (const f of await assetFilesFor(content)) zip.file(f, await readFile(path.join(process.cwd(), "public", f)));
  zip.file("site.json", JSON.stringify(content, null, 2));
  zip.file(
    "LEIA-ME.txt",
    `Site: ${content.siteName}\n\nEste pacote contém o site em HTML estático (index.html), pronto para ser hospedado em qualquer serviço de hospedagem de arquivos estáticos (ex.: Netlify, Cloudflare Pages, GitHub Pages, hospedagem compartilhada com cPanel).\n\nComo publicar em outra hospedagem:\n1. Envie o arquivo index.html para a pasta pública da hospedagem (ex.: public_html).\n2. Aponte o domínio da empresa para essa hospedagem, conforme as instruções do provedor.\n\nImagens: as fotos ilustrativas da biblioteca vão na pasta photos/ (domínio público); fotos da empresa usam o link original. Mantenha os créditos do rodapé.\nsite.json: conteúdo editável, para importar em uma futura versão do SiteHunter AI ou em outro sistema.\n`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
