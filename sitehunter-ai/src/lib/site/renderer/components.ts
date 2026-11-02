// Componentes reutilizáveis do HTML dos sites gerados.
import type { SiteButton, SiteContent, SiteImage } from "../types";
import { icon } from "../icons";
import { esc, optimizedImage, safeUrl, srcset, telHref, waNumber } from "./util";

export type RenderCtx = {
  c: SiteContent;
  mapsEmbedKey: string | null;
  preview: boolean;
};

export const waText = (c: SiteContent) => `Olá! Vim pelo site da ${c.business.name}.`;

export function whatsappUrl(c: SiteContent, text = waText(c)): string | null {
  const n = waNumber(c.business.whatsapp || c.business.phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** Link "Como chegar" com rota no Google Maps (sem chave). */
export function directionsUrl(c: SiteContent): string | null {
  const b = c.business;
  if (b.lat != null && b.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  if (b.address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${b.name}, ${b.address}`)}`;
  return null;
}

export function mapsUrl(c: SiteContent): string | null {
  if (c.business.mapsUrl) return safeUrl(c.business.mapsUrl);
  if (c.business.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.business.name}, ${c.business.address}`)}`;
  return null;
}

export function buttonHref(b: SiteButton, c: SiteContent): string {
  switch (b.action) {
    case "whatsapp":
      return whatsappUrl(c) ?? "#contato";
    case "phone":
      return telHref(c.business.phone) ?? "#contato";
    case "email":
      return c.business.email ? `mailto:${encodeURIComponent(c.business.email)}` : "#contato";
    case "maps":
      return directionsUrl(c) ?? mapsUrl(c) ?? "#contato";
    case "section":
      return safeUrl("#" + (b.href ?? "contato"));
    case "link":
      return safeUrl(b.href);
  }
}

const BTN_ICON: Partial<Record<SiteButton["action"], string>> = { whatsapp: "chat", maps: "pin", phone: "phone", email: "chat" };

export function button(b: SiteButton, c: SiteContent, variant: "main" | "ghost" | "light" = "main", extra = ""): string {
  const href = buttonHref(b, c);
  const external = /^https?:/.test(href);
  const ic = BTN_ICON[b.action] ? icon(BTN_ICON[b.action], "bi") : "";
  return `<a class="btn btn-${variant}${extra ? " " + extra : ""}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${ic}<span>${esc(b.label)}</span>${external ? '<span class="sr-only"> (abre em nova aba)</span>' : ""}</a>`;
}

export function sectionHead(title: string, intro?: string, eyebrow?: string, id?: string): string {
  if (!title && !intro) return "";
  return `<header class="sh rv">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}${title ? `<h2${id ? ` id="${esc(id)}-t"` : ""}>${esc(title)}</h2>` : ""}${intro ? `<p class="lede">${esc(intro)}</p>` : ""}</header>`;
}

export function credit(i?: SiteImage): string {
  return i?.credit ? `<figcaption>Foto: <a href="${esc(safeUrl(i.credit.link))}" target="_blank" rel="noopener noreferrer">${esc(i.credit.name)}</a> / Unsplash</figcaption>` : "";
}

/** Imagem responsiva, com carregamento preguiçoso e decodificação assíncrona. */
export function picture(i: SiteImage | undefined, cls: string, opts: { sizes?: string; width?: number; eager?: boolean; style?: string } = {}): string {
  if (!i?.url) return "";
  const src = safeUrl(i.url);
  if (src === "#") return "";
  const w = opts.width ?? 1024;
  const set = srcset(src, [480, 768, 1024, 1600]);
  return `<figure class="${cls}"${opts.style ? ` style="${opts.style}"` : ""}><img src="${esc(optimizedImage(src, w))}"${set ? ` srcset="${esc(set)}" sizes="${esc(opts.sizes ?? "(max-width: 860px) 100vw, 50vw")}"` : ""} alt="${esc(i.alt)}" ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">${credit(i)}</figure>`;
}

/** Título com animação palavra por palavra (o texto continua legível para leitores de tela). */
export function animatedWords(t: string): string {
  const parts = esc(t).split(/\s+/).filter(Boolean);
  return `<span class="sr-only">${esc(t)}</span><span aria-hidden="true">${parts.map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(" ")}</span>`;
}

export const WA_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>`;
