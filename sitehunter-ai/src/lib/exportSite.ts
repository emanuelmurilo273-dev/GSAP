import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { renderSite } from "./site/render";
import type { SiteContent } from "./site/types";

/** Pacote para levar o site para outra hospedagem: HTML estático + conteúdo em JSON. */
export async function exportSiteZip(content: SiteContent): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("index.html", renderSite(content, { footerCredit: false, threeSrc: "three.min.js" }));
  // Vitrine 3D: leva a biblioteca three.js (MIT) junto, para o site funcionar em qualquer hospedagem.
  if (content.theme.style === "immersive") {
    const dir = path.join(process.cwd(), "public", "vendor");
    zip.file("three.min.js", await readFile(path.join(dir, "three.min.js")));
    zip.file("three.LICENSE.txt", await readFile(path.join(dir, "three.LICENSE.txt")));
  }
  zip.file("site.json", JSON.stringify(content, null, 2));
  zip.file(
    "LEIA-ME.txt",
    `Site: ${content.siteName}\n\nEste pacote contém o site em HTML estático (index.html), pronto para ser hospedado em qualquer serviço de hospedagem de arquivos estáticos (ex.: Netlify, Cloudflare Pages, GitHub Pages, hospedagem compartilhada com cPanel).\n\nComo publicar em outra hospedagem:\n1. Envie o arquivo index.html para a pasta pública da hospedagem (ex.: public_html).\n2. Aponte o domínio da empresa para essa hospedagem, conforme as instruções do provedor.\n\nImagens: o site usa links para as imagens originais (ex.: Unsplash). Mantenha os créditos dos fotógrafos.\nsite.json: conteúdo editável, para importar em uma futura versão do SiteHunter AI ou em outro sistema.\n`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
