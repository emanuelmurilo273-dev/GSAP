import type { Section, SiteButton, SiteContent, SiteImage } from "./types";
import { renderImmersive } from "./immersive/render";
import { STYLE_INFO, contrast, googleFontsHref, mix, onColor, readableOn, type SiteStyle } from "./styles";
import { objectKindFor, objectSvg, posesFor } from "./stage";

// Renderizador puro: converte o conteúdo do projeto em um HTML estático
// completo. Todo texto é escapado e toda URL é validada — o conteúdo do
// usuário nunca vira código executável no site publicado.
//
// Cada direção visual (src/lib/site/styles.ts) tem capa, composição de seções,
// botões e ornamentos próprios. Sem fotos, cada direção usa uma composição
// gráfica própria (SVG inline) em vez de deixar buracos.

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

export function nl2p(text: string): string {
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

/**
 * Número para WhatsApp. No Brasil só celulares (DDD + 9 + 8 dígitos): oferecer WhatsApp para um
 * telefone fixo seria supor algo não verificado. O usuário pode informar outro número na aba Empresa.
 */
export function waNumber(whatsapp: string | null | undefined): string | null {
  // O campo WhatsApp só guarda números confirmados (publicados como WhatsApp ou confirmados pelo usuário),
  // então aqui basta normalizar: inclui WhatsApp Business em número fixo.
  let d = digits(whatsapp ?? "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.startsWith("55")) return /^55\d{10,11}$/.test(d) ? d : null;
  return /^\d{11,15}$/.test(d) ? d : null;
}

export function telHref(phone: string) {
  const d = digits(phone);
  return d ? `tel:+${d.length <= 11 ? "55" + d : d}` : "#contato";
}

export function mapsHref(c: SiteContent): string {
  if (c.business.mapsUrl) return safeUrl(c.business.mapsUrl);
  if (c.business.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.business.address)}`;
  return "#contato";
}

function buttonHref(b: SiteButton, c: SiteContent): string {
  switch (b.action) {
    case "whatsapp": {
      const n = waNumber(c.business.whatsapp);
      return n ? `https://wa.me/${n}?text=${encodeURIComponent(`Olá! Vim pelo site da ${c.business.name}.`)}` : "#contato";
    }
    case "phone":
      return telHref(c.business.phone);
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

export function button(b: SiteButton, c: SiteContent, cls = "btn"): string {
  const href = buttonHref(b, c);
  const external = /^https?:/.test(href);
  return `<a class="${cls}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(b.label)}</a>`;
}

/** Crédito / aviso de origem. Imagens geradas por IA SEMPRE levam o aviso. */
export function imageCaption(i: SiteImage, tag = "figcaption", cls = ""): string {
  const c = (extra: string) => {
    const all = [cls, extra].filter(Boolean).join(" ");
    return all ? ` class="${all}"` : "";
  };
  if (i.origin === "generated") return `<${tag}${c("gen-note")}>Imagem ilustrativa gerada por IA${i.generator ? ` (${esc(i.generator)})` : ""}</${tag}>`;
  if (i.origin === "company") {
    // Foto da própria empresa (site oficial ou perfil no Google Maps), aprovada no painel.
    const src = i.sourceUrl ? ` · <a href="${esc(safeUrl(i.sourceUrl))}" target="_blank" rel="noopener noreferrer">fonte</a>` : "";
    return `<${tag}${c("")}>Foto da empresa${src}</${tag}>`;
  }
  if (i.credit && /commons\.wikimedia\.org/.test(i.sourceUrl ?? "")) {
    // Foto real do local (Wikimedia Commons): não é foto da empresa nem ilustração genérica.
    return `<${tag}${c("")}>Foto do local · <a href="${esc(safeUrl(i.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(i.credit.name)}</a> · ${esc(i.license ?? "Wikimedia Commons")} (Wikimedia Commons)</${tag}>`;
  }
  if (i.credit) {
    // Banco de imagens: sempre rotulada como ilustrativa + crédito exigido pela licença.
    const lic = !i.license || /unsplash/i.test(i.license) ? " / Unsplash" : ` · ${esc(i.license)}`;
    return `<${tag}${c("")}>Imagem ilustrativa · Foto: <a href="${esc(safeUrl(i.credit.link))}" target="_blank" rel="noopener noreferrer">${esc(i.credit.name)}</a>${lic}</${tag}>`;
  }
  if (i.origin === "stock") return `<${tag}${c("")}>Imagem ilustrativa</${tag}>`;
  return "";
}

export function imgSrc(i: SiteImage | undefined): string | null {
  if (!i?.url) return null;
  const src = safeUrl(i.url);
  return src === "#" ? null : src;
}

function img(i: SiteImage | undefined, cls = ""): string {
  const src = imgSrc(i);
  if (!src || !i) return "";
  return `<figure class="${cls}"><img src="${esc(src)}" alt="${esc(i.alt)}" loading="lazy" decoding="async">${imageCaption(i)}</figure>`;
}

export function resolveStyle(c: SiteContent): SiteStyle {
  return c.theme.style ?? "studio";
}

// ---------- ornamentos (SVG inline, decorativos) ----------
function initials(name: string) {
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const letters = clean
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return esc(letters || clean.slice(0, 1).toUpperCase());
}

function ornament(style: SiteStyle, c: SiteContent): string {
  const p = c.theme.primary, a = c.theme.accent;
  switch (style) {
    case "atelier":
      return `<svg class="orn" viewBox="0 0 400 520" aria-hidden="true" focusable="false"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(p, "#ffffff", 0.15)}"/><stop offset="1" stop-color="${mix(p, "#000000", 0.25)}"/></linearGradient></defs><path d="M0 520V200A200 200 0 0 1 400 200V520Z" fill="url(#ag)"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${40 + i * 40} 520V${Math.round(230 - Math.sin((i / 8) * Math.PI) * 60)}" stroke="${mix(p, "#ffffff", 0.55)}" stroke-opacity=".35" stroke-width="1"/>`).join("")}<circle cx="300" cy="150" r="46" fill="${a}" fill-opacity=".9"/></svg>`;
    case "forge":
      return `<svg class="orn" viewBox="0 0 600 600" aria-hidden="true" focusable="false"><defs><pattern id="fs" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="12" height="28" fill="${a}" fill-opacity=".14"/></pattern></defs><rect width="600" height="600" fill="url(#fs)"/><text x="50%" y="66%" text-anchor="middle" font-family="'${esc(c.theme.headingFont)}',Impact,sans-serif" font-size="380" fill="none" stroke="${a}" stroke-width="3" stroke-opacity=".75">${initials(c.business.name)}</text></svg>`;
    case "clinic":
      return `<svg class="orn" viewBox="0 0 480 480" aria-hidden="true" focusable="false">${[0, 1, 2, 3].map((i) => `<rect x="${40 + i * 34}" y="${40 + i * 34}" width="${400 - i * 68}" height="${400 - i * 68}" rx="${120 - i * 22}" fill="${mix(p, "#ffffff", 0.84 - i * 0.16)}"/>`).join("")}<path d="M240 196v88M196 240h88" stroke="${onColor(mix(p, "#ffffff", 0.36))}" stroke-width="18" stroke-linecap="round"/></svg>`;
    case "hearth":
      return `<svg class="orn" viewBox="0 0 600 420" aria-hidden="true" focusable="false"><path d="M88 214c-8-96 92-168 196-150 74 13 102 64 168 66 70 2 110 74 76 140-36 70-128 76-196 104-86 36-236 24-244-160Z" fill="${mix(a, "#ffffff", 0.55)}"/><path d="M146 230c6-64 72-104 140-92 50 9 70 40 112 44 44 4 66 50 44 92-24 46-86 50-130 66-60 22-172 2-166-110Z" fill="${mix(p, "#ffffff", 0.2)}" fill-opacity=".9"/><circle cx="470" cy="96" r="18" fill="${p}"/><circle cx="120" cy="352" r="10" fill="${a}"/></svg>`;
    case "studio":
    case "immersive":
    case "cinema":
      return "";
  }
}

/** Palavra de fundo da capa cinematográfica: a mais marcante do nome. */
function bigWord(c: SiteContent) {
  const words = c.siteName.replace(/\(.*?\)/g, "").split(/[\s\-–·|]+/).filter((w) => w.length >= 4);
  const w = words.sort((a, b) => b.length - a.length)[0] ?? c.siteName;
  return esc(w.toUpperCase().slice(0, 12));
}

const NUMERIC = /^\d{1,9}([.,]\d{1,2})?$/;

// ---------- capa ----------
function heroActions(s: Extract<Section, { type: "hero" }>, c: SiteContent) {
  return s.buttons.length ? `<div class="actions">${s.buttons.map((b, i) => button(b, c, i === 0 ? "btn" : "btn btn-ghost")).join("")}</div>` : "";
}

function heroFacts(c: SiteContent) {
  const b = c.business;
  const items = [
    b.address && `<li><span>Endereço</span><b>${esc(b.address)}</b></li>`,
    b.phone && `<li><span>Telefone</span><a href="${esc(telHref(b.phone))}">${esc(b.phone)}</a></li>`,
    b.email && `<li><span>E-mail</span><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
  ].filter(Boolean);
  return items.length ? `<ul class="facts">${items.join("")}</ul>` : "";
}

function prettyWa(n: string) {
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${n}`;
}

/** Faixa de informações logo após a capa: endereço, horários publicados e contato confirmados. */
function infoStrip(c: SiteContent, visible: Section[]): string {
  const b = c.business;
  const hours = visible.find((x) => x.type === "hours") as Extract<Section, { type: "hours" }> | undefined;
  const lines = hours?.lines.filter((l) => l.value.trim()) ?? [];
  const wa = waNumber(b.whatsapp);
  const items = [
    b.address && `<li><span>Onde</span>${b.mapsUrl ? `<a href="${esc(safeUrl(b.mapsUrl))}" target="_blank" rel="noopener noreferrer">${esc(b.address)}</a>` : `<b>${esc(b.address)}</b>`}</li>`,
    lines.length && hours && `<li><span>Horários</span><a href="#${esc(hours.id)}">${esc(lines[0]!.label)}: ${esc(lines[0]!.value)}${lines.length > 1 ? " · ver todos" : ""}</a></li>`,
    wa ? `<li><span>WhatsApp</span><a href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer">${esc(prettyWa(wa))}</a></li>` : b.phone && `<li><span>Telefone</span><a href="${esc(telHref(b.phone))}">${esc(b.phone)}</a></li>`,
  ].filter(Boolean);
  return items.length >= 2 ? `<aside class="info-strip" aria-label="Informações rápidas"><ul class="wrap">${items.join("")}</ul></aside>` : "";
}

function servicesOf(c: SiteContent): string[] {
  const s = c.sections.find((x) => x.visible && (x.type === "services" || x.type === "products"));
  if (!s) return [];
  return s.type === "services" ? s.items.map((i) => i.title) : s.type === "products" ? s.items.map((i) => i.name) : [];
}

function heroHtml(s: Extract<Section, { type: "hero" }>, c: SiteContent, style: SiteStyle): string {
  const src = imgSrc(s.image);
  const cap = s.image && src ? imageCaption(s.image, "p", "hero-credit") : "";
  const title = `<h1>${esc(s.title)}</h1>`;
  const lead = s.subtitle ? `<p class="lead">${esc(s.subtitle)}</p>` : "";
  const eyebrow = c.siteName && c.siteName !== s.title ? `<p class="eyebrow">${esc(c.siteName)}</p>` : "";
  const id = `id="${esc(s.id)}"`;
  const alt = esc(s.image?.alt ?? "");
  switch (style) {
    case "atelier":
      return `<section ${id} class="hero"><div class="wrap hero-grid"><div class="hero-copy">${eyebrow}${title}${lead}${heroActions(s, c)}</div><div class="hero-art">${src ? `<figure class="arch"><img src="${esc(src)}" alt="${alt}" decoding="async"></figure>` : ornament(style, c)}${cap}</div></div></section>`;
    case "forge": {
      const list = servicesOf(c).slice(0, 6);
      return `<section ${id} class="hero${src ? " has-img" : ""}">${src ? `<div class="hero-bg" style="background-image:url('${esc(src).replace(/'/g, "%27")}')" role="img" aria-label="${alt}"></div>` : `<div class="hero-orn">${ornament(style, c)}</div>`}<div class="wrap hero-copy">${eyebrow}${title}${lead}${heroActions(s, c)}</div>${list.length ? `<div class="band" aria-label="Serviços"><div class="wrap">${list.map((t) => `<span>${esc(t)}</span>`).join("")}</div></div>` : ""}${cap}</section>`;
    }
    case "clinic":
      return `<section ${id} class="hero"><div class="wrap hero-grid"><div class="hero-copy">${eyebrow}${title}${lead}${heroActions(s, c)}</div><div class="hero-art">${src ? `<figure class="soft"><img src="${esc(src)}" alt="${alt}" decoding="async"></figure>` : ornament(style, c)}${cap}</div></div><div class="wrap">${heroFacts(c)}</div></section>`;
    case "hearth":
      return `<section ${id} class="hero"><div class="wrap hero-center"><div class="hero-art">${ornament(style, c)}${src ? `<figure class="plate"><img src="${esc(src)}" alt="${alt}" decoding="async"></figure>` : ""}</div>${eyebrow}${title}${lead}${heroActions(s, c)}${cap}</div></section>`;
    case "immersive":
    case "cinema":
      return `<section ${id} class="hero cine-hero"><div class="cine-word" aria-hidden="true" style="--len:${Math.max(4, bigWord(c).length)}">${bigWord(c)}</div><div class="cine-stage"><div class="cine-glow" aria-hidden="true"></div><div class="cine-object"><div class="cine-tilt" data-tilt>${
        src
          ? `<img class="cine-photo" src="${esc(src)}" alt="${alt}" decoding="async">`
          : `<div class="cine-mono" aria-hidden="true"><i class="ring r1"></i><i class="ring r2"></i><span>${initials(c.business.name)}</span></div>`
      }</div></div></div><div class="wrap cine-copy">${eyebrow}${title}${lead}${heroActions(s, c)}</div>${cap}</section>`;
    case "studio": {
      const list = servicesOf(c).slice(0, 3);
      const cards = [0, 1, 2]
        .map((i) => {
          if (i === 0 && src) return `<div class="tile t0 photo"><img src="${esc(src)}" alt="${alt}" decoding="async"></div>`;
          // Só o cartão da frente tem texto; os de trás são planos de cor (nada de texto cortado).
          return i === 0 ? `<div class="tile t0"><b>${esc(list[0] ?? c.business.name)}</b></div>` : `<div class="tile t${i}"></div>`;
        })
        .join("");
      return `<section ${id} class="hero"><div class="wrap hero-grid"><div class="hero-copy">${eyebrow}${title}${lead}${heroActions(s, c)}</div><div class="stack" data-tilt${src ? "" : ' aria-hidden="true"'}>${cards}</div></div>${cap}</section>`;
    }
  }
}

// ---------- palco 3D ligado à rolagem ----------
type ScrollyInput = { id: string; intro: string; items: { title: string; description: string }[]; stats: { value: string; unit: string; label: string }[]; hero?: Extract<Section, { type: "hero" }> };

function stageObject(c: SiteContent, uid: string): { html: string; photo: boolean; cap: string } {
  const st = c.stage;
  const kind = st?.kind ?? objectKindFor("", c.siteName);
  const img = st?.image && st.mode !== "illustration" ? st.image : undefined;
  const src = imgSrc(img);
  if (src && img) {
    // Foto real (da empresa, com autorização, ou de banco com licença): só emoldurada e inclinada, nunca editada.
    const layers = Array.from({ length: 7 }, (_, i) => `<i class="o3d-l" style="--d:${i + 1}"></i>`).join("");
    return { photo: true, html: `<div class="o3d photo">${layers}<img class="o3d-face" src="${esc(src)}" alt="${esc(img.alt)}" decoding="async"><i class="o3d-spec"></i></div>`, cap: imageCaption(img, "p", "sc-cap") };
  }
  const svg = objectSvg(kind, c.theme.primary, c.theme.accent, uid);
  const layers = Array.from({ length: 10 }, (_, i) => `<div class="o3d-sv" style="--d:${i}">${svg}</div>`).join("");
  return { photo: false, html: `<div class="o3d illus">${layers}</div>`, cap: "" };
}

function renderScrolly(c: SiteContent, style: SiteStyle, x: ScrollyInput): string {
  const steps: string[] = [];
  steps.push(x.intro);
  x.items.slice(0, 3).forEach((it, i, arr) => steps.push(`<p class="sc-k">${String(i + 1).padStart(2, "0")} / ${String(arr.length).padStart(2, "0")}</p><h3 class="sc-big">${esc(it.title)}</h3>${it.description ? `<p class="sc-p">${esc(it.description)}</p>` : ""}`));
  x.stats.slice(0, 3).forEach((st) => {
    const v = st.value.trim();
    const num = NUMERIC.test(v) ? ` data-scount="${esc(v.replace(",", "."))}" data-dec="${v.includes(",") ? "," : "."}"` : "";
    steps.push(`<p class="sc-num"><b${num}>${esc(v)}</b>${st.unit ? `<span>${esc(st.unit)}</span>` : ""}</p><p class="sc-big sc-label">${esc(st.label)}</p>`);
  });
  const hours = c.sections.find((s) => s.type === "hours" && s.visible);
  const lines = hours && hours.type === "hours" ? hours.lines.filter((l) => l.value.trim()) : [];
  const cta = c.sections.find((s) => s.type === "cta" && s.visible);
  const btn = x.hero?.buttons[0] ?? (cta && cta.type === "cta" ? cta.button : undefined);
  steps.push(`<p class="sc-k">${lines.length ? "Horário" : "Contato"}</p><h3 class="sc-big">${esc(cta && cta.type === "cta" ? cta.title : "Vamos conversar?")}</h3>${lines.length ? `<ul class="sc-hours">${lines.map((l) => `<li><span>${esc(l.label)}</span><b>${esc(l.value)}</b></li>`).join("")}</ul>` : ""}${btn ? `<div class="actions">${button(btn, c)}</div>` : ""}`);
  const poses = posesFor(c.stage?.kind ?? "gear", steps.length);
  const side = (i: number) => (poses[i]![0]! > 0 ? "left" : poses[i]![0]! < 0 ? "right" : "bottom");
  const obj = stageObject(c, `s${x.id.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`);
  return `<section id="${esc(x.id)}" class="scrolly ${obj.photo ? "is-photo" : "is-illus"}" data-scrolly data-poses='${JSON.stringify(poses)}' style="--steps:${steps.length}">
<div class="sc-stage">
  ${style === "cinema" ? `<div class="sc-word" aria-hidden="true" style="--len:${Math.max(4, bigWord(c).length)}">${bigWord(c)}</div>` : ""}
  <div class="sc-obj"><div class="sc-floor" aria-hidden="true"><i class="ga"></i><i class="gb"></i></div><div class="sc-rot"><div class="sc-glow" aria-hidden="true"></div>${obj.html}</div></div>
  ${obj.cap}
  <div class="sc-steps">${steps.map((h, i) => `<div class="sc-step" data-step="${i}" data-side="${side(i)}">${h}</div>`).join("")}</div>
  <div class="sc-bar" aria-hidden="true"><i></i></div>
</div>
</section>`;
}

// ---------- seções ----------
function sectionHtml(s: Section, c: SiteContent, style: SiteStyle, alt: boolean): string {
  const head = (title: string, intro?: string) =>
    `<header class="sec-head"><h2>${esc(title)}</h2>${intro ? `<p class="muted">${esc(intro)}</p>` : ""}</header>`;
  const cls = (extra = "") => `class="sec${alt ? " alt" : ""}${extra ? " " + extra : ""}"`;
  const tilt = STYLE_INFO[style].uses3d && style === "forge" ? " data-tilt" : "";
  switch (s.type) {
    case "hero":
      return heroHtml(s, c, style);
    case "about": {
      const media = img(s.image, "media");
      return `<section id="${esc(s.id)}" ${cls("about")}><div class="wrap ${media ? "split" : "narrow"}"><div>${head(s.title)}<div class="prose">${nl2p(s.text)}</div></div>${media}</div></section>`;
    }
    case "services":
      if (style === "cinema" && s.items.length) {
        // Seletor no espírito "uma peça, várias versões": cada serviço é uma amostra; clicar troca o destaque e a cor do brilho.
        const tones = [c.theme.primary, c.theme.accent, mix(c.theme.primary, "#ffffff", 0.45), mix(c.theme.accent, "#000000", 0.35), mix(c.theme.primary, c.theme.accent, 0.5), mix(c.theme.accent, "#ffffff", 0.4)];
        return `<section id="${esc(s.id)}" class="sec services cine-pick" data-picker><div class="wrap pick-grid"><div class="pick-copy">${head(s.title, s.intro)}<div class="pick-panels">${s.items
          .map((i, k) => `<article class="card pick-panel${k === 0 ? " is-on" : ""}" data-panel="${k}"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p></article>`)
          .join("")}</div></div><div class="pick-swatches" role="tablist" aria-label="${esc(s.title)}">${s.items
          .map((i, k) => `<button type="button" role="tab" class="swatch${k === 0 ? " is-on" : ""}" data-pick="${k}" data-tone="${tones[k % tones.length]}" aria-selected="${k === 0}"><i style="background:${tones[k % tones.length]}"></i><span>${esc(i.title)}</span></button>`)
          .join("")}</div></div></section>`;
      }
      return `<section id="${esc(s.id)}" ${cls("services")}><div class="wrap">${head(s.title, s.intro)}<div class="grid n${Math.min(s.items.length, 7)}">${s.items
        .map((i) => `<article class="card"${tilt}><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p></article>`)
        .join("")}</div></div></section>`;
    case "products":
      return `<section id="${esc(s.id)}" ${cls("services")}><div class="wrap">${head(s.title, s.intro)}<div class="grid">${s.items
        .map((i) => `<article class="card"${tilt}>${img(i.image, "card-img")}<h3>${esc(i.name)}</h3><p>${esc(i.description)}</p></article>`)
        .join("")}</div></div></section>`;
    case "menu":
      return `<section id="${esc(s.id)}" ${cls("menu-sec")}><div class="wrap narrow">${head(s.title, s.intro)}${s.categories
        .map(
          (cat) =>
            `<div class="menu-cat"><h3>${esc(cat.name)}</h3><ul class="menu">${cat.items
              .map(
                (i) =>
                  `<li><div class="mi"><strong>${esc(i.name)}</strong>${i.description ? `<span class="muted">${esc(i.description)}</span>` : ""}</div>${i.price ? `<span class="dots" aria-hidden="true"></span><span class="price">${esc(i.price)}</span>` : ""}</li>`,
              )
              .join("")}</ul></div>`,
        )
        .join("")}</div></section>`;
    case "hours": {
      const lines = s.lines.filter((l) => l.value.trim());
      if (!lines.length) return "";
      return `<section id="${esc(s.id)}" ${cls()}><div class="wrap narrow">${head(s.title)}<dl class="hours">${lines
        .map((l) => `<div><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`)
        .join("")}</dl>${s.note ? `<p class="muted small">${esc(s.note)}</p>` : ""}</div></section>`;
    }
    case "gallery": {
      // Só imagens com endereço válido: nunca deixa uma galeria vazia com título.
      const valid = s.images.filter((i) => imgSrc(i));
      if (!valid.length) return "";
      return `<section id="${esc(s.id)}" ${cls()}><div class="wrap">${head(s.title)}<div class="gallery g${Math.min(valid.length, 4)}">${valid.map((i) => img(i)).join("")}</div></div></section>`;
    }
    case "cta":
      return `<section id="${esc(s.id)}" class="sec cta"><div class="wrap cta-inner"><div><h2>${esc(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}</div>${button(s.button, c, "btn btn-invert")}</div></section>`;
    case "quote": {
      const n = waNumber(c.business.whatsapp);
      if (!n && !c.business.email) return "";
      return `<section id="${esc(s.id)}" ${cls()}><div class="wrap narrow">${head(s.title, s.text)}
<form class="quote" data-wa="${esc(n ?? "")}" data-email="${esc(c.business.email)}" data-biz="${esc(c.business.name)}">
  <label>Seu nome<input name="nome" required maxlength="80" autocomplete="name"></label>
  <label>O que você precisa?<textarea name="mensagem" required maxlength="800" rows="4"></textarea></label>
  <button class="btn" type="submit">${esc(s.buttonLabel)}</button>
  <p class="muted small">Seus dados não são armazenados por este site: a mensagem é aberta no ${n ? "WhatsApp" : "seu e-mail"} para você enviar.</p>
</form></div></section>`;
    }
    case "contact": {
      const b = c.business;
      const n = waNumber(b.whatsapp);
      const items = [
        b.address && `<li><strong>Endereço</strong><span>${esc(b.address)}</span></li>`,
        b.phone && `<li><strong>Telefone</strong><a href="${esc(telHref(b.phone))}">${esc(b.phone)}</a></li>`,
        n && `<li><strong>WhatsApp</strong><a href="https://wa.me/${n}" target="_blank" rel="noopener noreferrer">Enviar mensagem</a></li>`,
        b.email && `<li><strong>E-mail</strong><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
        b.instagram && `<li><strong>Instagram</strong><a href="${esc(safeUrl(b.instagram.startsWith("http") ? b.instagram : `https://instagram.com/${b.instagram.replace(/^@/, "")}`))}" target="_blank" rel="noopener noreferrer">${esc(b.instagram.replace(/^https?:\/\/(www\.)?/, ""))}</a></li>`,
      ].filter(Boolean);
      return `<section id="${esc(s.id)}" ${cls("contact-sec")}><div class="wrap narrow">${head(s.title, s.text)}${items.length ? `<ul class="contact">${items.join("")}</ul>` : ""}${
        s.showMap && (b.mapsUrl || b.address) ? `<a class="btn btn-ghost" href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>` : ""
      }</div></section>`;
    }
    case "text":
      return `<section id="${esc(s.id)}" ${cls()}><div class="wrap narrow">${head(s.title)}<div class="prose">${nl2p(s.text)}</div></div></section>`;
    case "stats": {
      // Só aparecem números com valor e frase preenchidos (confirmados pelo usuário com a empresa).
      const items = s.items.filter((i) => i.value.trim() && i.label.trim());
      if (!items.length) return "";
      return `<section id="${esc(s.id)}" ${cls("stats")}><div class="wrap">${head(s.title)}<div class="stat-grid n${Math.min(items.length, 4)}">${items
        .map((i) => {
          const v = i.value.trim();
          const num = NUMERIC.test(v) ? ` data-count="${esc(v.replace(",", "."))}" data-dec="${v.includes(",") ? "," : "."}"` : "";
          return `<div class="stat"><p class="stat-v"><b${num}>${esc(v)}</b>${i.unit ? `<span>${esc(i.unit)}</span>` : ""}</p><p class="stat-l">${esc(i.label)}</p></div>`;
        })
        .join("")}</div></div></section>`;
    }
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

// ---------- CSS ----------
function baseCss(c: SiteContent, style: SiteStyle) {
  const th = c.theme;
  const radius = th.radius === "none" ? "0px" : th.radius === "md" ? "12px" : "22px";
  const dark = contrast(th.background, "#000000") < contrast(th.background, "#ffffff");
  return `:root{--p:${th.primary};--a:${th.accent};--on-a:${onColor(th.accent)};--on-p:${onColor(th.primary)};--bg:${th.background};--sf:${th.surface};--tx:${th.text};--mu:${readableOn(th.muted, th.background)};--link:${readableOn(th.primary, th.background)};--at:${readableOn(th.accent, th.background, 3)};--line:color-mix(in srgb,var(--tx) ${dark ? 14 : 10}%,transparent);--r:${radius};--hf:'${th.headingFont}',Georgia,system-ui,sans-serif;--bf:'${th.bodyFont}',system-ui,-apple-system,'Segoe UI',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:var(--bf);background:var(--bg);color:var(--tx);line-height:1.65;-webkit-font-smoothing:antialiased;font-size:17px;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:var(--link)}
h1,h2,h3{font-family:var(--hf);line-height:1.08;text-wrap:balance;overflow-wrap:break-word}
p{text-wrap:pretty}
:focus-visible{outline:3px solid var(--at);outline-offset:3px}
.wrap{width:min(1160px,100% - 40px);margin-inline:auto}
.narrow{width:min(780px,100% - 40px);margin-inline:auto}
.muted{color:var(--mu)}.small{font-size:.86rem;margin-top:12px}
.eyebrow{font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--at);margin-bottom:18px}
.topbar{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:saturate(1.4) blur(12px);-webkit-backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid var(--line)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;min-height:68px;gap:16px;position:relative}
.brand{font-family:var(--hf);font-weight:700;font-size:1.25rem;color:var(--tx);text-decoration:none;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav{display:flex;gap:26px}
.info-strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 92%,var(--p) 8%)}
.info-strip ul{margin:0 auto;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:0;padding-top:0;padding-bottom:0}
.info-strip li{display:flex;flex-direction:column;gap:4px;padding:20px 22px;overflow-wrap:anywhere}
.info-strip li+li{border-left:1px solid var(--line)}
.info-strip span{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--mu);font-weight:700}
.info-strip b,.info-strip a{color:var(--tx);font-weight:600;text-decoration:none;font-size:.98rem}
.info-strip a:hover{text-decoration:underline;text-underline-offset:3px}
@media (max-width:640px){.info-strip li+li{border-left:0;border-top:1px solid var(--line)}.info-strip li{padding:14px 4px}}
.nav a{color:var(--tx);text-decoration:none;font-size:.94rem;opacity:.8;transition:opacity .2s}
.nav a:hover{opacity:1}
#menu-toggle{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}.burger{display:none}
.sec{padding:96px 0}.sec.alt{background:var(--sf)}
.sec-head{margin-bottom:40px;max-width:640px}
.sec-head h2{font-size:clamp(2rem,4.4vw,3rem);margin-bottom:12px}
.prose p{margin-bottom:14px;max-width:62ch}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;background:var(--a);color:var(--on-a);font:700 1rem/1.1 var(--bf);padding:15px 28px;border-radius:var(--r);text-decoration:none;border:2px solid var(--a);cursor:pointer;text-align:center;transition:transform .2s cubic-bezier(.2,.7,.1,1),box-shadow .2s,background .2s,color .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 14px 28px -14px color-mix(in srgb,var(--a) 80%,transparent)}
.btn-ghost{background:transparent;color:var(--tx);border-color:color-mix(in srgb,var(--tx) 35%,transparent)}
.btn-ghost:hover{border-color:var(--tx);box-shadow:none}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:20px}
.card{background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:28px;transition:transform .35s cubic-bezier(.2,.7,.1,1),box-shadow .35s,border-color .35s,padding .35s}
.card h3{font-size:1.3rem;margin-bottom:8px}
.card p{color:var(--mu);font-size:.98rem}
.card-img img{border-radius:calc(var(--r) * .7);margin-bottom:16px;aspect-ratio:4/3;object-fit:cover;width:100%}
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
.media img{border-radius:var(--r);aspect-ratio:4/5;object-fit:cover;width:100%}
figcaption,.hero-credit{font-size:.74rem;color:var(--mu);margin-top:8px}
figcaption a,.hero-credit a{color:inherit}
.gen-note{font-style:italic}
.menu-cat{margin-bottom:40px}
.menu-cat h3{font-size:1.5rem;margin-bottom:14px;color:var(--at)}
.menu{list-style:none}
.menu li{display:flex;align-items:baseline;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}
.menu .mi{flex:0 1 auto;min-width:0}.menu li span.muted{display:block;font-size:.94rem}
.menu .dots{flex:1;border-bottom:2px dotted color-mix(in srgb,var(--tx) 30%,transparent);transform:translateY(-4px);min-width:20px}
.price{font-weight:700;white-space:nowrap}
.hours{max-width:520px}.hours div{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}
.hours dt{font-weight:600}
.gallery{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
.gallery img{border-radius:var(--r);aspect-ratio:1;object-fit:cover;width:100%}
.cta{background:var(--p);color:var(--on-p);padding:80px 0}
.cta-inner{display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:wrap}
.cta h2{font-size:clamp(1.9rem,4.4vw,3rem);max-width:18ch}
.cta p{margin-top:12px;opacity:.88;max-width:52ch}
.btn-invert{background:var(--on-p);color:var(--p);border-color:var(--on-p)}
.contact{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:14px;margin-bottom:26px}
.contact li{display:flex;flex-direction:column;gap:4px;padding:20px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);overflow-wrap:anywhere}
.sec:not(.alt) .contact li{background:var(--sf)}
.contact strong{font-size:.74rem;text-transform:uppercase;letter-spacing:.12em;color:var(--mu)}
.quote{display:grid;gap:16px}
.quote label{display:grid;gap:8px;font-weight:600}
.quote input,.quote textarea{font:inherit;padding:14px 16px;border-radius:var(--r);border:1px solid color-mix(in srgb,var(--tx) 22%,transparent);background:var(--bg);color:var(--tx)}
.quote .btn{justify-self:start}
footer{padding:40px 0;border-top:1px solid var(--line);font-size:.88rem;color:var(--mu)}
footer .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.preview-ribbon{position:relative;z-index:60;background:repeating-linear-gradient(135deg,#111827 0 14px,#1f2937 14px 28px);color:#fde68a;text-align:center;font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px}
.wa-float{position:fixed;right:18px;bottom:18px;width:58px;height:58px;border-radius:50%;background:#25d366;display:grid;place-items:center;box-shadow:0 10px 28px rgba(0,0,0,.28);z-index:30;transition:transform .2s}
.wa-float:hover{transform:scale(1.06)}
.wa-float svg{width:30px;height:30px;fill:#fff}
.hero{position:relative;overflow:hidden}
.hero h1{font-size:clamp(2.6rem,7vw,5rem)}
.hero .lead{font-size:clamp(1.08rem,2.1vw,1.3rem);max-width:54ch;margin-top:20px;color:var(--mu)}
.hero-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:56px;align-items:center}
.hero-copy{min-width:0}
.hero-art{position:relative;min-width:0}
.orn{width:100%;height:auto;display:block}
.hero-credit{position:absolute;right:12px;bottom:10px;margin:0;z-index:2}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:28px}
.stat-v{display:flex;align-items:baseline;gap:6px;font-family:var(--hf);line-height:.95}
.stat-v b{font-size:clamp(3.2rem,8vw,5.6rem);font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.stat-v span{font-size:1.4rem;font-weight:700;color:var(--mu)}
.stat-l{margin-top:10px;font-weight:700;font-size:1.1rem;max-width:22ch;line-height:1.3}
/* Imagens animadas: zoom lento nas fotos de capa, cortina + zoom ao entrar, parallax ao rolar e zoom no hover. */
.media,.gallery figure,.card-img{overflow:hidden;border-radius:var(--r)}
.media img,.gallery img,.card-img img{--zs:1.06;transform:translateY(var(--par,0px)) scale(var(--zs));transition:transform .9s cubic-bezier(.2,.7,.1,1),clip-path 1.2s cubic-bezier(.2,.7,.1,1),opacity .8s ease;will-change:transform}
.gallery figure:hover img,.card:hover .card-img img,.media:hover img{--zs:1.12}
.img-rv{clip-path:inset(14% 8% 14% 8% round var(--r));opacity:.001;--zs:1.22}
.img-rv.in{clip-path:inset(0 0 0 0 round var(--r));opacity:1;--zs:1.06}
@keyframes kb{0%{transform:scale(1.02) translate3d(0,0,0)}100%{transform:scale(1.12) translate3d(-1.6%,-1.2%,0)}}
.hero-bg,.arch img,.soft img,.plate img,.stack .photo img{animation:kb 22s ease-in-out infinite alternate}
.arch,.soft,.plate,.stack .photo{overflow:hidden}
.arch{border-radius:999px 999px 0 0}.soft{border-radius:40px}.plate{border-radius:50%}
@keyframes img-float{50%{translate:0 -12px;rotate:-.6deg}}
.cine-photo{animation:img-float 7s ease-in-out infinite}
@keyframes orn-float{50%{translate:0 -14px}}
@keyframes orn-breathe{50%{scale:1.045}}
@keyframes orn-drift{to{translate:-3% 2%}}
.orn circle{animation:orn-float 9s ease-in-out infinite}
.orn circle+circle{animation-duration:11s;animation-delay:-3s}
.s-hearth .orn path,.s-clinic .orn rect{transform-box:fill-box;transform-origin:center;animation:orn-breathe 11s ease-in-out infinite}
.s-hearth .orn path+path,.s-clinic .orn rect:nth-child(even){animation-delay:-4s;animation-duration:13s}
.s-forge .hero-orn{animation:orn-drift 18s ease-in-out infinite alternate}
.s-atelier .orn path[stroke]{stroke-dasharray:6 8;animation:orn-line 14s linear infinite}
@keyframes orn-line{to{stroke-dashoffset:-140}}
.stack .t1{animation:tile-float 8s ease-in-out infinite}.stack .t2{animation:tile-float 9s ease-in-out infinite -3s}
@keyframes tile-float{50%{translate:0 -10px}}
/* Modo leve (celular, pouca memória, economia de dados): sem desfoque, sem zoom contínuo nem parallax. */
.lite .rv{filter:none!important;transform:translateY(12px)}.lite .rv.in{transform:none}
.lite .hero-bg,.lite .arch img,.lite .soft img,.lite .plate img,.lite .stack .photo img,.lite .orn *,.lite .hero-orn,.lite .stack .tile{animation:none!important}
.lite .cine-glow{filter:blur(18px)}.lite .cine-photo,.lite .cine-mono .ring{animation:none!important}
/* ---------- Palco 3D ligado à rolagem ---------- */
.scrolly{position:relative;background:var(--bg);--glow:var(--p)}
.sc-stage{position:relative;padding:80px 20px;display:grid;gap:36px;justify-items:center}
.sc-obj{position:relative;width:min(64vw,340px);aspect-ratio:1;perspective:1200px}
.sc-rot{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}
.o3d{position:absolute;inset:0;transform-style:preserve-3d}
.o3d-sv{position:absolute;inset:0;transform:translateZ(calc(var(--d) * -3.4px));filter:brightness(calc(1 - var(--d) * .06))}
.o3d-sv svg{width:100%;height:100%;display:block;overflow:visible}
.o3d-sv:first-child{filter:drop-shadow(0 30px 40px rgba(0,0,0,.35))}
.photo .o3d-face{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:24px;transform:translateZ(1px);box-shadow:0 50px 80px -40px rgba(0,0,0,.65)}
.photo .o3d-l{position:absolute;inset:0;border-radius:24px;background:color-mix(in srgb,var(--p) 28%,#0c0c10);transform:translateZ(calc(var(--d) * -2.6px))}
.o3d-spec{position:absolute;inset:0;border-radius:24px;transform:translateZ(2px);pointer-events:none;background:linear-gradient(calc(100deg + var(--ry,0) * 1.4deg),transparent 28%,rgba(255,255,255,.28) 46%,transparent 60%);mix-blend-mode:soft-light}
.sc-glow{position:absolute;inset:-22%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--p) 34%,transparent),transparent 72%);transform:translateZ(-160px);filter:blur(26px);opacity:.75}
/* Brilho no "chão", sob o objeto: alterna entre a cor principal e a de destaque a cada etapa (como no vídeo). */
.sc-floor{position:absolute;left:-35%;right:-35%;top:58%;height:80%;pointer-events:none;will-change:transform}
.sc-floor i{position:absolute;inset:0;border-radius:50%;filter:blur(30px);transition:opacity 1.1s ease}
.sc-floor .ga{background:radial-gradient(50% 32% at 50% 30%,color-mix(in srgb,var(--p) 80%,transparent),transparent 75%)}
.sc-floor .gb{background:radial-gradient(50% 32% at 50% 30%,color-mix(in srgb,var(--a) 80%,transparent),transparent 75%);opacity:0}
.alt-glow .sc-floor .ga{opacity:.25}.alt-glow .sc-floor .gb{opacity:1}
.s-clinic .sc-floor,.s-atelier .sc-floor{opacity:.45}
.sc-steps{display:grid;gap:56px;width:min(760px,100%)}
.sc-step{min-width:0}
.sc-k{font:700 .78rem/1.2 var(--bf);letter-spacing:.18em;text-transform:uppercase;color:var(--at);margin-bottom:14px}
.sc-h1{font-size:clamp(2.6rem,6.4vw,5.4rem);font-weight:800;letter-spacing:-.045em;line-height:.98}
.sc-big{font-size:clamp(2.2rem,4.8vw,4.2rem);font-weight:800;letter-spacing:-.04em;line-height:1;overflow-wrap:normal;word-break:normal;hyphens:auto;-webkit-hyphens:auto}
.sc-h1{hyphens:auto;-webkit-hyphens:auto}
.sc-p{margin-top:16px;font-size:clamp(1.02rem,1.6vw,1.2rem);color:var(--mu);max-width:44ch}
.sc-num{display:flex;align-items:baseline;gap:8px;font-family:var(--hf);line-height:.9}
.sc-num b{font-size:clamp(4.4rem,12vw,9rem);font-weight:800;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.sc-num span{font-size:1.4rem;font-weight:700;color:var(--mu)}
.sc-label{font-size:clamp(1.6rem,3.4vw,2.6rem);margin-top:10px;max-width:16ch}
.sc-hours{list-style:none;margin-top:18px;display:grid;gap:8px;max-width:360px}
.sc-hours li{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);padding-bottom:8px}
.sc-cap{position:absolute;right:16px;bottom:12px;margin:0;font-size:.72rem;color:var(--mu);z-index:3}
.sc-bar{display:none}
.sc-word{display:none}
/* Com script e sem movimento reduzido: palco fixo, objeto anda/gira/escala com a rolagem. */
.sc-live{height:calc(var(--steps) * 92vh + 8vh)}
.sc-live .sc-stage{position:sticky;top:0;height:100vh;height:100svh;padding:0;display:block;overflow:hidden}
.sc-live .sc-obj{position:absolute;left:50%;top:50%;width:min(36vw,470px);margin:calc(min(36vw,470px) / -2) 0 0 calc(min(36vw,470px) / -2)}
.sc-live .sc-step{position:absolute;top:50%;width:min(36vw,480px);opacity:0;filter:blur(12px);transform:translateY(-38%);transition:opacity .7s ease,filter .8s ease,transform .9s cubic-bezier(.2,.7,.1,1);pointer-events:none}
.sc-live .sc-step.on{opacity:1;filter:none;transform:translateY(-50%);pointer-events:auto}
.sc-live .sc-step[data-side="left"]{left:max(24px,calc(50% - 580px))}
.sc-live .sc-step[data-side="right"]{right:max(24px,calc(50% - 580px))}
.sc-live .sc-step[data-side="bottom"]{left:50%;top:auto;bottom:9vh;width:min(90vw,680px);text-align:center;transform:translate(-50%,24px)}
.sc-live .sc-step[data-side="bottom"] .sc-big{font-size:clamp(1.9rem,3.6vw,3.2rem)}
.sc-live .sc-step[data-side="bottom"].on{transform:translate(-50%,0)}
.sc-live .sc-step[data-side="bottom"] .sc-p,.sc-live .sc-step[data-side="bottom"] .sc-hours{margin-inline:auto}
.sc-live .sc-step[data-side="bottom"] .actions{justify-content:center}
.sc-live .sc-steps{position:absolute;inset:0;display:block;width:auto}
.sc-live .sc-bar{display:block;position:absolute;left:50%;bottom:22px;width:min(220px,40vw);height:3px;margin-left:calc(min(220px,40vw) / -2);border-radius:3px;background:color-mix(in srgb,var(--tx) 14%,transparent);overflow:hidden}
.sc-live .sc-bar i{display:block;height:100%;width:calc(var(--p,0) * 100%);background:var(--at)}
.s-cinema .sc-word{display:block;position:absolute;left:50%;top:13%;white-space:nowrap;font:800 clamp(3.5rem,calc(132vw / var(--len,6)),17rem)/.85 var(--hf);letter-spacing:-.05em;color:transparent;background:linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.02));-webkit-background-clip:text;background-clip:text;transform:translateX(calc(-50% - var(--p,0) * 18%)) scale(calc(1 + var(--p,0) * .1));pointer-events:none}
.s-cinema .scrolly{background:#000}
.s-cinema .sc-h1,.s-cinema .sc-big,.s-cinema .sc-num b{background:linear-gradient(180deg,#fff 30%,#c4bfe6);-webkit-background-clip:text;background-clip:text;color:transparent}
@media (max-width:760px){
  .sc-live{height:calc(var(--steps) * 84vh + 8vh)}
  .sc-live .sc-obj{width:min(74vw,330px);top:35%;margin:calc(min(74vw,330px) / -2) 0 0 calc(min(74vw,330px) / -2)}
  .sc-live .sc-step,.sc-live .sc-step[data-side]{left:20px;right:20px;width:auto;top:auto;bottom:calc(7vh + 14px);text-align:left;transform:translateY(18px)}
  .sc-live .sc-step.on,.sc-live .sc-step[data-side].on{transform:none}
  .sc-live .sc-step[data-side="bottom"] .actions{justify-content:flex-start}
  .sc-h1{font-size:clamp(2.2rem,10vw,3.2rem)}.sc-big{font-size:clamp(1.9rem,8.6vw,2.8rem)}.sc-num b{font-size:clamp(3.6rem,18vw,5.4rem)}
  .s-cinema .sc-word{top:9%}
  .sc-live .sc-cap{bottom:auto;top:12px;right:12px;left:auto;max-width:70%;text-align:right}
}
.lite .o3d-sv:nth-child(n+4),.lite .o3d-l:nth-child(n+4){display:none}
.lite .sc-live .sc-step{filter:none}.lite .sc-glow{filter:blur(14px)}
@media (prefers-reduced-motion:reduce){.sc-live{height:auto}}
/* Entradas ao rolar: só depois que o script marca o elemento (sem script, tudo visível). */
.rv{opacity:0;transform:translateY(var(--rv-y,22px));filter:blur(var(--rv-blur,0px));transition:opacity .9s cubic-bezier(.2,.7,.1,1),transform .9s cubic-bezier(.2,.7,.1,1),filter .9s cubic-bezier(.2,.7,.1,1)}
.rv.in{opacity:1;transform:none;filter:none}
@media (max-width:860px){
  body{font-size:16px}
  .burger{display:grid;place-items:center;width:44px;height:44px;cursor:pointer;font-size:1.5rem;color:var(--tx);border-radius:10px}
  .nav{display:none;position:absolute;top:100%;left:-20px;right:-20px;flex-direction:column;gap:0;background:var(--bg);border-bottom:1px solid var(--line);box-shadow:0 20px 30px -20px rgba(0,0,0,.4)}
  .nav a{padding:16px 20px;border-top:1px solid var(--line)}
  #menu-toggle:checked ~ .nav{display:flex}
  .split,.hero-grid{grid-template-columns:minmax(0,1fr);gap:36px}
  .sec{padding:68px 0}
  .media img{aspect-ratio:4/3}
  .cta{padding:64px 0}
}
@media (max-width:520px){.actions .btn{flex:1 1 auto}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
${STYLE_CSS[style]}`;
}

const STYLE_CSS: Record<SiteStyle, string> = {
  immersive: "",
  // Palco cinematográfico: preto absoluto, brilho na cor da marca sob o "objeto" central, palavra gigante ao fundo,
  // textos que entram desfocados, números grandes e um seletor de amostras que troca o destaque e a cor do brilho.
  cinema: `
body{--glow:var(--p);--rv-blur:12px;--rv-y:30px;background:#000}
.topbar{background:rgba(0,0,0,.6);border-bottom-color:rgba(255,255,255,.06)}
.brand{font-weight:800;letter-spacing:-.02em;font-size:1.05rem}
.nav a{font-size:.82rem}
.hero.cine-hero{--sp:0;min-height:min(92vh,820px);display:grid;align-items:end;padding:96px 0 64px;background:#000;isolation:isolate}
.cine-word{position:absolute;left:50%;top:9%;transform:translate(-50%,calc(var(--sp) * -70px)) scale(calc(1 + var(--sp) * .12));font:800 clamp(3.5rem,calc(132vw / var(--len,6)),17rem)/.85 var(--hf);letter-spacing:-.05em;white-space:nowrap;color:transparent;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.02));-webkit-background-clip:text;background-clip:text;z-index:-1;pointer-events:none;max-width:100vw;overflow:hidden;text-align:center}
.cine-stage{position:absolute;inset:0;display:grid;place-items:center;z-index:-1;pointer-events:none}
.cine-glow{position:absolute;left:71%;top:64%;width:min(60vw,700px);aspect-ratio:2/1;transform:translate(-50%,-50%);background:radial-gradient(closest-side,color-mix(in srgb,var(--glow) 75%,transparent),transparent 72%);filter:blur(30px);opacity:.85;transition:background 1.2s ease}
.cine-object{position:absolute;left:71%;top:50%;transform:translate(-50%,calc(-50% + var(--sp) * 50px)) scale(calc(1 - var(--sp) * .08));width:min(32vw,400px);pointer-events:auto}
.cine-tilt{transform-style:preserve-3d}
.cine-photo{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:28px;box-shadow:0 60px 90px -40px color-mix(in srgb,var(--glow) 70%,#000),0 0 0 1px rgba(255,255,255,.08)}
.cine-mono{position:relative;width:100%;aspect-ratio:1;display:grid;place-items:center}
.cine-mono span{position:relative;z-index:1;font:800 clamp(5rem,13vw,10rem)/1 var(--hf);letter-spacing:-.06em;background:linear-gradient(160deg,#fff 10%,color-mix(in srgb,var(--glow) 55%,#d4d4d8) 55%,#52525b);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 30px 40px rgba(0,0,0,.6))}
.cine-mono .ring{position:absolute;z-index:0;inset:6%;border-radius:50%;border:1px solid rgba(255,255,255,.14);transform:rotateX(68deg);animation:cine-spin 16s linear infinite}
.cine-mono .r2{inset:16%;border-color:color-mix(in srgb,var(--glow) 60%,transparent);animation-duration:22s;animation-direction:reverse}
@keyframes cine-spin{to{transform:rotateX(68deg) rotateZ(360deg)}}
.cine-copy{position:relative;z-index:1}.cine-copy > *{max-width:min(46vw,560px)}
.cine-hero h1{font-weight:800;letter-spacing:-.045em;font-size:clamp(2.6rem,6.4vw,5.2rem);line-height:.98;max-width:12ch;background:linear-gradient(180deg,#fff 30%,#c7c3e6);-webkit-background-clip:text;background-clip:text;color:transparent}
.cine-hero .lead{color:#a1a1aa;max-width:40ch}
.btn{border-radius:999px;font-size:.92rem;min-height:46px;padding:12px 24px}
.btn-ghost{color:#f5f5f7;border-color:rgba(255,255,255,.25)}
.sec{padding:120px 0}.sec.alt{background:#060608}
.sec-head h2{font-weight:800;letter-spacing:-.045em;font-size:clamp(2.4rem,5.6vw,4rem);line-height:1;background:linear-gradient(180deg,#fff 35%,#bdb8e0);-webkit-background-clip:text;background-clip:text;color:transparent}
.card{background:#0c0c10;border-color:rgba(255,255,255,.07)}
.cine-pick{background:radial-gradient(60% 60% at 75% 50%,color-mix(in srgb,var(--glow) 18%,transparent),transparent 70%),#000;transition:background 1.2s ease}
.pick-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:56px;align-items:center}
.pick-panels{display:grid;gap:16px}
.pick-panel{background:transparent;border:0;padding:0}
.pick-panel h3{font-weight:800;letter-spacing:-.04em;font-size:clamp(2rem,4.4vw,3.4rem);line-height:1}
.pick-panel p{font-size:1.1rem;margin-top:12px;max-width:44ch}
.js .pick-panel{display:none}.js .pick-panel.is-on{display:block;animation:pick-in .7s cubic-bezier(.2,.7,.1,1)}
@keyframes pick-in{from{opacity:0;filter:blur(10px);transform:translateY(14px)}}
.pick-swatches{display:none;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px}
.js .pick-swatches{display:grid}
.swatch{display:grid;gap:10px;justify-items:start;text-align:left;background:#0c0c10;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:12px;color:#d4d4d8;font:600 .82rem/1.2 var(--bf);cursor:pointer;transition:border-color .3s,transform .3s}
.swatch i{display:block;width:100%;aspect-ratio:4/3;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.swatch:hover{transform:translateY(-3px)}
.swatch.is-on{border-color:var(--glow);color:#fff;box-shadow:0 0 0 1px var(--glow),0 20px 40px -24px var(--glow)}
.stats .stat-v b{background:linear-gradient(180deg,#fff 30%,#a8a2d6);-webkit-background-clip:text;background-clip:text;color:transparent}
.cta{background:radial-gradient(70% 120% at 50% 100%,color-mix(in srgb,var(--glow) 45%,transparent),transparent 70%),#000;color:#f5f5f7}
.cta .btn-invert{background:#f5f5f7;color:#000;border-color:#f5f5f7}
.contact{grid-template-columns:1fr;gap:0;border-top:1px solid rgba(255,255,255,.1)}
.contact li,.sec:not(.alt) .contact li{flex-direction:row;justify-content:space-between;align-items:baseline;gap:20px;background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.1);border-radius:0;padding:18px 0}
.contact li > :last-child{text-align:right}
footer{border-top-color:rgba(255,255,255,.06)}
@media (max-width:860px){.hero.cine-hero{min-height:auto;padding:84px 0 48px;align-items:end}.cine-stage{position:relative;height:min(92vw,420px);margin-bottom:8px}.cine-object{width:min(70vw,320px);left:50%;top:50%}.cine-copy > *{max-width:none}.cine-glow{left:50%;width:120vw}.cine-word{top:4%}.pick-grid{grid-template-columns:minmax(0,1fr);gap:28px}.contact li,.sec:not(.alt) .contact li{flex-direction:column;gap:4px}.contact li > :last-child{text-align:left}}`,
  // Editorial: serifa grande, linhas finas, lista de serviços como índice de revista, sem cartões.
  atelier: `
body{--rv-y:16px}
.topbar .wrap{min-height:76px}.brand{font-weight:400;letter-spacing:.01em}
.nav a{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase}
.hero{padding:72px 0 96px}
.hero h1{font-weight:400;font-size:clamp(2.8rem,7.4vw,5.8rem);letter-spacing:-.015em;line-height:1}
.hero-art{justify-self:end;width:min(100%,430px)}
.arch img{aspect-ratio:4/5;object-fit:cover;width:100%;border-radius:999px 999px 0 0}
.btn{border-radius:0;text-transform:uppercase;letter-spacing:.14em;font-size:.8rem;padding:17px 30px}
.sec-head h2{font-weight:400}
.services .grid{display:block;border-top:1px solid var(--tx)}
.services .card{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:24px;align-items:baseline;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:28px 0;background:transparent}
.services .card h3{font-weight:400;font-size:clamp(1.5rem,3vw,2.1rem);margin:0}
.services .card:hover{padding-left:12px}
.about .prose p:first-child{font-family:var(--hf);font-size:clamp(1.35rem,2.6vw,1.8rem);line-height:1.35;color:var(--tx)}
.media img{border-radius:0}
.cta{background:var(--tx);color:var(--bg)}.cta .btn-invert{background:var(--bg);color:var(--tx);border-color:var(--bg)}
.contact li{border-radius:0}
@media (max-width:860px){.hero{padding:40px 0 72px}.hero-art{justify-self:center;width:min(100%,340px)}.services .card{grid-template-columns:1fr;gap:6px}}`,
  // Alto contraste: capa escura cheia, tipografia condensada enorme, faixa diagonal com os serviços, cartões com profundidade.
  forge: `
body{--rv-blur:4px}
.brand{font-size:1.6rem;letter-spacing:.06em;text-transform:uppercase;font-weight:400}
.nav a{text-transform:uppercase;letter-spacing:.14em;font-size:.8rem;font-weight:700}
.hero{min-height:min(86vh,760px);display:flex;flex-direction:column;justify-content:flex-end;padding:120px 0 0;background:radial-gradient(120% 90% at 85% 10%,color-mix(in srgb,var(--a) 22%,transparent),transparent 60%),var(--bg)}
.hero.has-img{background:#000}
.hero-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.55;filter:grayscale(.2) contrast(1.1)}
.hero.has-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.88))}
.hero-orn{position:absolute;right:-4%;top:4%;width:min(58vw,620px);opacity:.9}
.hero-copy{position:relative;z-index:1;padding-bottom:72px}
.hero h1{font-weight:400;font-size:clamp(3.6rem,12vw,9.5rem);line-height:.88;text-transform:uppercase;letter-spacing:.01em;max-width:12ch}
.hero.has-img h1,.hero.has-img .lead{color:#fff}
.hero .lead{color:color-mix(in srgb,var(--tx) 80%,transparent)}
.band{position:relative;z-index:1;background:var(--a);color:var(--on-a);transform:skewY(-2deg);transform-origin:left;margin-bottom:-14px;padding:18px 0 26px}
.band .wrap{display:flex;flex-wrap:wrap;gap:8px 28px;transform:skewY(2deg)}
.band span{font-family:var(--hf);font-size:clamp(1.25rem,2.6vw,1.9rem);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.band span+span::before{content:"✦";margin-right:28px;font-size:.7em;opacity:.7}
.btn{text-transform:uppercase;letter-spacing:.12em;font-size:.86rem;border-radius:0}
.hero .btn-ghost{color:var(--tx);border-color:color-mix(in srgb,var(--tx) 40%,transparent)}.hero.has-img .btn-ghost{color:#fff;border-color:rgba(255,255,255,.55)}
.sec-head h2{font-weight:400;text-transform:uppercase;font-size:clamp(2.6rem,6vw,4.4rem);letter-spacing:.01em}
.services .card{background:var(--sf);border:1px solid var(--line);border-top:4px solid var(--a);will-change:transform}
.services.alt .card{background:var(--bg)}
.services .card h3{font-weight:400;text-transform:uppercase;font-size:1.8rem;letter-spacing:.02em}
.services .card:hover{box-shadow:0 30px 50px -30px color-mix(in srgb,var(--a) 70%,transparent);border-color:color-mix(in srgb,var(--a) 50%,transparent)}
.cta{background:var(--a);color:var(--on-a)}.cta h2{text-transform:uppercase;font-weight:400;font-size:clamp(2.4rem,6vw,4.2rem)}.cta .btn-invert{background:var(--on-a);color:var(--a);border-color:var(--on-a)}
@media (max-width:860px){.hero{min-height:auto;padding-top:110px}.hero-orn{width:92vw;right:-30%;top:0;opacity:.22}.hero-copy{padding-bottom:56px}}`,
  // Clínica: claro, cantos suaves, contatos confirmados em destaque logo abaixo da capa.
  clinic: `
body{--rv-y:14px}
.brand{font-weight:800;letter-spacing:-.02em}
.hero{padding:64px 0 40px;background:linear-gradient(180deg,color-mix(in srgb,var(--p) 7%,var(--bg)),var(--bg))}
.hero h1{font-weight:800;letter-spacing:-.035em;font-size:clamp(2.4rem,5.6vw,4.2rem)}
.hero-art{width:min(100%,440px);justify-self:end}
.soft img{aspect-ratio:1;object-fit:cover;width:100%;border-radius:40px}
.btn{border-radius:999px}
.facts{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:14px;margin-top:48px}
.facts li{display:flex;flex-direction:column;gap:4px;padding:18px 20px;border-radius:18px;background:var(--bg);border:1px solid var(--line);box-shadow:0 10px 30px -22px color-mix(in srgb,var(--p) 60%,transparent);overflow-wrap:anywhere}
.facts span{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mu);font-weight:700}
.facts b,.facts a{font-weight:700;color:var(--tx);text-decoration:none}
.sec-head h2{font-weight:800;letter-spacing:-.03em}
.services .card{border-radius:22px;background:var(--bg)}
.services .card h3{font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:10px}
.services .card h3::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--p);flex-shrink:0}
.services .card:hover{transform:translateY(-4px);box-shadow:0 22px 40px -28px color-mix(in srgb,var(--p) 70%,transparent)}
.cta{border-radius:32px;width:min(1160px,100% - 40px);margin:40px auto 96px;padding-inline:8px}
@media (max-width:860px){.hero{padding-top:40px}.hero-art{justify-self:center;width:min(100%,320px)}.cta{margin:20px auto 68px;border-radius:24px}}`,
  // Artesanal: capa centralizada com formas orgânicas, serifa calorosa, cardápio com linhas pontilhadas.
  hearth: `
.brand{font-style:italic;font-weight:600}
.hero{padding:48px 0 96px;text-align:center}
.hero-center{display:flex;flex-direction:column;align-items:center}
.hero-art{width:min(100%,500px);margin-bottom:24px;position:relative}
.plate{position:absolute;inset:10% 25%}
.plate img{width:100%;height:100%;object-fit:cover;border-radius:50%;box-shadow:0 30px 60px -30px rgba(0,0,0,.5);border:8px solid var(--bg)}
.hero h1{font-weight:600;letter-spacing:-.02em;font-size:clamp(2.6rem,7vw,5.2rem)}
.hero .lead{margin-inline:auto}.hero .actions{justify-content:center}
.btn{border-radius:999px}
.sec-head h2{font-weight:600}
.sec-head h2::after{content:"";display:block;width:64px;height:4px;border-radius:4px;background:var(--a);margin-top:16px}
.services .card{border-radius:26px;border:0;background:var(--sf)}
.services.alt .card{background:var(--bg)}
.services .card h3{font-weight:600;font-style:italic}
.services .card:hover{transform:rotate(-.6deg) translateY(-3px)}
.menu-cat h3{font-style:italic}
.cta{background:var(--tx);color:var(--bg)}.cta .btn-invert{background:var(--a);color:var(--on-a);border-color:var(--a)}
@media (max-width:860px){.hero{padding:28px 0 72px}.hero-art{width:min(100%,340px)}}`,
  // Contemporâneo: grade em blocos e pilha de cartões em perspectiva na capa (3D discreto, segue o ponteiro).
  studio: `
.brand{font-weight:800;letter-spacing:-.02em}
.hero{padding:72px 0 104px;background:radial-gradient(90% 80% at 100% 0%,color-mix(in srgb,var(--p) 14%,transparent),transparent 60%),radial-gradient(70% 60% at 0% 100%,color-mix(in srgb,var(--a) 12%,transparent),transparent 60%)}
.hero h1{font-weight:800;letter-spacing:-.045em;font-size:clamp(2.5rem,6.2vw,4.7rem)}
.btn{border-radius:14px}
.stack{position:relative;height:420px;perspective:1200px;transform-style:preserve-3d}
.stack .tile{position:absolute;width:58%;aspect-ratio:4/5;border-radius:22px;padding:24px;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:0 40px 70px -40px rgba(10,20,40,.55);transition:transform .8s cubic-bezier(.2,.7,.1,1);overflow:hidden}
.stack .tile b{font-family:var(--hf);font-size:clamp(1.15rem,2vw,1.5rem);line-height:1.12;font-weight:800;letter-spacing:-.02em}
.stack .t0{left:4%;top:10%;background:var(--p);color:var(--on-p);transform:translateZ(60px) rotateY(-14deg) rotateX(6deg);z-index:3}
.stack .t1{left:24%;top:4%;background:var(--sf);color:var(--tx);border:1px solid var(--line);transform:translateZ(0) rotateY(-14deg) rotateX(6deg);z-index:2}
.stack .t2{left:42%;top:-2%;background:var(--a);color:var(--on-a);transform:translateZ(-60px) rotateY(-14deg) rotateX(6deg);z-index:1}
.stack .t1{background-image:repeating-linear-gradient(135deg,transparent 0 18px,color-mix(in srgb,var(--p) 8%,transparent) 18px 19px)}
.stack .photo{padding:0}.stack .photo img{width:100%;height:100%;object-fit:cover}
.stack:hover .t0{transform:translateZ(80px) rotateY(-8deg) rotateX(4deg) translateX(-12px)}
.stack:hover .t2{transform:translateZ(-60px) rotateY(-8deg) rotateX(4deg) translateX(18px)}
.sec-head h2{font-weight:800;letter-spacing:-.04em}
.services .grid{grid-template-columns:repeat(6,minmax(0,1fr))}
.services .card{grid-column:span 2;border-radius:20px}
.services .card:first-child{grid-column:span 4;background:var(--p);color:var(--on-p);border-color:var(--p)}
.services .card:first-child p{color:inherit;opacity:.85}
.services .n1 .card,.services .n3 .card:nth-child(3),.services .n6 .card:nth-child(6){grid-column:span 6}
.services .n2 .card{grid-column:span 3}
.services .n4 .card:nth-child(4),.services .n7 .card:nth-child(7){grid-column:span 4}
.services .card:hover{transform:translateY(-4px);box-shadow:0 24px 40px -28px rgba(10,20,40,.5)}
.services .card h3{font-weight:800;letter-spacing:-.02em}
.cta{background:linear-gradient(120deg,var(--p),color-mix(in srgb,var(--p) 65%,#000))}
@media (max-width:860px){.hero{padding:40px 0 72px}.stack{height:300px;width:min(100%,380px);margin-inline:auto}.services .grid{grid-template-columns:minmax(0,1fr)}.services .grid .card:nth-child(n){grid-column:auto}}`,
};

function jsonLd(c: SiteContent) {
  const b = c.business;
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": "LocalBusiness", name: b.name };
  if (b.phone) data.telephone = b.phone;
  if (b.email) data.email = b.email;
  if (b.address) data.address = b.address;
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

export type RenderOpts = { footerCredit?: boolean; previewRibbon?: string | null; lang?: string; noindex?: boolean; threeSrc?: string };

export function renderSite(c: SiteContent, opts: RenderOpts = { footerCredit: true }): string {
  if (resolveStyle(c) === "immersive") return renderImmersive(c, opts);
  const th = c.theme;
  const style = resolveStyle(c);
  const visible = c.sections.filter((s) => s.visible);
  const nav = visible
    .filter((s) => NAV_LABELS[s.type] && !(s.type === "gallery" && !s.images.some((i) => imgSrc(i))) && !(s.type === "hours" && !s.lines.some((l) => l.value.trim())))
    .map((s) => `<a href="#${esc(s.id)}">${esc(s.type === "services" || s.type === "products" || s.type === "menu" ? s.title : NAV_LABELS[s.type])}</a>`)
    .join("");
  const year = new Date().getFullYear();
  let alt = false;
  // Palco 3D: na direção cinematográfica ele é a própria capa; nas demais entra no lugar dos serviços.
  // Os serviços e os números confirmados viram etapas do palco (sem repetir seções).
  const svcSec = visible.find((s) => s.type === "services" || s.type === "products");
  // Sem serviços (ex.: restaurante): o palco entra antes do cardápio (categorias viram etapas) ou do "Sobre".
  const anchor = svcSec ?? visible.find((s) => s.type === "menu") ?? visible.find((s) => s.type === "about");
  const useStage = c.stage?.mode !== "off" && (!!anchor || (style === "cinema" && visible.some((s) => s.type === "hero")));
  const statSec = visible.find((s) => s.type === "stats");
  const stItems = svcSec
    ? svcSec.type === "services" ? svcSec.items : svcSec.type === "products" ? svcSec.items.map((i) => ({ title: i.name, description: i.description })) : []
    : anchor?.type === "menu"
      ? anchor.categories.filter((cat) => cat.items.some((i) => i.name && !/^item do card/i.test(i.name))).map((cat) => ({ title: cat.name, description: cat.items.map((i) => i.name).slice(0, 4).join(" · ") }))
      : [];
  const stStats = statSec && statSec.type === "stats" ? statSec.items.filter((i) => i.value.trim() && i.label.trim()) : [];
  let stageDone = false;
  const body = visible
    .map((s) => {
      if (useStage && !stageDone && style === "cinema" && s.type === "hero") {
        stageDone = true;
        const intro = `${c.siteName && c.siteName !== s.title ? `<p class="sc-k">${esc(c.siteName)}</p>` : ""}<h1 class="sc-h1">${esc(s.title)}</h1>${s.subtitle ? `<p class="sc-p">${esc(s.subtitle)}</p>` : ""}${heroActions(s, c)}`;
        return renderScrolly(c, style, { id: s.id, intro, items: stItems, stats: stStats, hero: s }) + infoStrip(c, visible);
      }
      if (useStage && s.type === "stats") return ""; // números confirmados viram etapas do palco
      if (useStage && (s.type === "services" || s.type === "products") && stageDone) return "";
      if (useStage && !stageDone && anchor && s.id === anchor.id) {
        stageDone = true;
        const heroSec = visible.find((h) => h.type === "hero") as Extract<Section, { type: "hero" }> | undefined;
        const replaces = s.type === "services" || s.type === "products";
        const intro = `<p class="sc-k">${esc(c.business.name)}</p><h2 class="sc-big">${esc(replaces ? s.title : heroSec?.subtitle || c.siteName)}</h2>${replaces && "intro" in s && s.intro ? `<p class="sc-p">${esc(s.intro)}</p>` : ""}`;
        const stage = renderScrolly(c, style, { id: replaces ? s.id : `${s.id}-palco`, intro, items: stItems, stats: stStats, hero: heroSec });
        return replaces ? stage : stage + "\n" + sectionHtml(s, c, style, alt);
      }
      if (s.type === "hero") return sectionHtml(s, c, style, false) + (style === "clinic" ? "" : infoStrip(c, visible));
      if (s.type === "cta") return sectionHtml(s, c, style, false);
      const html = sectionHtml(s, c, style, alt);
      if (html) alt = !alt;
      return html;
    })
    .join("\n");
  const uses3d = STYLE_INFO[style].uses3d;

  return `<!doctype html>
<html lang="${esc(opts.lang ?? "pt-BR")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.seo.title || c.siteName)}</title>
<meta name="description" content="${esc(c.seo.description)}">
${opts.noindex ? '<meta name="robots" content="noindex, nofollow">\n' : ""}<meta property="og:title" content="${esc(c.seo.title || c.siteName)}">
<meta property="og:description" content="${esc(c.seo.description)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="${esc(th.background)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(googleFontsHref([th.headingFont, th.bodyFont]))}">
${jsonLd(c)}
<style>
${baseCss(c, style)}
</style>
</head>
<body class="s-${style}">
${opts.previewRibbon ? `<div class="preview-ribbon" role="note">${esc(opts.previewRibbon)}</div>` : ""}
<header class="topbar"><div class="wrap">
  <a class="brand" href="#">${esc(c.siteName)}</a>
  <input type="checkbox" id="menu-toggle" aria-label="Abrir menu"><label class="burger" for="menu-toggle" aria-hidden="true">☰</label>
  <nav class="nav" aria-label="Seções">${nav}</nav>
</div></header>
<main>
${body}
</main>
<footer><div class="wrap"><span>© ${year} ${esc(c.business.name)}</span>${opts.footerCredit ? `<span>Site criado com SiteHunter AI</span>` : ""}</div></footer>
${(() => {
  const n = waNumber(c.business.whatsapp);
  return n
    ? `<a class="wa-float" href="https://wa.me/${n}" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg></a>`
    : "";
})()}
<script>
document.querySelectorAll('form.quote').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f);var msg='Olá! Meu nome é '+d.get('nome')+'. Vim pelo site da '+f.dataset.biz+'.\\n\\n'+d.get('mensagem');if(f.dataset.wa){window.open('https://wa.me/'+f.dataset.wa+'?text='+encodeURIComponent(msg),'_blank','noopener');}else if(f.dataset.email){location.href='mailto:'+f.dataset.email+'?subject='+encodeURIComponent('Orçamento')+'&body='+encodeURIComponent(msg);}});});
document.querySelectorAll('.nav a').forEach(function(a){a.addEventListener('click',function(){var t=document.getElementById('menu-toggle');if(t)t.checked=false;});});
${motionScript(style, uses3d)}
</script>
</body>
</html>`;
}

/**
 * Movimento dos sites (aprimoramento progressivo): sem script, tudo aparece normalmente.
 * Entradas ao rolar (com desfoque na direção cinematográfica), números que contam até o valor,
 * seletor de amostras, parallax da capa e inclinação 3D. Tudo desligado com movimento reduzido.
 */
function motionScript(style: SiteStyle, uses3d: boolean) {
  return `(function(){var d=document,h=d.documentElement;h.classList.add('js');var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;var nv=navigator,lite=(nv.hardwareConcurrency||8)<=4||(nv.deviceMemory||8)<=4||!!(nv.connection&&nv.connection.saveData)||innerWidth<700;if(lite)h.classList.add('lite');
d.querySelectorAll('[data-picker]').forEach(function(sec){var bs=sec.querySelectorAll('[data-pick]'),ps=sec.querySelectorAll('[data-panel]');function on(i){bs.forEach(function(b){var a=b.dataset.pick==i;b.classList.toggle('is-on',a);b.setAttribute('aria-selected',a);if(a&&b.dataset.tone)d.body.style.setProperty('--glow',b.dataset.tone);});ps.forEach(function(p){p.classList.toggle('is-on',p.dataset.panel==i);});}bs.forEach(function(b){b.addEventListener('click',function(){on(b.dataset.pick);});});});
function fmt(n,dec,src){var s=src.indexOf('.')>-1||src.indexOf(',')>-1?n.toFixed(src.split(/[.,]/)[1].length):String(Math.round(n));return dec===','?s.replace('.',','):s;}
var counts=d.querySelectorAll('[data-count]');
if(!rm)d.querySelectorAll('[data-scrolly]').forEach(function(sc){var P=JSON.parse(sc.getAttribute('data-poses')),st=[].slice.call(sc.querySelectorAll('.sc-step')),rot=sc.querySelector('.sc-rot'),fl=sc.querySelector('.sc-floor'),stg=sc.querySelector('.sc-stage'),k=st.length,cur=-1,mob=matchMedia('(max-width: 760px)'),rq=0;sc.classList.add('sc-live');
function ps(i){var q=P[Math.min(i,P.length-1)].slice();if(mob.matches){q[0]=0;q[1]=q[1]*.4-2;q[5]=q[5]*.92;}return q;}
function ez(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function cnt(el){el.querySelectorAll('[data-scount]').forEach(function(b){if(b.dataset.done)return;b.dataset.done=1;var to=parseFloat(b.dataset.scount),src=b.textContent,t0=performance.now();(function f(n){var q=Math.min(1,(n-t0)/1200),v=to*(1-Math.pow(1-q,3));b.textContent=fmt(v,b.dataset.dec,src);if(q<1)requestAnimationFrame(f);else b.textContent=src;})(t0);});}
function up(){var r=sc.getBoundingClientRect(),tot=Math.max(1,r.height-innerHeight),p=Math.min(1,Math.max(0,-r.top/tot)),f=p*(k-1),i=Math.min(k-1,Math.floor(f)),t=ez(f-i),a=ps(i),b=ps(Math.min(k-1,i+1)),v=a.map(function(x,j){return x+(b[j]-x)*t;});
rot.style.transform='translate3d('+v[0].toFixed(2)+'vw,'+v[1].toFixed(2)+'vh,0) rotateX('+v[2].toFixed(1)+'deg) rotateY('+v[3].toFixed(1)+'deg) rotateZ('+v[4].toFixed(1)+'deg) scale('+v[5].toFixed(3)+')';
if(fl)fl.style.transform='translate3d('+v[0].toFixed(2)+'vw,'+v[1].toFixed(2)+'vh,0) scale('+v[5].toFixed(3)+')';stg.style.setProperty('--p',p.toFixed(3));stg.style.setProperty('--ry',v[3].toFixed(1));var ac=Math.min(k-1,Math.round(f));if(ac!==cur){cur=ac;stg.classList.toggle('alt-glow',ac%2===1);st.forEach(function(s,j){s.classList.toggle('on',j===ac);});cnt(st[ac]);}}
addEventListener('scroll',function(){cancelAnimationFrame(rq);rq=requestAnimationFrame(up);},{passive:true});addEventListener('resize',up);up();});
if(rm||!('IntersectionObserver' in window))return;
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var t=e.target;io.unobserve(t);if(t.dataset.count){var to=parseFloat(t.dataset.count),src=t.textContent,t0=performance.now();(function f(now){var k=Math.min(1,(now-t0)/1400),v=to*(1-Math.pow(1-k,3));t.textContent=fmt(v,t.dataset.dec,src);if(k<1)requestAnimationFrame(f);else t.textContent=src;})(t0);}else{t.classList.add('in');setTimeout(function(){t.classList.remove('rv','in','img-rv');t.style.transitionDelay='';},1300);}});},{rootMargin:'0px 0px -8% 0px'});
var groups=d.querySelectorAll('.sec-head,.card:not(.pick-panel),.prose,.gallery figure,.contact li,.stat,.menu-cat,.hours,.cta-inner,.pick-swatches,.facts li');
groups.forEach(function(el,i){if(el.getBoundingClientRect().top>innerHeight*.92){el.classList.add('rv');var sib=el.parentElement?[].indexOf.call(el.parentElement.children,el):0;el.style.transitionDelay=Math.min(sib,5)*70+'ms';io.observe(el);}});
counts.forEach(function(el){io.observe(el);});
var imgs=[].slice.call(d.querySelectorAll('.media img,.gallery img,.card-img img'));imgs.forEach(function(im){if(im.getBoundingClientRect().top>innerHeight*.9){im.classList.add('img-rv');io.observe(im);}});
if(imgs.length&&!lite){var pq=0;var upd=function(){imgs.forEach(function(im){var r=im.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;im.style.setProperty('--par',(((r.top+r.height/2)-innerHeight/2)/innerHeight*-26).toFixed(1)+'px');});};addEventListener('scroll',function(){cancelAnimationFrame(pq);pq=requestAnimationFrame(upd);},{passive:true});upd();}
var hero=d.querySelector('.cine-hero');if(hero){var raf=0;addEventListener('scroll',function(){cancelAnimationFrame(raf);raf=requestAnimationFrame(function(){var r=hero.getBoundingClientRect(),p=Math.min(1,Math.max(0,-r.top/r.height));hero.style.setProperty('--sp',p.toFixed(3));});},{passive:true});}
${uses3d ? `if(!lite&&matchMedia('(pointer: fine)').matches)d.querySelectorAll('[data-tilt]').forEach(function(el){var max=el.classList.contains('stack')?10:el.classList.contains('cine-tilt')?12:6;el.style.transition='transform .5s cubic-bezier(.2,.7,.1,1)';el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform='perspective(900px) rotateY('+(x*max)+'deg) rotateX('+(-y*max)+'deg)';});el.addEventListener('pointerleave',function(){el.style.transform='';});});` : ""}
})();`;
}

/** Política de segurança de conteúdo aplicada aos sites publicados (scriptOrigin: de onde vem o three.js). */
export function publishedSiteCsp(scriptOrigin?: string) {
  return PUBLISHED_SITE_CSP.replace("script-src 'unsafe-inline'", `script-src 'unsafe-inline'${scriptOrigin ? " " + scriptOrigin : ""}`);
}

export const PUBLISHED_SITE_CSP = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  // Origem opaca: mesmo servido em /s/<slug> no domínio do painel, o site não lê cookies nem chama as APIs do painel.
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
].join("; ");
