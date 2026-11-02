import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { renderSite } from "./site/render";
import type { SiteContent } from "./site/types";

/** Pacote para levar o site para outra hospedagem: HTML estático + fotos da biblioteca + conteúdo em JSON. */
export async function exportSiteZip(content: SiteContent): Promise<Uint8Array> {
  const zip = new JSZip();
  let html = renderSite(content, { footerCredit: false });
  // Fotos da biblioteca própria vão dentro do pacote, com caminhos relativos.
  const files = new Set<string>();
  html = html.replace(/(?:https?:\/\/[^"'\s,]+\/)?stock\/([a-z]+-\d+-(?:800|1600)\.webp)/g, (_m, f: string) => {
    files.add(f);
    return `stock/${f}`;
  });
  for (const f of files) {
    const data = await fs.readFile(path.join(process.cwd(), "public", "stock", f)).catch(() => null);
    if (data) zip.file(`stock/${f}`, data);
  }
  zip.file("index.html", html);
  zip.file("site.json", JSON.stringify(content, null, 2));
  zip.file(
    "LEIA-ME.txt",
    `Site: ${content.siteName}\n\nEste pacote contém o site em HTML estático (index.html) e as fotos (pasta stock), prontos para qualquer hospedagem de arquivos estáticos (ex.: Netlify, Cloudflare Pages, GitHub Pages, hospedagem com cPanel).\n\nComo publicar em outra hospedagem:\n1. Envie o index.html e a pasta stock para a pasta pública da hospedagem (ex.: public_html).\n2. Aponte o domínio da empresa para essa hospedagem.\n\nFotos da biblioteca: licença Unsplash (uso comercial gratuito). Fotos do Google Maps continuam vindo do SiteHunter AI enquanto a conta estiver ativa; para independência total, troque-as por fotos da própria empresa.\nsite.json: conteúdo editável.\n`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
