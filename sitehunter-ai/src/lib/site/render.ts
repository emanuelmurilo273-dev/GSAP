import type { Section, SiteButton, SiteContent, SiteImage } from "./types";

// Renderizador puro: converte o conteúdo do projeto em um HTML estático
// completo. Todo texto é escapado e toda URL é validada — o conteúdo do
// usuário nunca vira código executável no site publicado.

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

function nl2p(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function digits(s: string) {
  return s.replace(/\D/g, "");
}

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
  return `<a class="${cls}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(b.label)}</a>`;
}

function img(i: SiteImage | undefined, cls = ""): string {
  if (!i?.url) return "";
  const src = safeUrl(i.url);
  if (src === "#") return "";
  const credit = i.credit
    ? `<figcaption>Foto: <a href="${esc(safeUrl(i.credit.link))}" target="_blank" rel="noopener noreferrer">${esc(i.credit.name)}</a> / Unsplash</figcaption>`
    : "";
  return `<figure class="${cls}"><img src="${esc(src)}" alt="${esc(i.alt)}" loading="lazy">${credit}</figure>`;
}

function sectionHtml(s: Section, c: SiteContent): string {
  const head = (title: string, intro?: string) =>
    `<header class="sec-head"><h2>${esc(title)}</h2>${intro ? `<p class="muted">${esc(intro)}</p>` : ""}</header>`;
  switch (s.type) {
    case "hero":
      return `<section id="${esc(s.id)}" class="hero${s.image?.url ? " has-img" : ""}">
  ${s.image?.url ? `<div class="hero-bg" style="background-image:url('${esc(safeUrl(s.image.url)).replace(/'/g, "%27")}')" role="img" aria-label="${esc(s.image.alt)}"></div>` : ""}
  <div class="wrap hero-inner">
    <h1>${esc(s.title)}</h1>
    <p class="lead">${esc(s.subtitle)}</p>
    <div class="actions">${s.buttons.map((b, i) => button(b, c, i === 0 ? "btn" : "btn btn-ghost")).join("")}</div>
  </div>
  ${s.image?.credit ? `<p class="hero-credit">Foto: <a href="${esc(safeUrl(s.image.credit.link))}" target="_blank" rel="noopener noreferrer">${esc(s.image.credit.name)}</a> / Unsplash</p>` : ""}
</section>`;
    case "about":
      return `<section id="${esc(s.id)}"><div class="wrap ${s.image?.url ? "split" : "narrow"}"><div>${head(s.title)}${nl2p(s.text)}</div>${img(s.image, "rounded")}</div></section>`;
    case "services":
      return `<section id="${esc(s.id)}" class="alt"><div class="wrap">${head(s.title, s.intro)}<div class="grid">${s.items
        .map((i) => `<article class="card"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p></article>`)
        .join("")}</div></div></section>`;
    case "products":
      return `<section id="${esc(s.id)}" class="alt"><div class="wrap">${head(s.title, s.intro)}<div class="grid">${s.items
        .map((i) => `<article class="card">${img(i.image, "card-img")}<h3>${esc(i.name)}</h3><p>${esc(i.description)}</p></article>`)
        .join("")}</div></div></section>`;
    case "menu":
      return `<section id="${esc(s.id)}" class="alt"><div class="wrap narrow">${head(s.title, s.intro)}${s.categories
        .map(
          (cat) =>
            `<div class="menu-cat"><h3>${esc(cat.name)}</h3><ul class="menu">${cat.items
              .map(
                (i) =>
                  `<li><div><strong>${esc(i.name)}</strong>${i.description ? `<span class="muted">${esc(i.description)}</span>` : ""}</div>${i.price ? `<span class="price">${esc(i.price)}</span>` : ""}</li>`,
              )
              .join("")}</ul></div>`,
        )
        .join("")}</div></section>`;
    case "hours": {
      const lines = s.lines.filter((l) => l.value.trim());
      if (!lines.length) return "";
      return `<section id="${esc(s.id)}"><div class="wrap narrow">${head(s.title)}<dl class="hours">${lines
        .map((l) => `<div><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`)
        .join("")}</dl></div></section>`;
    }
    case "gallery":
      if (!s.images.length) return "";
      return `<section id="${esc(s.id)}"><div class="wrap">${head(s.title)}<div class="gallery">${s.images.map((i) => img(i)).join("")}</div></div></section>`;
    case "cta":
      return `<section id="${esc(s.id)}" class="cta"><div class="wrap narrow center"><h2>${esc(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}${button(s.button, c, "btn btn-light")}</div></section>`;
    case "quote": {
      const n = waNumber(c.business.whatsapp || c.business.phone);
      if (!n && !c.business.email) return "";
      return `<section id="${esc(s.id)}" class="alt"><div class="wrap narrow">${head(s.title, s.text)}
<form class="quote" data-wa="${esc(n ?? "")}" data-email="${esc(c.business.email)}" data-biz="${esc(c.business.name)}">
  <label>Seu nome<input name="nome" required maxlength="80" autocomplete="name"></label>
  <label>O que você precisa?<textarea name="mensagem" required maxlength="800" rows="4"></textarea></label>
  <button class="btn" type="submit">${esc(s.buttonLabel)}</button>
  <p class="muted small">Seus dados não são armazenados por este site: a mensagem é aberta no ${n ? "WhatsApp" : "seu e-mail"} para você enviar.</p>
</form></div></section>`;
    }
    case "contact": {
      const b = c.business;
      const n = waNumber(b.whatsapp || b.phone);
      const items = [
        b.address && `<li><strong>Endereço</strong><span>${esc(b.address)}</span></li>`,
        b.phone && `<li><strong>Telefone</strong><a href="tel:+${esc(digits(b.phone).length <= 11 ? "55" + digits(b.phone) : digits(b.phone))}">${esc(b.phone)}</a></li>`,
        n && `<li><strong>WhatsApp</strong><a href="https://wa.me/${n}" target="_blank" rel="noopener noreferrer">Enviar mensagem</a></li>`,
        b.email && `<li><strong>E-mail</strong><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
        b.instagram && `<li><strong>Instagram</strong><a href="${esc(safeUrl(b.instagram.startsWith("http") ? b.instagram : `https://instagram.com/${b.instagram.replace(/^@/, "")}`))}" target="_blank" rel="noopener noreferrer">${esc(b.instagram)}</a></li>`,
      ].filter(Boolean);
      return `<section id="${esc(s.id)}"><div class="wrap narrow">${head(s.title, s.text)}<ul class="contact">${items.join("")}</ul>${
        s.showMap && (b.mapsUrl || b.address) ? `<a class="btn btn-ghost" href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>` : ""
      }</div></section>`;
    }
    case "text":
      return `<section id="${esc(s.id)}"><div class="wrap narrow">${head(s.title)}${nl2p(s.text)}</div></section>`;
  }
}

const NAV_LABELS: Partial<Record<Section["type"], string>> = {
  about: "Sobre",
  services: "Serviços",
  products: "Produtos",
  menu: "Cardápio",
  hours: "Horários",
  gallery: "Galeria",
  quote: "Orçamento",
  contact: "Contato",
};

export function renderSite(c: SiteContent, opts: { footerCredit?: boolean } = { footerCredit: true }): string {
  const th = c.theme;
  const radius = th.radius === "none" ? "0px" : th.radius === "md" ? "10px" : "18px";
  const visible = c.sections.filter((s) => s.visible);
  const nav = visible
    .filter((s) => NAV_LABELS[s.type] && !(s.type === "gallery" && s.images.length === 0))
    .map((s) => `<a href="#${esc(s.id)}">${esc(s.type === "services" || s.type === "products" || s.type === "menu" ? s.title : NAV_LABELS[s.type])}</a>`)
    .join("");
  const fonts = Array.from(new Set([th.headingFont, th.bodyFont]))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`)
    .join("&");
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.seo.title || c.siteName)}</title>
<meta name="description" content="${esc(c.seo.description)}">
<meta property="og:title" content="${esc(c.seo.title || c.siteName)}">
<meta property="og:description" content="${esc(c.seo.description)}">
<meta name="theme-color" content="${esc(th.primary)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>
:root{--p:${th.primary};--a:${th.accent};--bg:${th.background};--sf:${th.surface};--tx:${th.text};--mu:${th.muted};--r:${radius};--hf:'${th.headingFont}',system-ui,sans-serif;--bf:'${th.bodyFont}',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--bf);background:var(--bg);color:var(--tx);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:var(--p)}
h1,h2,h3{font-family:var(--hf);line-height:1.15;letter-spacing:-.01em}
.wrap{width:min(1120px,100% - 32px);margin-inline:auto}
.narrow{width:min(760px,100% - 32px);margin-inline:auto}
.center{text-align:center}
.muted{color:var(--mu)}
.small{font-size:.85rem}
.topbar{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid color-mix(in srgb,var(--tx) 8%,transparent)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.brand{font-family:var(--hf);font-weight:700;font-size:1.2rem;color:var(--tx);text-decoration:none}
.nav{display:flex;gap:22px}
.nav a{color:var(--tx);text-decoration:none;font-size:.95rem;opacity:.85}
.nav a:hover{opacity:1;color:var(--p)}
#menu-toggle,.burger{display:none}
section{padding:72px 0}
section.alt{background:var(--sf)}
.sec-head{margin-bottom:28px}
.sec-head h2{font-size:clamp(1.6rem,3.5vw,2.3rem);margin-bottom:8px}
.hero{position:relative;padding:120px 0 110px;background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 55%,#000));color:#fff;overflow:hidden}
.hero.has-img{background:#000}
.hero-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.45}
.hero-inner{position:relative}
.hero h1{font-size:clamp(2.2rem,6vw,4rem);max-width:820px;margin-bottom:16px}
.hero .lead{font-size:clamp(1.05rem,2.2vw,1.3rem);max-width:640px;opacity:.92;margin-bottom:28px}
.hero-credit{position:absolute;right:12px;bottom:8px;font-size:.7rem;opacity:.7}
.hero-credit a{color:#fff}
.actions{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-block;background:var(--a);color:#111;font-weight:700;padding:14px 26px;border-radius:var(--r);text-decoration:none;border:0;cursor:pointer;font:inherit;font-weight:700;transition:transform .15s ease,filter .15s ease}
.btn:hover{transform:translateY(-2px);filter:brightness(1.05)}
.btn-ghost{background:transparent;color:inherit;border:2px solid currentColor}
.btn-light{background:#fff;color:var(--p)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
.card{background:var(--bg);border:1px solid color-mix(in srgb,var(--tx) 10%,transparent);border-radius:var(--r);padding:24px;transition:transform .2s ease,box-shadow .2s ease}
.card:hover{transform:translateY(-3px);box-shadow:0 12px 30px -12px color-mix(in srgb,var(--p) 45%,transparent)}
.card h3{font-size:1.15rem;margin-bottom:6px;color:var(--p)}
.card-img img{border-radius:calc(var(--r) - 4px);margin-bottom:14px;aspect-ratio:4/3;object-fit:cover;width:100%}
.split{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
.split p,.narrow p{margin-bottom:12px}
.rounded img{border-radius:var(--r);aspect-ratio:4/3;object-fit:cover;width:100%}
figcaption{font-size:.72rem;color:var(--mu);margin-top:6px}
figcaption a{color:inherit}
.menu-cat{margin-bottom:28px}
.menu-cat h3{color:var(--p);margin-bottom:10px}
.menu{list-style:none}
.menu li{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px dashed color-mix(in srgb,var(--tx) 18%,transparent)}
.menu li span.muted{display:block;font-size:.92rem}
.price{font-weight:700;white-space:nowrap;color:var(--p)}
.hours div{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--tx) 10%,transparent)}
.hours dt{font-weight:600}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.gallery img{border-radius:var(--r);aspect-ratio:1;object-fit:cover;width:100%}
.cta{background:var(--p);color:#fff}
.cta h2{font-size:clamp(1.6rem,4vw,2.4rem);margin-bottom:12px}
.cta p{margin-bottom:22px;opacity:.92}
.contact{list-style:none;display:grid;gap:14px;margin-bottom:22px}
.contact li{display:flex;flex-direction:column;padding:16px 18px;background:var(--sf);border-radius:var(--r)}
.contact strong{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mu)}
.quote{display:grid;gap:14px}
.quote label{display:grid;gap:6px;font-weight:600}
.quote input,.quote textarea{font:inherit;padding:12px 14px;border-radius:var(--r);border:1px solid color-mix(in srgb,var(--tx) 20%,transparent);background:var(--bg);color:var(--tx)}
footer{padding:32px 0;border-top:1px solid color-mix(in srgb,var(--tx) 10%,transparent);font-size:.88rem;color:var(--mu)}
footer .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
footer a{color:inherit}
.wa-float{position:fixed;right:18px;bottom:18px;width:56px;height:56px;border-radius:50%;background:#25d366;display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:30}
.wa-float svg{width:30px;height:30px;fill:#fff}
@media (max-width:820px){
  .burger{display:block;cursor:pointer;font-size:1.6rem;line-height:1;color:var(--tx)}
  .nav{display:none;position:absolute;top:64px;left:0;right:0;flex-direction:column;gap:0;background:var(--bg);border-bottom:1px solid color-mix(in srgb,var(--tx) 10%,transparent)}
  .nav a{padding:14px 16px}
  #menu-toggle:checked ~ .nav{display:flex}
  .split{grid-template-columns:1fr}
  section{padding:56px 0}
  .hero{padding:88px 0 80px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<header class="topbar"><div class="wrap">
  <a class="brand" href="#">${esc(c.siteName)}</a>
  <input type="checkbox" id="menu-toggle" aria-label="Abrir menu"><label class="burger" for="menu-toggle" aria-hidden="true">☰</label>
  <nav class="nav">${nav}</nav>
</div></header>
<main>
${visible.map((s) => sectionHtml(s, c)).join("\n")}
</main>
<footer><div class="wrap"><span>© ${year} ${esc(c.business.name)}</span>${opts.footerCredit ? `<span>Site criado com SiteHunter AI</span>` : ""}</div></footer>
${(() => {
  const n = waNumber(c.business.whatsapp || c.business.phone);
  return n
    ? `<a class="wa-float" href="https://wa.me/${n}" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg></a>`
    : "";
})()}
<script>
document.querySelectorAll('form.quote').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f);var msg='Olá! Meu nome é '+d.get('nome')+'. Vim pelo site da '+f.dataset.biz+'.\\n\\n'+d.get('mensagem');if(f.dataset.wa){window.open('https://wa.me/'+f.dataset.wa+'?text='+encodeURIComponent(msg),'_blank','noopener');}else if(f.dataset.email){location.href='mailto:'+f.dataset.email+'?subject='+encodeURIComponent('Orçamento')+'&body='+encodeURIComponent(msg);}});});
document.querySelectorAll('.nav a').forEach(function(a){a.addEventListener('click',function(){var t=document.getElementById('menu-toggle');if(t)t.checked=false;});});
</script>
</body>
</html>`;
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
