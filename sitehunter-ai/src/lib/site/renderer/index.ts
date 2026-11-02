// Renderizador dos sites gerados: HTML estático completo e autocontido.
// Organização: util (segurança), color (contraste), components (botões, imagens,
// cabeçalhos), sections (cada seção), styles (CSS), script (interações), seo (metadados).
import type { Section, SiteContent } from "../types";
import { icon } from "../icons";
import { esc } from "./util";
import { WA_SVG, whatsappUrl, type RenderCtx } from "./components";
import { mobileBar, sectionHtml } from "./sections";
import { css } from "./styles";
import { SITE_SCRIPT } from "./script";
import { headMeta } from "./seo";

export { esc, safeUrl, waNumber } from "./util";
export { contrast, onColor, readable } from "./color";

export type RenderOptions = {
  /** Crédito "Site criado com SiteHunter AI" no rodapé. */
  footerCredit?: boolean;
  /** Chave da Maps Embed API (restrita aos domínios dos sites). Sem ela, o site mostra só os botões de rota. */
  mapsEmbedKey?: string | null;
  /** Endereço público definitivo (canonical, og:url e schema.org). */
  canonicalUrl?: string | null;
  /** Pré-visualização no editor: não carrega mapas externos. */
  preview?: boolean;
};

const NAV_LABELS: Partial<Record<Section["type"], string>> = {
  about: "Sobre", services: "Serviços", products: "Produtos", menu: "Cardápio", hours: "Horários", gallery: "Galeria", faq: "Dúvidas", quote: "Orçamento", contact: "Contato",
};

function hasContent(s: Section): boolean {
  switch (s.type) {
    case "gallery": return s.images.length > 0;
    case "hours": return s.lines.some((l) => l.value.trim());
    case "menu": return s.categories.some((c) => c.items.length);
    case "services": case "highlights": case "steps": case "faq": case "products": return s.items.length > 0;
    default: return true;
  }
}

export function renderSite(c: SiteContent, opts: RenderOptions = {}): string {
  const ctx: RenderCtx = { c, mapsEmbedKey: opts.mapsEmbedKey ?? null, preview: !!opts.preview };
  const footerCredit = opts.footerCredit ?? true;
  const visible = c.sections.filter((s) => s.visible && hasContent(s));
  const navItems = visible.filter((s) => NAV_LABELS[s.type]);
  const navLinks = navItems
    .map((s) => {
      const t = (s.type === "services" || s.type === "products") && s.title && s.title.length <= 14 ? s.title : NAV_LABELS[s.type]!;
      return `<a href="#${esc(s.id)}">${esc(t)}</a>`;
    })
    .join("");
  const fonts = Array.from(new Set([c.theme.headingFont, c.theme.bodyFont]))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700;800`)
    .join("&");
  const wa = whatsappUrl(c);
  const hero = c.sections.find((x) => x.type === "hero");
  const heroCta = hero && hero.type === "hero" ? hero.buttons.find((b) => b.action === "whatsapp")?.label : undefined;
  const ctaLabel = heroCta && heroCta.length <= 18 ? heroCta : "Fale conosco";
  const startsWithHero = visible[0]?.type === "hero";
  const mbar = mobileBar(c);
  const body = visible.map((s, i) => sectionHtml(s, ctx, visible[i + 1])).join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${headMeta(c, opts.canonicalUrl ?? null)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>${css(c)}</style>
<script>document.documentElement.classList.add('js')</script>
</head>
<body class="st-${esc(c.style)}${mbar ? " has-mbar" : ""}">
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<div class="progress" id="pg" aria-hidden="true"></div>
<header class="topbar${startsWithHero ? "" : " solid"}" id="top"${startsWithHero ? "" : " data-solid"}><div class="wrap">
  <a class="brand" href="#conteudo" aria-label="${esc(c.siteName)}, início"><span class="bm" aria-hidden="true">${icon(c.icon)}</span><span>${esc(c.siteName)}</span></a>
  <button class="burger" id="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu"><i aria-hidden="true"></i></button>
  <nav class="nav" id="menu" aria-label="Menu principal">${navLinks}${wa ? `<a class="btn btn-main btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${icon("chat", "bi")}<span>${ctaLabel}</span><span class="sr-only"> pelo WhatsApp (abre em nova aba)</span></a>` : ""}</nav>
</div></header>
<main id="conteudo" tabindex="-1">
${body}
</main>
<footer><div class="wrap">
  <div class="f-top"><p class="f-brand">${esc(c.siteName)}</p>${navLinks ? `<nav class="f-nav" aria-label="Rodapé">${navLinks}</nav>` : ""}</div>
  <div class="f-bot"><p>© <span id="yr">${new Date().getFullYear()}</span> ${esc(c.business.name)}. Todos os direitos reservados.</p>${footerCredit ? `<p>Site criado com SiteHunter AI</p>` : ""}</div>
</div></footer>
${wa ? `<a class="wa-float" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp (abre em nova aba)">${WA_SVG}</a>` : ""}
${mbar}
${visible.some((s) => s.type === "gallery") ? LIGHTBOX : ""}
<script>${SITE_SCRIPT}</script>
</body>
</html>`;
}

const LIGHTBOX = `<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Foto ampliada" hidden>
  <div class="lb-top"><span class="lb-count" aria-live="polite"></span><button type="button" class="lb-btn lb-close" aria-label="Fechar foto ampliada">&times;</button></div>
  <div class="lb-stage"><span class="lb-spin" aria-hidden="true"></span><img class="lb-img" alt="" decoding="async"><button type="button" class="lb-btn lb-prev" aria-label="Foto anterior">&#8249;</button><button type="button" class="lb-btn lb-next" aria-label="Próxima foto">&#8250;</button></div>
  <p class="lb-cap" aria-live="polite"></p>
</div>`;

/** Política de segurança de conteúdo aplicada aos sites publicados. */
export const PUBLISHED_SITE_CSP = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "frame-src https://www.google.com",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");
