import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ProposalContent } from "./proposal";

// As fontes padrão do PDF usam codificação WinAnsi: acentos do português
// funcionam, mas símbolos fora dela (emojis etc.) são removidos.
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function sanitize(s: string) {
  return Array.from(s.replace(/\t/g, "  "))
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) return ch;
      return "";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of sanitize(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export async function proposalPdf(p: ProposalContent, text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitize(`Proposta — ${p.companyName}`));
  doc.setCreator("SiteHunter AI");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 56;
  const W = 595.28, H = 841.89;
  let page = doc.addPage([W, H]);
  let y = H - margin;

  // Cabeçalho
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: rgb(0.03, 0.06, 0.14) });
  page.drawText("Proposta comercial", { x: margin, y: H - 50, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(sanitize(p.companyName).slice(0, 70), { x: margin, y: H - 72, size: 12, font, color: rgb(0.6, 0.75, 1) });
  y = H - 120;

  const HEADINGS = new Set(["RESUMO DO PROJETO", "BENEFÍCIOS", "FUNCIONALIDADES INCLUÍDAS", "INVESTIMENTO", "CUSTOS ADICIONAIS POSSÍVEIS", "CONDIÇÕES"]);
  const lines = text.split("\n").slice(3); // pula o título textual (já no cabeçalho)
  for (const raw of lines) {
    const isHeading = HEADINGS.has(raw.trim());
    const f = isHeading ? bold : font;
    const size = isHeading ? 12.5 : 10.5;
    const wrapped = wrap(raw, f, size, W - margin * 2);
    for (const l of wrapped) {
      if (y < margin + 20) {
        page = doc.addPage([W, H]);
        y = H - margin;
      }
      if (isHeading) y -= 6;
      page.drawText(l, { x: margin, y, size, font: f, color: isHeading ? rgb(0.1, 0.3, 0.85) : rgb(0.1, 0.1, 0.12) });
      y -= size * 1.5;
    }
  }
  const pages = doc.getPages();
  pages.forEach((pg, i) => pg.drawText(`${i + 1}/${pages.length}`, { x: W - margin - 20, y: 28, size: 8, font, color: rgb(0.5, 0.5, 0.5) }));
  return doc.save();
}
