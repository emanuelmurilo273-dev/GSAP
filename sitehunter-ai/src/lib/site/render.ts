import type { Section, SiteButton, SiteContent, SiteImage } from "./types";
import { icon } from "./icons";

// Renderizador dos sites gerados: HTML estático completo, com layout próprio
// por estilo (elegante, ousado, limpo, industrial, editorial, corporativo),
// animações de entrada e rolagem, cardápio com abas e formulário via WhatsApp.
// Todo texto é escapado e toda URL é validada.

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(u: string | undefined | null): string {
  const v = (u ?? "").trim();
  if (!v) return "#";
  if (v.startsWith("#")) return "#" + v.slice(1).replace(/[^a-zA-Z0-9_-]/g, "");
  try {
    const parsed = new URL(v);
    if (["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) return parsed.toString();
  } catch {
    /* inválida */
  }
  return "#";
}

function paras(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const digits = (s: string) => s.replace(/\D/g, "");

export function waNumber(phone: string): string | null {
  let d = digits(phone);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^\d{12,13}$/.test(d) ? d : null;
}

function mapsHref(c: SiteContent): string {
  if (c.business.mapsUrl) return safeUrl(c.business.mapsUrl);
  if (c.business.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.business.address)}`;
  return "#contato";
}

function buttonHref(b: SiteButton, c: SiteContent): string {
  switch (b.action) {
    case "whatsapp": {
      const n = waNumber(c.business.whatsapp || c.business.phone);
      return n ? `https://wa.me/${n}?text=${encodeURIComponent(`Olá! Vim pelo site da ${c.business.name}.`)}` : "#contato";
    }
    case "phone": {
      const d = digits(c.business.phone);
      return d ? `tel:+${d.length <= 11 ? "55" + d : d}` : "#contato";
    }
    case "email":
      return c.business.email ? `mailto:${encodeURIComponent(c.business.email)}` : "#contato";
    case "maps":
      return mapsHref(c);
    case "section":
      return safeUrl("#" + (b.href ?? "contato"));
    case "link":
      return safeUrl(b.href);
  }
}

function button(b: SiteButton, c: SiteContent, cls = "btn"): string {
  const href = buttonHref(b, c);
  const external = /^https?:/.test(href);
  const ic = b.action === "whatsapp" ? icon("chat", "bi") : b.action === "maps" ? icon("pin", "bi") : b.action === "phone" ? icon("phone", "bi") : "";
  return `<a class="${cls}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${ic}<span>${esc(b.label)}</span></a>`;
}

function credit(i?: SiteImage): string {
  return i?.credit ? `<figcaption>Foto: <a href="${esc(safeUrl(i.credit.link))}" target="_blank" rel="noopener noreferrer">${esc(i.credit.name)}</a> / Unsplash</figcaption>` : "";
}

function img(i: SiteImage | undefined, cls = ""): string {
  if (!i?.url) return "";
  const src = safeUrl(i.url);
  if (src === "#") return "";
  return `<figure class="${cls}"><img src="${esc(src)}" alt="${esc(i.alt)}" loading="lazy">${credit(i)}</figure>`;
}

const head = (title: string, intro?: string, eyebrow?: string) =>
  `<header class="sh rv">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}<h2>${esc(title)}</h2>${intro ? `<p class="lede">${esc(intro)}</p>` : ""}</header>`;

function words(t: string) {
  return esc(t)
    .split(/\s+/)
    .map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`)
    .join(" ");
}

function heroCard(c: SiteContent): string {
  const menu = c.sections.find((x) => x.type === "menu" && x.visible) as Extract<Section, { type: "menu" }> | undefined;
  const svc = c.sections.find((x) => x.type === "services" && x.visible) as Extract<Section, { type: "services" }> | undefined;
  const prod = c.sections.find((x) => x.type === "products" && x.visible) as Extract<Section, { type: "products" }> | undefined;
  const hours = c.sections.find((x) => x.type === "hours" && x.visible) as Extract<Section, { type: "hours" }> | undefined;
  let title = "";
  let rows: { name: string; meta: string }[] = [];
  if (menu && menu.categories.some((k) => k.items.length)) {
    title = "Do nosso cardápio";
    rows = menu.categories.flatMap((k) => k.items.map((i) => ({ name: i.name, meta: i.price || k.name }))).slice(0, 4);
  } else if (svc?.items.length) {
    title = svc.title || "Serviços";
    rows = svc.items.slice(0, 4).map((i) => ({ name: i.title, meta: i.price || "" }));
  } else if (prod?.items.length) {
    title = prod.title || "Destaques";
    rows = prod.items.slice(0, 4).map((i) => ({ name: i.name, meta: "" }));
  }
  if (!rows.length) return "";
  const lines = hours?.lines.filter((l) => l.value.trim()) ?? [];
  return `<aside class="hero-card" aria-hidden="true"><div class="hc-head"><span class="hc-badge">${icon(c.icon)}</span><div><strong>${esc(c.siteName)}</strong><span>${esc(title)}</span></div></div><ul>${rows
    .map((r, i) => `<li style="--i:${i}"><span>${esc(r.name)}</span>${r.meta ? `<em>${esc(r.meta)}</em>` : ""}</li>`)
    .join("")}</ul>${lines.length ? `<div class="hc-foot" data-hours='${esc(JSON.stringify(lines))}'>${icon("clock", "ci")}<span class="hc-today">Veja nossos horários</span></div>` : `<div class="hc-foot">${icon("chat", "ci")}<span>Atendimento pelo WhatsApp</span></div>`}</aside>`;
}

function sectionHtml(s: Section, c: SiteContent, n: number): string {
  const id = esc(s.id);
  switch (s.type) {
    case "hero": {
      const hasImg = !!s.image?.url && safeUrl(s.image.url) !== "#";
      const chips = [
        c.business.address && `<span class="chip">${icon("pin", "ci")}${esc(c.business.address.split(" - ").slice(-2).join(" - ").slice(0, 60))}</span>`,
        c.business.phone && `<span class="chip">${icon("phone", "ci")}${esc(c.business.phone)}</span>`,
      ].filter(Boolean);
      return `<section id="${id}" class="hero${hasImg ? " has-img" : ""}">
  <div class="hero-bg" aria-hidden="true">${hasImg ? `<div class="hero-photo" style="background-image:url('${esc(safeUrl(s.image!.url)).replace(/'/g, "%27")}')"></div>` : ""}<div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="pattern"></div><div class="grain"></div></div>
  <div class="wrap hero-grid">
  <div class="hero-inner">
    ${c.tagline ? `<span class="eyebrow hero-eyebrow">${icon(c.icon, "ei")}${esc(c.tagline)}</span>` : ""}
    <h1>${words(s.title)}</h1>
    <p class="lead">${esc(s.subtitle)}</p>
    <div class="actions">${s.buttons.map((b, i) => button(b, c, i === 0 ? "btn btn-main" : "btn btn-ghost")).join("")}</div>
    ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
  </div>
  ${heroCard(c)}
  </div>
  <a class="scroll-cue" href="#${esc(c.sections[n + 1]?.id ?? "contato")}" aria-label="Rolar para baixo"><span></span></a>
  ${hasImg && s.image?.credit ? `<p class="hero-credit">Foto: <a href="${esc(safeUrl(s.image.credit.link))}" target="_blank" rel="noopener noreferrer">${esc(s.image.credit.name)}</a> / Unsplash</p>` : ""}
</section>${c.marquee.length ? `<div class="marquee" aria-hidden="true"><div class="mq-track">${[...c.marquee, ...c.marquee, ...c.marquee, ...c.marquee].map((m) => `<span>${esc(m)}</span><i>${icon(c.icon, "mi")}</i>`).join("")}</div></div>` : ""}`;
    }
    case "highlights":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec hl"><div class="wrap">${s.title ? head(s.title) : ""}<div class="hl-grid">${s.items
        .map((it, i) => `<article class="hl-card rv" style="--d:${i}"><div class="hl-ic">${icon(it.icon)}</div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></article>`)
        .join("")}</div></div></section>`;
    case "about": {
      const visual = s.image?.url
        ? img(s.image, "about-img rv")
        : `<div class="about-art rv" aria-hidden="true"><div class="aa-ring"></div><div class="aa-mark">${icon(c.icon, "aa-ic")}</div><span class="aa-name">${esc(c.business.name)}</span></div>`;
      return `<section id="${id}" class="sec about"><div class="wrap split"><div class="about-text">${head(s.title, undefined, "Nossa história")}<div class="rv prose">${paras(s.text)}</div></div>${visual}</div></section>`;
    }
    case "services": {
      if (!s.items.length) return "";
      const priced = s.items.some((i) => i.price);
      if (c.style === "bold" || priced) {
        return `<section id="${id}" class="sec alt svc-list"><div class="wrap">${head(s.title, s.intro, "Serviços")}<ul class="price-list">${s.items
          .map(
            (it, i) =>
              `<li class="rv" style="--d:${i}"><span class="pl-ic">${icon(it.icon ?? c.icon)}</span><div class="pl-main"><div class="pl-row"><strong>${esc(it.title)}</strong><span class="dots"></span><span class="pl-price">${esc(it.price || "Consulte")}</span></div>${it.description ? `<p>${esc(it.description)}</p>` : ""}</div></li>`,
          )
          .join("")}</ul></div></section>`;
      }
      return `<section id="${id}" class="sec alt"><div class="wrap">${head(s.title, s.intro, "O que fazemos")}<div class="cards">${s.items
        .map((it, i) => `<article class="card rv" style="--d:${i}"><div class="card-ic">${icon(it.icon ?? c.icon)}</div><h3>${esc(it.title)}</h3><p>${esc(it.description)}</p></article>`)
        .join("")}</div></div></section>`;
    }
    case "products":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec alt"><div class="wrap">${head(s.title, s.intro, "Destaques")}<div class="cards prod">${s.items
        .map(
          (it, i) =>
            `<article class="card rv" style="--d:${i}">${it.image?.url ? img(it.image, "card-img") : `<div class="prod-art">${icon(c.icon)}</div>`}<h3>${esc(it.name)}</h3><p>${esc(it.description)}</p></article>`,
        )
        .join("")}</div></div></section>`;
    case "menu": {
      const cats = s.categories.filter((cat) => cat.items.length);
      if (!cats.length) return "";
      const anyPrice = cats.some((cat) => cat.items.some((i) => i.price));
      return `<section id="${id}" class="sec menu-sec"><div class="wrap">${head(s.title, s.intro, "Cardápio")}
<div class="tabs rv" role="tablist">${cats.map((cat, i) => `<button role="tab" class="tab${i === 0 ? " on" : ""}" data-tab="${i}" aria-selected="${i === 0}">${esc(cat.name)}</button>`).join("")}</div>
<div class="menu-panels">${cats
        .map(
          (cat, i) =>
            `<div class="menu-panel${i === 0 ? " on" : ""}" data-panel="${i}" role="tabpanel"><h3 class="mp-title">${esc(cat.name)}</h3><ul class="menu">${cat.items
              .map(
                (it, j) =>
                  `<li class="rv" style="--d:${j % 8}"><div class="m-row"><strong>${esc(it.name)}</strong><span class="dots"></span>${it.price ? `<span class="m-price">${esc(it.price)}</span>` : ""}</div>${it.description ? `<p>${esc(it.description)}</p>` : ""}</li>`,
              )
              .join("")}</ul></div>`,
        )
        .join("")}</div>
${anyPrice ? `<p class="fine">Valores e disponibilidade sujeitos a alteração.</p>` : `<p class="fine">Consulte valores e disponibilidade pelo WhatsApp.</p>`}</div></section>`;
    }
    case "steps":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec steps-sec"><div class="wrap">${head(s.title, s.intro, "Como funciona")}<ol class="steps">${s.items
        .map((it, i) => `<li class="rv" style="--d:${i}"><span class="st-n">${i + 1}</span><div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`)
        .join("")}</ol></div></section>`;
    case "hours": {
      const lines = s.lines.filter((l) => l.value.trim());
      if (!lines.length) return "";
      return `<section id="${id}" class="sec hours-sec"><div class="wrap narrow">${head(s.title, undefined, "Venha nos visitar")}<div class="hours-card rv">${icon("clock", "hc-ic")}<dl class="hours">${lines
        .map((l) => `<div data-day="${esc(l.label.toLowerCase())}"><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`)
        .join("")}</dl>${s.note ? `<p class="fine">${esc(s.note)}</p>` : ""}</div></div></section>`;
    }
    case "gallery":
      if (!s.images.length) return "";
      return `<section id="${id}" class="sec"><div class="wrap">${head(s.title)}<div class="gallery">${s.images.map((i, k) => img(i, `g-item rv`).replace('class="g-item rv"', `class="g-item rv" style="--d:${k}"`)).join("")}</div></div></section>`;
    case "faq":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec alt"><div class="wrap narrow">${head(s.title, undefined, "Dúvidas")}<div class="faq">${s.items
        .map((it, i) => `<details class="rv" style="--d:${i}"><summary>${esc(it.q)}<span class="fq-ic" aria-hidden="true"></span></summary><div class="fq-a">${paras(it.a)}</div></details>`)
        .join("")}</div></div></section>`;
    case "cta":
      return `<section id="${id}" class="cta"><div class="cta-bg" aria-hidden="true"><div class="shine"></div></div><div class="wrap narrow center rv"><h2>${esc(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}${button(s.button, c, "btn btn-light")}</div></section>`;
    case "quote": {
      const n = waNumber(c.business.whatsapp || c.business.phone);
      if (!n && !c.business.email) return "";
      return `<section id="${id}" class="sec alt"><div class="wrap split quote-split"><div>${head(s.title, s.text, "Orçamento")}<ul class="ticks rv"><li>${icon("check", "ti")}Resposta pelo WhatsApp</li><li>${icon("check", "ti")}Sem compromisso</li><li>${icon("check", "ti")}Atendimento direto com a equipe</li></ul></div>
<form class="quote rv" data-wa="${esc(n ?? "")}" data-email="${esc(c.business.email)}" data-biz="${esc(c.business.name)}">
  <label>Seu nome<input name="nome" required maxlength="80" autocomplete="name"></label>
  <label>O que você precisa?<textarea name="mensagem" required maxlength="800" rows="4"></textarea></label>
  <button class="btn btn-main" type="submit">${icon("chat", "bi")}<span>${esc(s.buttonLabel)}</span></button>
  <p class="fine">Seus dados não ficam guardados neste site: a mensagem abre no ${n ? "WhatsApp" : "seu e-mail"} para você enviar.</p>
</form></div></section>`;
    }
    case "contact": {
      const b = c.business;
      const n = waNumber(b.whatsapp || b.phone);
      const tel = digits(b.phone);
      const items = [
        b.address && `<li class="rv">${icon("pin", "ct-ic")}<div><strong>Endereço</strong><span>${esc(b.address)}</span></div></li>`,
        b.phone && `<li class="rv">${icon("phone", "ct-ic")}<div><strong>Telefone</strong><a href="tel:+${esc(tel.length <= 11 ? "55" + tel : tel)}">${esc(b.phone)}</a></div></li>`,
        n && `<li class="rv">${icon("chat", "ct-ic")}<div><strong>WhatsApp</strong><a href="https://wa.me/${n}" target="_blank" rel="noopener noreferrer">Enviar mensagem</a></div></li>`,
        b.email && `<li class="rv">${icon("chat", "ct-ic")}<div><strong>E-mail</strong><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></div></li>`,
        b.instagram &&
          `<li class="rv">${icon("heart", "ct-ic")}<div><strong>Instagram</strong><a href="${esc(safeUrl(b.instagram.startsWith("http") ? b.instagram : `https://instagram.com/${b.instagram.replace(/^@/, "")}`))}" target="_blank" rel="noopener noreferrer">${esc(b.instagram)}</a></div></li>`,
      ].filter(Boolean);
      return `<section id="${id}" class="sec contact-sec"><div class="wrap">${head(s.title, s.text, "Fale com a gente")}<ul class="contact">${items.join("")}</ul>${
        s.showMap && (b.mapsUrl || b.address) ? `<div class="center rv" style="margin-top:28px"><a class="btn btn-ghost" href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">${icon("pin", "bi")}<span>Como chegar</span></a></div>` : ""
      }</div></section>`;
    }
    case "text":
      return `<section id="${id}" class="sec"><div class="wrap narrow">${head(s.title)}<div class="rv prose">${paras(s.text)}</div></div></section>`;
  }
}

const NAV_LABELS: Partial<Record<Section["type"], string>> = {
  about: "Sobre",
  services: "Serviços",
  products: "Produtos",
  menu: "Cardápio",
  hours: "Horários",
  gallery: "Galeria",
  faq: "Dúvidas",
  quote: "Orçamento",
  contact: "Contato",
};

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function patternSvg(iconName: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><g transform="translate(28 28)" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".5">${icon(iconName).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}")`;
}

export function renderSite(c: SiteContent, opts: { footerCredit?: boolean } = { footerCredit: true }): string {
  const th = c.theme;
  const radius = th.radius === "none" ? "2px" : th.radius === "md" ? "12px" : "22px";
  const visible = c.sections.filter((s) => s.visible);
  const navItems = visible.filter((s) => {
    if (!NAV_LABELS[s.type]) return false;
    if (s.type === "gallery") return s.images.length > 0;
    if (s.type === "hours") return s.lines.some((l) => l.value.trim());
    return true;
  });
  const nav = navItems
    .map((s) => `<a href="#${esc(s.id)}">${esc(s.type === "services" || s.type === "products" ? s.title.split(" ").slice(0, 2).join(" ") : NAV_LABELS[s.type])}</a>`)
    .join("");
  const fonts = Array.from(new Set([th.headingFont, th.bodyFont]))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
    .join("&");
  const n = waNumber(c.business.whatsapp || c.business.phone);
  const ctaBtn = n ? `<a class="btn btn-main btn-sm head-cta" href="https://wa.me/${n}?text=${encodeURIComponent(`Olá! Vim pelo site da ${c.business.name}.`)}" target="_blank" rel="noopener noreferrer">${icon("chat", "bi")}<span>${c.style === "elegant" ? "Reservar" : "Fale conosco"}</span></a>` : "";
  const dark = isDark(th.background);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.seo.title || c.siteName)}</title>
<meta name="description" content="${esc(c.seo.description)}">
<meta property="og:title" content="${esc(c.seo.title || c.siteName)}">
<meta property="og:description" content="${esc(c.seo.description)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="${esc(th.background)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "LocalBusiness", name: c.business.name, telephone: c.business.phone || undefined, address: c.business.address || undefined, url: undefined }).replace(/</g, "\\u003c")}</script>
<style>
:root{--p:${th.primary};--p-rgb:${hexToRgb(th.primary)};--a:${th.accent};--a-rgb:${hexToRgb(th.accent)};--bg:${th.background};--sf:${th.surface};--tx:${th.text};--mu:${th.muted};--r:${radius};--hf:'${th.headingFont}',Georgia,serif;--bf:'${th.bodyFont}',system-ui,-apple-system,sans-serif;--line:color-mix(in srgb,var(--tx) 12%,transparent);--ease:cubic-bezier(.2,.7,.2,1)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:var(--bf);background:var(--bg);color:var(--tx);line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,h3{font-family:var(--hf);line-height:1.08;letter-spacing:-.015em;text-wrap:balance}
.wrap{width:min(1180px,100% - 40px);margin-inline:auto}
.narrow{width:min(820px,100% - 40px);margin-inline:auto}
.center{text-align:center}
.fine{font-size:.85rem;color:var(--mu);margin-top:18px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:.76rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--a)}
.ei{width:16px;height:16px}
.ic{width:26px;height:26px}
.bi{width:18px;height:18px;flex:none}

/* Cabeçalho */
.topbar{position:fixed;inset:0 0 auto;z-index:50;transition:background .4s var(--ease),box-shadow .4s,padding .4s;padding:18px 0}
.topbar.solid{background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 1px 0 var(--line);padding:10px 0}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--hf);font-weight:700;font-size:1.25rem;color:#fff;transition:color .4s}
.brand .bm{width:38px;height:38px;border-radius:calc(var(--r) * .6);display:grid;place-items:center;background:var(--a);color:#111}
.brand .bm svg{width:20px;height:20px}
.topbar.solid .brand{color:var(--tx)}
.nav{display:flex;align-items:center;gap:26px}
.nav a{text-decoration:none;font-size:.93rem;font-weight:500;color:rgba(255,255,255,.88);position:relative;transition:color .3s}
.nav a::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--a);transform:scaleX(0);transform-origin:left;transition:transform .35s var(--ease)}
.nav a:hover::after{transform:scaleX(1)}
.topbar.solid .nav a{color:var(--tx)}
#mt,.burger{display:none}

/* Botões */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:15px 28px;border-radius:var(--r);font-weight:700;font-size:1rem;text-decoration:none;border:0;cursor:pointer;font-family:inherit;transition:transform .3s var(--ease),box-shadow .3s,background .3s,color .3s;position:relative;overflow:hidden;isolation:isolate}
.btn-main{background:var(--a);color:#111;box-shadow:0 14px 30px -12px rgba(var(--a-rgb),.7)}
.btn-main::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-120%);transition:transform .7s var(--ease);z-index:-1}
.btn-main:hover::before{transform:translateX(120%)}
.btn:hover{transform:translateY(-3px)}
.btn-ghost{background:transparent;color:inherit;box-shadow:inset 0 0 0 2px currentColor}
.btn-ghost:hover{background:rgba(255,255,255,.08)}
.btn-light{background:#fff;color:var(--p)}
.btn-sm{padding:10px 18px;font-size:.9rem}

/* Capa */
.hero{position:relative;min-height:min(100vh,900px);display:flex;align-items:center;padding:150px 0 120px;color:#fff;overflow:hidden;background:color-mix(in srgb,var(--p) 55%,#05060a)}
.hero-bg{position:absolute;inset:0;overflow:hidden}
.hero-photo{position:absolute;inset:-4%;background-size:cover;background-position:center;animation:kb 22s ease-in-out infinite alternate;filter:saturate(1.05)}
.hero.has-img .hero-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.55) 50%,rgba(0,0,0,.25) 100%)}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.12) translate(-1%,-1%)}}
.orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.75;animation:float 16s ease-in-out infinite alternate}
.o1{width:46vw;height:46vw;max-width:620px;max-height:620px;background:var(--p);left:-12%;top:-20%}
.o2{width:36vw;height:36vw;max-width:480px;max-height:480px;background:var(--a);right:-8%;bottom:-25%;opacity:.45;animation-duration:20s}
.o3{width:24vw;height:24vw;max-width:320px;max-height:320px;background:color-mix(in srgb,var(--p) 50%,#fff);right:22%;top:8%;opacity:.25;animation-duration:24s}
.hero.has-img .orb{opacity:.28}
@keyframes float{0%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,8%) scale(1.08)}100%{transform:translate(-4%,3%) scale(.96)}}
.pattern{position:absolute;inset:0;background-image:${patternSvg(c.icon, "#ffffff")};opacity:.07;mask-image:radial-gradient(ellipse at 70% 40%,#000 0%,transparent 70%);animation:drift 60s linear infinite}
@keyframes drift{to{background-position:400px 400px}}
.grain{position:absolute;inset:0;opacity:.06;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:48px;align-items:center}
.hero-inner{position:relative;min-width:0}
.hero-card{justify-self:end;width:100%;max-width:380px;padding:24px;border-radius:calc(var(--r) * 1.2);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 40px 80px -30px rgba(0,0,0,.6);animation:up 1.1s .6s var(--ease) both,bob 7s 1.8s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-12px)}}
.hc-head{display:flex;gap:14px;align-items:center;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.14)}
.hc-badge{width:46px;height:46px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--a);color:#111}
.hc-badge svg{width:22px;height:22px}
.hc-head strong{display:block;font-family:var(--hf);font-size:1.1rem}
.hc-head span{font-size:.8rem;opacity:.75;text-transform:uppercase;letter-spacing:.12em}
.hero-card ul{list-style:none;padding:8px 0}
.hero-card li{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px dashed rgba(255,255,255,.14);font-size:.97rem;animation:up .8s var(--ease) both;animation-delay:calc(1s + var(--i) * .12s)}
.hero-card li em{font-style:normal;color:var(--a);font-size:.85rem;white-space:nowrap}
.hc-foot{display:flex;gap:10px;align-items:center;font-size:.88rem;opacity:.9;padding-top:8px}
.hero-eyebrow{color:var(--a);margin-bottom:22px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px);animation:up .9s var(--ease) both}
.hero h1{font-size:clamp(2.6rem,7.4vw,5.6rem);max-width:15ch;margin-bottom:22px}
.hero h1 .w{display:inline-block;animation:wup 1s var(--ease) both;animation-delay:calc(.15s + var(--i) * .08s)}
@keyframes wup{from{opacity:0;transform:translateY(40%) rotate(2deg);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.hero .lead{font-size:clamp(1.08rem,2vw,1.32rem);max-width:56ch;opacity:.9;margin-bottom:34px;animation:up 1s .55s var(--ease) both}
.actions{display:flex;flex-wrap:wrap;gap:14px;animation:up 1s .7s var(--ease) both}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:38px;animation:up 1s .85s var(--ease) both}
.chip{display:inline-flex;align-items:center;gap:8px;font-size:.88rem;padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.14)}
.ci{width:15px;height:15px;color:var(--a)}
.scroll-cue{position:absolute;left:50%;bottom:28px;width:28px;height:46px;border:2px solid rgba(255,255,255,.5);border-radius:20px;transform:translateX(-50%);z-index:2}
.scroll-cue span{position:absolute;left:50%;top:8px;width:4px;height:9px;margin-left:-2px;border-radius:2px;background:#fff;animation:cue 1.8s ease-in-out infinite}
@keyframes cue{0%{opacity:0;transform:translateY(0)}40%{opacity:1}100%{opacity:0;transform:translateY(16px)}}
.hero-credit{position:absolute;right:14px;bottom:10px;font-size:.7rem;opacity:.7;z-index:2}

/* Faixa animada */
.marquee{overflow:hidden;background:var(--a);color:#111;padding:16px 0;border-block:1px solid rgba(0,0,0,.1)}
.mq-track{display:flex;width:max-content;animation:mq 40s linear infinite;align-items:center}
.mq-track span{font-family:var(--hf);font-weight:700;font-size:1.15rem;white-space:nowrap;padding:0 22px;text-transform:uppercase;letter-spacing:.04em}
.mq-track i{display:grid}
.mi{width:20px;height:20px}
@keyframes mq{to{transform:translateX(-50%)}}

/* Seções */
.sec{padding:clamp(80px,11vw,140px) 0;position:relative}
.sec.alt{background:var(--sf)}
.sh{margin-bottom:clamp(36px,5vw,60px);max-width:720px}
.center .sh,.narrow .sh{margin-inline:auto;text-align:center}
.sh h2{font-size:clamp(2rem,4.6vw,3.3rem);margin-top:12px}
.lede{color:var(--mu);font-size:1.1rem;margin-top:14px}
.prose p{margin-bottom:16px;font-size:1.08rem;color:color-mix(in srgb,var(--tx) 86%,transparent)}
.split{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(36px,6vw,90px);align-items:center}

.hl{padding:clamp(60px,8vw,100px) 0}
.hl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px}
.hl-card{padding:30px;border-radius:var(--r);background:var(--sf);border:1px solid var(--line);transition:transform .4s var(--ease),border-color .4s}
.hl-card:hover{transform:translateY(-6px);border-color:rgba(var(--a-rgb),.6)}
.hl-ic{width:56px;height:56px;border-radius:calc(var(--r) * .7);display:grid;place-items:center;background:rgba(var(--p-rgb),.14);color:var(--p);margin-bottom:20px}
.hl-card h3{font-size:1.25rem;margin-bottom:8px}
.hl-card p{color:var(--mu)}

.about-art{position:relative;aspect-ratio:1;max-width:460px;width:100%;justify-self:center;border-radius:calc(var(--r) * 2);background:radial-gradient(circle at 30% 25%,rgba(var(--a-rgb),.55),transparent 55%),linear-gradient(145deg,var(--p),color-mix(in srgb,var(--p) 40%,#000));display:grid;place-items:center;overflow:hidden;box-shadow:0 40px 80px -40px rgba(var(--p-rgb),.8)}
.aa-ring{position:absolute;inset:12%;border-radius:50%;border:1px dashed rgba(255,255,255,.35);animation:spin 40s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.aa-mark{width:38%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);backdrop-filter:blur(8px);color:#fff;animation:pulse 4s ease-in-out infinite}
.aa-ic{width:46%;height:46%}
@keyframes pulse{50%{transform:scale(1.06)}}
.aa-name{position:absolute;bottom:9%;left:0;right:0;text-align:center;color:#fff;font-family:var(--hf);font-size:1.2rem;font-weight:700;padding:0 20px}
.about-img img{border-radius:calc(var(--r) * 1.5);aspect-ratio:4/5;object-fit:cover;width:100%;box-shadow:0 40px 80px -40px rgba(0,0,0,.6)}
figcaption{font-size:.72rem;color:var(--mu);margin-top:8px}
figcaption a{color:inherit}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}
.card{position:relative;padding:34px 30px;border-radius:var(--r);background:var(--bg);border:1px solid var(--line);transition:transform .45s var(--ease),box-shadow .45s,border-color .45s;overflow:hidden}
.card::after{content:"";position:absolute;inset:auto -40% -60% auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(var(--a-rgb),.25),transparent 70%);opacity:0;transition:opacity .5s}
.card:hover{transform:translateY(-8px);box-shadow:0 30px 60px -30px rgba(var(--p-rgb),.55);border-color:rgba(var(--p-rgb),.4)}
.card:hover::after{opacity:1}
.card-ic{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:var(--p);color:#fff;margin-bottom:22px;transition:transform .5s var(--ease)}
.card:hover .card-ic{transform:rotate(-8deg) scale(1.08)}
.card h3{font-size:1.3rem;margin-bottom:10px}
.card p{color:var(--mu)}
.prod-art{aspect-ratio:4/3;border-radius:calc(var(--r) * .7);margin:-10px -6px 22px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(var(--p-rgb),.18),rgba(var(--a-rgb),.18));color:var(--p)}
.prod-art svg{width:56px;height:56px}
.card-img img{border-radius:calc(var(--r) * .7);margin-bottom:20px;aspect-ratio:4/3;object-fit:cover;width:100%}

.price-list{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:4px 48px}
.price-list li{display:flex;gap:18px;padding:22px 0;border-bottom:1px solid var(--line)}
.pl-ic{width:48px;height:48px;flex:none;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(var(--a-rgb),.5);color:var(--a)}
.pl-ic svg{width:22px;height:22px}
.pl-main{flex:1;min-width:0}
.pl-row,.m-row{display:flex;align-items:baseline;gap:12px}
.pl-row strong,.m-row strong{font-family:var(--hf);font-size:1.18rem}
.dots{flex:1;border-bottom:2px dotted color-mix(in srgb,var(--tx) 30%,transparent);transform:translateY(-5px);min-width:20px}
.pl-price,.m-price{font-weight:800;color:var(--a);white-space:nowrap}
.pl-main p{color:var(--mu);margin-top:4px;font-size:.96rem}

.menu-sec{background:var(--sf)}
.tabs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:40px}
.tab{font:inherit;font-weight:700;padding:11px 22px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--tx);cursor:pointer;transition:all .35s var(--ease)}
.tab:hover{border-color:var(--a)}
.tab.on{background:var(--a);color:#111;border-color:var(--a);box-shadow:0 10px 24px -10px rgba(var(--a-rgb),.8)}
.mp-title{display:none;font-size:1.6rem;margin:10px 0 18px}
.js .menu-panel{display:none}
.js .menu-panel.on{display:block;animation:up .6s var(--ease) both}
html:not(.js) .mp-title{display:block}
.menu{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:6px 56px}
.menu li{padding:20px 0;border-bottom:1px solid var(--line)}
.menu li p{color:var(--mu);margin-top:6px;font-size:.96rem}

.steps{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:26px;counter-reset:s}
.steps li{display:flex;gap:18px;padding:28px;border-radius:var(--r);border:1px solid var(--line);background:var(--bg);position:relative}
.st-n{flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-family:var(--hf);font-weight:800;font-size:1.3rem;background:linear-gradient(135deg,var(--p),var(--a));color:#fff}
.steps h3{font-size:1.2rem;margin-bottom:6px}
.steps p{color:var(--mu)}

.hours-card{position:relative;padding:40px clamp(24px,5vw,56px);border-radius:calc(var(--r) * 1.4);background:var(--sf);border:1px solid var(--line);overflow:hidden}
.hc-ic{position:absolute;right:-30px;top:-30px;width:180px;height:180px;color:rgba(var(--p-rgb),.08)}
.hours div{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--line);transition:color .3s}
.hours div.today{color:var(--a);font-weight:700}
.hours div.today dt::after{content:"hoje";margin-left:10px;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;background:var(--a);color:#111;padding:2px 8px;border-radius:999px;vertical-align:middle}
.hours dt{font-weight:600}

.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.g-item{overflow:hidden;border-radius:var(--r)}
.g-item img{aspect-ratio:1;object-fit:cover;width:100%;transition:transform .8s var(--ease)}
.g-item:hover img{transform:scale(1.08)}

.faq{display:grid;gap:12px}
.faq details{border:1px solid var(--line);border-radius:var(--r);background:var(--bg);overflow:hidden}
.faq summary{list-style:none;cursor:pointer;padding:22px 26px;font-weight:700;font-size:1.06rem;display:flex;justify-content:space-between;gap:20px;align-items:center}
.faq summary::-webkit-details-marker{display:none}
.fq-ic{width:22px;height:22px;flex:none;position:relative}
.fq-ic::before,.fq-ic::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:2px;background:var(--a);transform:translate(-50%,-50%);transition:transform .35s var(--ease)}
.fq-ic::after{transform:translate(-50%,-50%) rotate(90deg)}
details[open] .fq-ic::after{transform:translate(-50%,-50%) rotate(0)}
.fq-a{padding:0 26px 22px;color:var(--mu)}
details[open] .fq-a{animation:up .45s var(--ease) both}

.cta{position:relative;padding:clamp(90px,12vw,150px) 0;color:#fff;overflow:hidden;background:linear-gradient(120deg,var(--p),color-mix(in srgb,var(--p) 60%,#000))}
.cta-bg{position:absolute;inset:0;background-image:${patternSvg(c.icon, "#ffffff")};opacity:.1}
.shine{position:absolute;inset:-50%;background:conic-gradient(from 0deg,transparent,rgba(var(--a-rgb),.35),transparent 30%);animation:spin 14s linear infinite}
.cta .wrap{position:relative;z-index:1}
.cta h2{font-size:clamp(2.1rem,5vw,3.6rem);margin-bottom:16px}
.cta p{font-size:1.15rem;opacity:.9;margin-bottom:34px}

.ticks{list-style:none;display:grid;gap:12px;margin-top:10px}
.ticks li{display:flex;align-items:center;gap:12px;font-weight:600}
.ti{width:22px;height:22px;padding:3px;border-radius:50%;background:var(--a);color:#111}
.quote{display:grid;gap:18px;padding:clamp(26px,4vw,44px);border-radius:calc(var(--r) * 1.3);background:var(--bg);border:1px solid var(--line);box-shadow:0 40px 80px -50px rgba(var(--p-rgb),.6)}
.quote label{display:grid;gap:8px;font-weight:600;font-size:.95rem}
.quote input,.quote textarea{font:inherit;padding:14px 16px;border-radius:calc(var(--r) * .6);border:1px solid var(--line);background:var(--sf);color:var(--tx);transition:border-color .3s,box-shadow .3s}
.quote input:focus,.quote textarea:focus{outline:none;border-color:var(--a);box-shadow:0 0 0 4px rgba(var(--a-rgb),.2)}

.contact{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}
.contact li{display:flex;gap:16px;padding:26px;border-radius:var(--r);background:var(--sf);border:1px solid var(--line);transition:transform .4s var(--ease),border-color .4s}
.contact li:hover{transform:translateY(-4px);border-color:rgba(var(--a-rgb),.5)}
.ct-ic{width:46px;height:46px;flex:none;padding:11px;border-radius:50%;background:rgba(var(--p-rgb),.14);color:var(--p)}
.contact strong{display:block;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:var(--mu);margin-bottom:4px}
.contact a{color:var(--tx);font-weight:600;text-decoration-color:rgba(var(--a-rgb),.6);text-underline-offset:4px}
.contact span{overflow-wrap:anywhere}

footer{padding:60px 0 40px;background:color-mix(in srgb,var(--bg) 70%,#000);color:color-mix(in srgb,var(--tx) 75%,transparent);border-top:1px solid var(--line)}
.f-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:30px;align-items:center;padding-bottom:34px;border-bottom:1px solid var(--line)}
.f-brand{font-family:var(--hf);font-size:1.6rem;font-weight:700;color:var(--tx)}
.f-nav{display:flex;flex-wrap:wrap;gap:22px}
.f-nav a{text-decoration:none;font-size:.92rem}
.f-nav a:hover{color:var(--a)}
.f-bot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding-top:24px;font-size:.84rem}

.wa-float{position:fixed;right:22px;bottom:22px;width:62px;height:62px;border-radius:50%;background:#25d366;display:grid;place-items:center;box-shadow:0 12px 30px rgba(0,0,0,.3);z-index:60;transition:transform .3s var(--ease)}
.wa-float::before{content:"";position:absolute;inset:0;border-radius:50%;background:#25d366;animation:ring 2.4s ease-out infinite;z-index:-1}
@keyframes ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.7);opacity:0}}
.wa-float:hover{transform:scale(1.08)}
.wa-float svg{width:32px;height:32px;fill:#fff}
.progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--p),var(--a));z-index:70;width:0}

/* Entrada ao rolar: conteúdo visível sem JS; com JS anima ao entrar na tela */
.js .rv{opacity:0;transform:translateY(34px);transition:opacity .9s var(--ease),transform .9s var(--ease);transition-delay:calc(var(--d,0) * 90ms)}
.js .rv.in{opacity:1;transform:none}

/* Estilos por segmento */
.st-elegant h1,.st-elegant h2,.st-elegant h3{font-weight:600;letter-spacing:0}
.st-elegant .sh h2::after,.st-editorial .sh h2::after{content:"";display:block;width:64px;height:2px;background:var(--a);margin-top:22px}
.st-elegant .center .sh h2::after,.st-elegant .narrow .sh h2::after{margin-inline:auto}
.st-elegant .eyebrow::before,.st-elegant .eyebrow::after{content:"✦";font-size:.7rem}
.st-bold h1,.st-bold h2{text-transform:uppercase;letter-spacing:.01em}
.st-bold .hero h1{font-size:clamp(3rem,10vw,7.4rem);line-height:.92}
.st-bold .sec.alt{background-image:repeating-linear-gradient(135deg,transparent 0 22px,rgba(255,255,255,.02) 22px 44px)}
.st-industrial .sec.alt{background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:44px 44px}
.st-industrial .eyebrow{font-family:ui-monospace,Menlo,monospace;letter-spacing:.08em}
.st-industrial .card{border-left:4px solid var(--a)}
.st-industrial .hero h1{text-transform:uppercase}
.st-clean .card-ic,.st-corporate .card-ic{background:rgba(var(--p-rgb),.12);color:var(--p)}
.st-editorial h1,.st-editorial h2{font-weight:600;font-style:italic}
.st-editorial .hero h1{font-style:normal}
.st-corporate .hero{min-height:min(88vh,820px)}

@media (max-width:860px){
  .burger{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;cursor:pointer;color:#fff;background:rgba(255,255,255,.1)}
  .topbar.solid .burger{color:var(--tx);background:var(--sf)}
  .burger span,.burger span::before,.burger span::after{display:block;width:20px;height:2px;background:currentColor;position:relative;transition:transform .3s}
  .burger span::before,.burger span::after{content:"";position:absolute;left:0}
  .burger span::before{top:-6px}.burger span::after{top:6px}
  #mt:checked ~ .burger span{background:transparent}
  #mt:checked ~ .burger span::before{transform:translateY(6px) rotate(45deg)}
  #mt:checked ~ .burger span::after{transform:translateY(-6px) rotate(-45deg)}
  .nav{position:fixed;inset:68px 14px auto;flex-direction:column;align-items:stretch;gap:0;padding:10px;border-radius:18px;background:var(--bg);box-shadow:0 30px 60px rgba(0,0,0,.35);transform:translateY(-12px);opacity:0;pointer-events:none;transition:all .35s var(--ease)}
  .nav a{color:var(--tx)!important;padding:14px 16px;border-radius:12px}
  .nav a::after{display:none}
  .nav .head-cta{margin-top:6px}
  #mt:checked ~ .nav{transform:none;opacity:1;pointer-events:auto}
  .split,.hero-grid{grid-template-columns:1fr}
  .hero-card{justify-self:start;max-width:100%}
  .hero{padding:130px 0 110px;min-height:auto}
  .scroll-cue{display:none}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.js .rv{opacity:1;transform:none}}
</style>
</head>
<body class="st-${esc(c.style)}${dark ? " dark" : ""}">
<script>document.documentElement.classList.add('js')</script>
<div class="progress" id="pg"></div>
<header class="topbar" id="top"><div class="wrap">
  <a class="brand" href="#"><span class="bm">${icon(c.icon)}</span><span>${esc(c.siteName)}</span></a>
  <input type="checkbox" id="mt" aria-label="Abrir menu"><label class="burger" for="mt" aria-hidden="true"><span></span></label>
  <nav class="nav">${nav}${ctaBtn}</nav>
</div></header>
<main>
${visible.map((s) => sectionHtml(s, c, c.sections.indexOf(s))).join("\n")}
</main>
<footer><div class="wrap">
  <div class="f-top"><span class="f-brand">${esc(c.siteName)}</span><nav class="f-nav">${nav}</nav></div>
  <div class="f-bot"><span>© <span id="yr">${new Date().getFullYear()}</span> ${esc(c.business.name)}. Todos os direitos reservados.</span>${opts.footerCredit ? `<span>Site criado com SiteHunter AI</span>` : ""}</div>
</div></footer>
${
  n
    ? `<a class="wa-float" href="https://wa.me/${n}?text=${encodeURIComponent(`Olá! Vim pelo site da ${c.business.name}.`)}" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg></a>`
    : ""
}
<script>
(function(){
var top=document.getElementById('top'),pg=document.getElementById('pg');
function onScroll(){var y=window.scrollY||0;top.classList.toggle('solid',y>40);var h=document.documentElement.scrollHeight-innerHeight;pg.style.width=(h>0?y/h*100:0)+'%';}
addEventListener('scroll',onScroll,{passive:true});onScroll();
var els=[].slice.call(document.querySelectorAll('.rv'));
function showAll(){els.forEach(function(e){e.classList.add('in')})}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -40px 0px'});els.forEach(function(e){io.observe(e)});}else showAll();
setTimeout(function(){els.forEach(function(e){var r=e.getBoundingClientRect();if(r.top<innerHeight)e.classList.add('in')})},300);
document.querySelectorAll('.tabs').forEach(function(t){var sec=t.closest('section');t.addEventListener('click',function(ev){var b=ev.target.closest('.tab');if(!b)return;t.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-selected',x===b)});sec.querySelectorAll('.menu-panel').forEach(function(p){var on=p.getAttribute('data-panel')===b.getAttribute('data-tab');p.classList.toggle('on',on);if(on)p.querySelectorAll('.rv').forEach(function(e){e.classList.add('in')})})})});
var days=['domingo','segunda','terça','quarta','quinta','sexta','sábado'],today=days[new Date().getDay()];
document.querySelectorAll('.hc-foot[data-hours]').forEach(function(f){try{var ls=JSON.parse(f.getAttribute('data-hours'));for(var i=0;i<ls.length;i++){if(ls[i].label.toLowerCase().indexOf(today)===0){f.querySelector('.hc-today').textContent='Hoje: '+ls[i].value;}}}catch(e){}});
document.querySelectorAll('.hours div[data-day]').forEach(function(d){if(d.getAttribute('data-day').indexOf(today)===0)d.classList.add('today')});
document.querySelectorAll('form.quote').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f);var msg='Olá! Meu nome é '+d.get('nome')+'. Vim pelo site da '+f.dataset.biz+'.\\n\\n'+d.get('mensagem');if(f.dataset.wa){window.open('https://wa.me/'+f.dataset.wa+'?text='+encodeURIComponent(msg),'_blank','noopener');}else if(f.dataset.email){location.href='mailto:'+f.dataset.email+'?subject='+encodeURIComponent('Orçamento')+'&body='+encodeURIComponent(msg);}});});
document.querySelectorAll('.nav a').forEach(function(a){a.addEventListener('click',function(){var t=document.getElementById('mt');if(t)t.checked=false;});});
})();
</script>
</body>
</html>`;
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/** Política de segurança de conteúdo aplicada aos sites publicados. */
export const PUBLISHED_SITE_CSP = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");
