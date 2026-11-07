import type { Concept, Section, SiteContent, SiteImage } from "../types";
import { button, esc, imageCaption, imgSrc, mapsHref, nl2p, safeUrl, telHref, waNumber, type RenderOpts } from "../render";
import { buildConcept, withMood } from "./concept";
import { realRuntime } from "./realRuntime";
import { GLTF_ASSETS, assetForModel } from "./kinds";
import { libraryMetaBySrc } from "../photoLibrary";

// Página profissional por empresa (direção "Vitrine"): estrutura de landing page em ordem lógica
// (proposta → serviços → sobre → galeria → horários e localização → chamada final), com a identidade
// do ramo (paleta, tipografia, clara ou escura) e fotos que nunca são exibidas maiores do que são.
// 3D só aparece quando existe modelo escaneado de um objeto real; sem isso, a abertura é fotográfica.

/** Conceito salvo no conteúdo; sites antigos recebem um conceito derivado do que já existe. */
export function conceptOf(c: SiteContent): Concept {
  if (c.concept) return withMood(c.concept);
  const about = c.sections.find((s) => s.type === "about");
  return buildConcept({
    name: c.business.name || c.siteName,
    category: c.seo.description,
    segmentKey: "",
    description: about && about.type === "about" ? about.text : null,
    instagram: c.business.instagram,
    hasWhatsapp: !!c.business.whatsapp,
  });
}

const FONT_W: Record<string, string> = {
  Syne: ":wght@500;600;700", Unbounded: ":wght@400;500;600", Anton: "", "Bricolage Grotesque": ":wght@400;500;700", "Instrument Serif": ":ital@0;1",
  Fraunces: ":wght@400;500;600", "Cormorant Garamond": ":wght@500;600;700", "Space Grotesk": ":wght@400;500;700", "Archivo Black": "", Archivo: ":wght@400;500;600",
  Sora: ":wght@300;400;600", Inter: ":wght@400;500;600", Manrope: ":wght@400;500;700",
};
function fontsHref(fams: string[]) {
  return `https://fonts.googleapis.com/css2?${[...new Set(fams)].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}${FONT_W[f] ?? ":wght@400;700"}`).join("&")}&display=swap`;
}
/** Fontes largas ou condensadas precisam de outro corpo para o título ocupar a mesma área. */
const TITLE_SCALE: Record<string, number> = { Unbounded: 0.74, Syne: 0.84, "Archivo Black": 0.82, Anton: 1.08, "Instrument Serif": 1.12, "Cormorant Garamond": 1.1, Fraunces: 0.96, "Bricolage Grotesque": 0.95, "Space Grotesk": 0.92, Sora: 0.9 };

const prettyPhone = (n: string) => { const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${n}`; };
/** "IBIO (Instituto ...)" → ["IBIO", "Instituto ..."]; "Nome - complemento" → ["Nome", "complemento"]. */
function splitName(t: string): [string, string] {
  const m = t.match(/^(.{2,40}?)\s*\((.{6,})\)\s*$/);
  if (m) return [m[1]!.trim(), m[2]!.trim()];
  const d = t.match(/^(.{3,40}?)\s+[-–—|]\s+(.{4,})$/);
  return d ? [d[1]!.trim(), d[2]!.trim()] : [t, ""];
}
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const firstSentence = (s: string) => { const m = s.match(/^(.{12,110}?[.!?])(\s|$)/); return m ? m[1]! : s.length <= 110 ? s : ""; };

type Img = SiteImage & { src: string };

/** <img> com srcset para fotos da biblioteca (versão de 640 px no celular) e dimensões contra salto de layout. */
function picture(i: Img, sizes: string, opts: { eager?: boolean; cls?: string } = {}): string {
  const meta = libraryMetaBySrc(i.src);
  const m = i.src.match(/^(.*\/photos\/[a-z]+\/\d+)\.jpg$/);
  const srcset = meta && m ? ` srcset="${esc(`${m[1]}-m.jpg`)} 640w, ${esc(i.src)} ${meta.w}w" sizes="${esc(sizes)}"` : "";
  const dims = meta ? ` width="${meta.w}" height="${meta.h}"` : "";
  return `<img${opts.cls ? ` class="${opts.cls}"` : ""} src="${esc(i.src)}"${srcset}${dims} alt="${esc(i.alt)}" ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
function figure(i: Img, sizes: string, cls: string, eager = false): string {
  return `<figure class="${cls}">${picture(i, sizes, { eager })}${imageCaption(i)}</figure>`;
}

export function renderImmersive(c: SiteContent, opts: RenderOpts = {}): string {
  const k = conceptOf(c);
  const P = k.palette;
  const ivory = k.mood === "ivory";
  const visible = c.sections.filter((s) => s.visible);
  const get = <T extends Section["type"]>(t: T) => visible.find((s) => s.type === t) as Extract<Section, { type: T }> | undefined;
  const hero = get("hero"), services = get("services"), products = get("products"), menu = get("menu"), about = get("about"), stats = get("stats"),
    gallery = get("gallery"), hours = get("hours"), cta = get("cta"), quote = get("quote"), contact = get("contact"), textSec = get("text");
  const b = c.business;
  const wa = waNumber(b.whatsapp);
  const [brand, brandFull] = splitName(c.siteName || b.name);
  const seed = k.seed;

  // ---------- imagens: cada foto aparece uma vez só ----------
  const used = new Set<string>();
  const asImg = (i: SiteImage | undefined): Img | null => { const src = imgSrc(i); return i && src ? { ...i, src } : null; };
  const pool: Img[] = [hero?.image, about?.image, ...(gallery?.images ?? []), ...(products?.items.map((p) => p.image) ?? [])].map(asImg).filter((x): x is Img => !!x);
  const take = (prefer?: SiteImage): Img | null => {
    const p = asImg(prefer);
    if (p && !used.has(p.src)) { used.add(p.src); return p; }
    const next = pool.find((x) => !used.has(x.src));
    if (next) used.add(next.src);
    return next ?? null;
  };

  // ---------- 3D realista (só com modelo escaneado) ----------
  const asset = assetForModel(k.model, seed);
  const threeSrc = opts.threeSrc ?? "/vendor/three.min.js";
  const base = opts.assetBase ?? threeSrc.replace(/vendor\/three\.min\.js$/, "models/");
  const res = (p: string) => (opts.assetUrl ? opts.assetUrl(`models/${p}`) : base + p);
  const vendor = (f: string) => (opts.assetUrl ? opts.assetUrl(`vendor/${f}`) : threeSrc.replace(/three\.min\.js$/, f));

  const heroImg = take(hero?.image);
  const aboutImg = take(about?.image);

  // ---------- textos da abertura: a proposta em destaque ----------
  const title = (hero?.title || c.siteName).trim();
  const sub = (hero?.subtitle ?? "").trim();
  const titleIsName = fold(title).includes(fold(brand)) || fold(brand).includes(fold(title));
  const proposal = titleIsName ? firstSentence(sub) || title : title;
  const lede = titleIsName ? sub.replace(proposal, "").trim() : sub;
  const where = k.kicker;
  const mainBtn = hero?.buttons[0];
  const hoursLines = hours?.lines.filter((l) => l.value.trim()) ?? [];
  const facts = [
    k.highlights[0] ? { t: "Horário", v: k.highlights[0] } : hoursLines[0] ? { t: hoursLines[0].label, v: hoursLines[0].value } : null,
    b.address ? { t: "Endereço", v: b.address.split("·")[0]!.trim() } : null,
    wa ? { t: "WhatsApp", v: prettyPhone(wa) } : b.phone ? { t: "Telefone", v: b.phone } : b.email ? { t: "E-mail", v: b.email } : null,
  ].filter((x): x is { t: string; v: string } => !!x).slice(0, 3);

  const side = seed % 2 ? "media-left" : "media-right";
  const heroMedia = asset
    ? `<div class="stage" data-stage3d aria-hidden="true"><canvas></canvas>${heroImg ? picture(heroImg, "(max-width: 900px) 100vw, 50vw", { cls: "stage-fallback" }) : ""}<span class="stage-loading">Carregando modelo 3D…</span></div>`
    : heroImg ? figure(heroImg, "(max-width: 900px) 100vw, 54vw", "hero-photo", true) : "";
  const heroHtml = `<section id="${esc(hero?.id ?? "inicio")}" class="hero ${side}${heroMedia ? "" : " no-media"}" aria-labelledby="h-hero">
  <div class="hero-copy">
    <p class="eyebrow rv">${esc(brand)}${where ? `<span>${esc(where)}</span>` : ""}</p>
    <h1 id="h-hero" class="h1 rv" style="--d:1">${esc(proposal)}</h1>
    ${brandFull ? `<p class="fullname rv" style="--d:1">${esc(brandFull)}</p>` : ""}
    ${lede ? `<p class="lede rv" style="--d:2">${esc(lede)}</p>` : ""}
    ${hero?.buttons.length ? `<div class="acts rv" style="--d:3">${hero.buttons.map((x, i) => button(x, c, i ? "btn ghost" : "btn")).join("")}</div>` : ""}
    ${facts.length ? `<dl class="facts rv" style="--d:4">${facts.map((f) => `<div><dt>${esc(f.t)}</dt><dd>${esc(f.v)}</dd></div>`).join("")}</dl>` : ""}
  </div>
  ${heroMedia ? `<div class="hero-media rv" style="--d:2">${heroMedia}</div>` : ""}
</section>`;

  // ---------- serviços / produtos / cardápio ----------
  const parts: string[] = [];
  const navItems: { id: string; label: string }[] = [];
  const svcItems = services?.items.filter((i) => i.title.trim()) ?? products?.items.filter((i) => i.name.trim()).map((i) => ({ title: i.name, description: i.description })) ?? [];
  const svc = services ?? products;
  if (svc && svcItems.length) {
    navItems.push({ id: svc.id, label: svc.title || "Serviços" });
    parts.push(`<section id="${esc(svc.id)}" class="sec" aria-labelledby="h-svc">
  <header class="sec-head"><p class="kicker rv">${esc(svc.title || "Serviços")}</p>${svc.intro && svc.intro.length <= 70 ? `<h2 id="h-svc" class="h2 rv" style="--d:1">${esc(svc.intro)}</h2>` : `<h2 id="h-svc" class="h2 rv" style="--d:1">${esc(svc.title && fold(svc.title) !== "servicos" ? svc.title : "O que oferecemos")}</h2>${svc.intro ? `<p class="lede rv" style="--d:2">${esc(svc.intro)}</p>` : ""}`}</header>
  <ol class="cards">${svcItems.slice(0, 9).map((it, n) => `<li class="card rv" style="--d:${(n % 3) + 1}"><span class="num" aria-hidden="true">${String(n + 1).padStart(2, "0")}</span><h3>${esc(it.title)}</h3>${it.description ? `<p>${esc(it.description)}</p>` : ""}</li>`).join("")}</ol>
</section>`);
  }
  const realItem = (i: { name: string }) => i.name.trim() && !/^item do card/i.test(i.name);
  // Cardápio só aparece com itens reais (os de exemplo ficam para o usuário preencher no editor).
  const menuCats = menu?.categories.filter((cat) => cat.name.trim()).map((cat) => ({ ...cat, items: cat.items.filter(realItem) })).filter((cat) => cat.items.length) ?? [];
  if (menu && menuCats.length) {
    navItems.push({ id: menu.id, label: menu.title || "Cardápio" });
    parts.push(`<section id="${esc(menu.id)}" class="sec" aria-labelledby="h-menu">
  <header class="sec-head"><p class="kicker rv">${esc(menu.title || "Cardápio")}</p><h2 id="h-menu" class="h2 rv" style="--d:1">${esc(menu.intro || "Do nosso cardápio")}</h2></header>
  <div class="menu-grid">${menuCats.slice(0, 6).map((cat, n) => `<div class="menu-cat rv" style="--d:${(n % 3) + 1}"><h3>${esc(cat.name)}</h3><ul>${cat.items.slice(0, 8).map((i) => `<li><span class="mi-name">${esc(i.name)}</span>${i.price ? `<span class="mi-price">${esc(i.price)}</span>` : ""}${i.description ? `<span class="mi-desc">${esc(i.description)}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}</div>
</section>`);
  }

  // ---------- sobre ----------
  const aboutSec = about && (about.text || about.title) ? about : textSec ? { id: textSec.id, title: textSec.title, text: textSec.text } : null;
  if (aboutSec) {
    navItems.push({ id: aboutSec.id, label: "Sobre" });
    parts.push(`<section id="${esc(aboutSec.id)}" class="sec about${aboutImg ? "" : " no-media"}" aria-labelledby="h-about">
  ${aboutImg ? `<div class="about-media rv">${figure(aboutImg, "(max-width: 900px) 100vw, 46vw", "about-photo")}</div>` : ""}
  <div class="about-copy"><p class="kicker rv">Sobre</p><h2 id="h-about" class="h2 rv" style="--d:1">${esc(aboutSec.title || brand)}</h2><div class="prose rv" style="--d:2">${nl2p(aboutSec.text)}</div></div>
</section>`);
  }

  // ---------- números confirmados ----------
  const st = stats?.items.filter((i) => i.value.trim() && i.label.trim()) ?? [];
  if (stats && st.length) {
    parts.push(`<section id="${esc(stats.id)}" class="sec stats" aria-labelledby="h-stats"><h2 id="h-stats" class="kicker rv">${esc(stats.title)}</h2><dl class="nums">${st
      .map((i, n) => `<div class="rv" style="--d:${n + 1}"><dt><b>${esc(i.value)}</b>${i.unit ? `<small>${esc(i.unit)}</small>` : ""}</dt><dd>${esc(i.label)}${i.source ? `<span class="src">Fonte: ${esc(i.source)}</span>` : ""}</dd></div>`)
      .join("")}</dl></section>`);
  }

  // ---------- galeria (só fotos que ainda não apareceram) ----------
  const gimgs: Img[] = [];
  for (let n = 0; n < 6; n++) { const i = take(); if (i) gimgs.push(i); }
  if (gimgs.length >= 2) {
    navItems.push({ id: gallery?.id ?? "galeria", label: "Galeria" });
    parts.push(`<section id="${esc(gallery?.id ?? "galeria")}" class="sec" aria-labelledby="h-gal">
  <header class="sec-head"><p class="kicker rv">${esc(gallery?.title || "Galeria")}</p><h2 id="h-gal" class="h2 rv" style="--d:1">Um pouco do ambiente</h2></header>
  <div class="gallery g${Math.min(gimgs.length, 5)}">${gimgs.slice(0, 5).map((i, n) => `<div class="rv" style="--d:${n + 1}">${figure(i, n === 0 ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 900px) 50vw, 30vw", "g-item")}</div>`).join("")}</div>
</section>`);
  }

  // ---------- horários + localização e contato ----------
  const contacts = [
    wa && `<li><span>WhatsApp</span><a href="https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vim pelo site da ${b.name}.`)}" target="_blank" rel="noopener noreferrer">${esc(prettyPhone(wa))}</a></li>`,
    b.phone && `<li><span>Telefone</span><a href="${esc(telHref(b.phone))}">${esc(b.phone)}</a></li>`,
    b.email && `<li><span>E-mail</span><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
    b.instagram && `<li><span>Instagram</span><a href="${esc(safeUrl(b.instagram))}" target="_blank" rel="noopener noreferrer">${esc(b.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, ""))}</a></li>`,
  ].filter(Boolean);
  const contactId = contact?.id ?? "contato";
  navItems.push({ id: contactId, label: "Contato" });
  parts.push(`<section id="${esc(contactId)}" class="sec visit" aria-labelledby="h-visit">
  <header class="sec-head"><p class="kicker rv">${esc(contact?.title || "Contato e localização")}</p><h2 id="h-visit" class="h2 rv" style="--d:1">${esc(contact?.text || "Fale com a gente ou venha nos visitar")}</h2></header>
  <div class="visit-grid">
    ${hoursLines.length ? `<div class="panel rv" style="--d:1"><h3>${esc(hours!.title || "Horário de funcionamento")}</h3><dl class="hours">${hoursLines.map((l) => `<div><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`).join("")}</dl>${hours!.note ? `<p class="note">${esc(hours!.note)}</p>` : ""}</div>` : ""}
    <div class="panel rv" style="--d:2"><h3>Onde estamos</h3>${b.address ? `<p class="addr">${esc(b.address)}</p><a class="btn ghost sm" href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>` : `<p class="note">Endereço a confirmar com a empresa.</p>`}${contacts.length ? `<ul class="contacts">${contacts.join("")}</ul>` : ""}</div>
  </div>
</section>`);

  // ---------- chamada final ----------
  const finalBtn = cta?.button ?? (quote ? { label: quote.buttonLabel || "Pedir orçamento", action: wa ? ("whatsapp" as const) : b.phone ? ("phone" as const) : ("email" as const) } : mainBtn);
  const finalImg = take();
  if (finalBtn) {
    parts.push(`<section class="final${finalImg ? " has-photo" : ""}" aria-labelledby="h-final">
  ${finalImg ? `<div class="final-bg" aria-hidden="true">${picture(finalImg, "100vw")}</div>` : ""}
  <div class="final-copy"><h2 id="h-final" class="h2 rv">${esc(cta?.title || quote?.title || `Vamos conversar?`)}</h2>${cta?.text || quote?.text ? `<p class="lede rv" style="--d:1">${esc(cta?.text || quote?.text)}</p>` : ""}<div class="acts rv" style="--d:2">${button(finalBtn, c, "btn")}</div></div>
</section>`);
  }

  const nav = navItems.slice(0, 5).map((x) => `<a href="#${esc(x.id)}">${esc(x.label)}</a>`).join("");
  const shown = [heroImg, aboutImg, ...gimgs, finalImg].filter((x): x is Img => !!x);
  const credits = [...new Map(shown.map((i) => [i.src, i])).values()];
  const assetInfo = asset ? GLTF_ASSETS[asset] : null;
  const cfg = asset ? { gltfUrl: res(`${asset}/model.gltf`), hdrUrl: res("hdri/studio_small_09_1k.hdr"), dark: !ivory } : null;
  const ts = TITLE_SCALE[k.display] ?? 1;
  // Fontes de um peso só (ou já pesadas): negrito sintético deforma as letras.
  const dw = ["Anton", "Instrument Serif", "Archivo Black"].includes(k.display) ? 400 : 600;
  const up = k.caseStyle === "upper";

  return `<!doctype html>
<html lang="${esc(opts.lang ?? "pt-BR")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.seo.title || c.siteName)}</title>
<meta name="description" content="${esc(c.seo.description)}">
${opts.noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta name="theme-color" content="${P.bg}">
<meta name="color-scheme" content="${ivory ? "light" : "dark"}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref([k.display, k.body])}">
${heroImg && !asset ? `<link rel="preload" as="image" href="${esc(heroImg.src)}">` : ""}
<style>
:root{--bg:${P.bg};--bg2:${P.bg2};--ink:${P.ink};--mu:${P.muted};--ac:${P.accent};--ac2:${P.accent2};--fd:'${k.display}',Georgia,serif;--fb:'${k.body}',system-ui,sans-serif;--ts:${ts};--line:color-mix(in srgb,var(--ink) 13%,transparent);--card:color-mix(in srgb,var(--ink) ${ivory ? 4 : 5}%,var(--bg));--shadow:${ivory ? "0 24px 60px -30px rgba(40,30,20,.35)" : "0 30px 70px -35px rgba(0,0,0,.9)"};--r:${ivory ? "10px" : "16px"};--gut:clamp(16px,5vw,72px);color-scheme:${ivory ? "light" : "dark"}}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;scroll-padding-top:84px}
body{background:var(--bg);color:var(--ink);font:400 17px/1.65 var(--fb);-webkit-font-smoothing:antialiased;overflow-x:clip}
a{color:inherit}
img{display:block;max-width:100%;height:auto}
.ribbon{position:sticky;top:0;z-index:30;background:var(--ac);color:var(--bg);font:600 12px/1 var(--fb);text-align:center;padding:8px 12px;letter-spacing:.03em}
.skip{position:fixed;left:12px;top:-60px;z-index:50;padding:12px 16px;border-radius:10px;background:var(--ac);color:var(--bg);font-weight:600;text-decoration:none}.skip:focus{top:12px}
a:focus-visible,summary:focus-visible,button:focus-visible{outline:2px solid var(--ac);outline-offset:3px;border-radius:6px}
/* cabeçalho */
.top{position:sticky;top:${opts.previewRibbon ? "28px" : "0"};z-index:20;display:flex;align-items:center;gap:24px;padding:14px var(--gut);background:color-mix(in srgb,var(--bg) 84%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.brand{font:${up ? 700 : 600} 18px/1.1 var(--fd);letter-spacing:${up ? ".08em" : "-.01em"};text-transform:${up ? "uppercase" : "none"};text-decoration:none;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav{display:flex;gap:26px;margin-left:auto;font-size:15px;color:var(--mu)}
.nav a{text-decoration:none;padding:6px 0;border-bottom:1px solid transparent;transition:color .2s,border-color .2s}.nav a:hover{color:var(--ink);border-color:var(--ac)}
.top .btn{min-height:42px;padding:0 18px;font-size:14px}
.menu{display:none;margin-left:auto;position:relative}
.menu summary{list-style:none;cursor:pointer;min-height:44px;min-width:44px;display:flex;align-items:center;gap:8px;padding:0 14px;border:1px solid var(--line);border-radius:999px;font-weight:600;font-size:14px}
.menu summary::-webkit-details-marker{display:none}
.menu nav{position:absolute;right:0;top:calc(100% + 10px);min-width:230px;display:grid;padding:8px;border-radius:14px;background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow)}
.menu nav a{padding:14px 16px;text-decoration:none;font-size:16px;border-radius:10px}.menu nav a:hover{background:var(--card)}
/* botões */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 26px;border-radius:999px;background:var(--ac);color:var(--bg);font:600 16px/1 var(--fb);text-decoration:none;border:1px solid var(--ac);transition:transform .2s,box-shadow .2s,background .2s}
.btn:hover{transform:translateY(-1px);box-shadow:0 14px 34px -14px var(--ac)}
.btn.ghost{background:transparent;color:var(--ink);border-color:color-mix(in srgb,var(--ink) 30%,transparent)}
.btn.ghost:hover{border-color:var(--ink);box-shadow:none}
.btn.sm{min-height:44px;padding:0 18px;font-size:15px}
/* tipografia */
.eyebrow{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;font:600 13px/1.3 var(--fb);letter-spacing:.14em;text-transform:uppercase;color:var(--ac);margin-bottom:22px}
.eyebrow span{color:var(--mu);letter-spacing:.08em;font-weight:500}.eyebrow span::before{content:"";display:inline-block;width:22px;height:1px;background:var(--line);vertical-align:middle;margin-right:12px}
.h1{font:${dw} calc(clamp(40px,5.1vw,78px) * var(--ts))/1.02 var(--fd);letter-spacing:-.025em;text-wrap:balance;overflow-wrap:break-word}
.h2{font:${dw} calc(clamp(30px,3.4vw,50px) * var(--ts))/1.08 var(--fd);letter-spacing:-.02em;text-wrap:balance;overflow-wrap:break-word}
.kicker{display:flex;align-items:center;gap:12px;font:600 12.5px/1.3 var(--fb);letter-spacing:.18em;text-transform:uppercase;color:var(--ac);margin-bottom:16px}
.kicker::before{content:"";width:28px;height:1px;background:currentColor}
.lede{font-size:clamp(18px,1.45vw,21px);line-height:1.55;color:var(--mu);max-width:44ch;margin-top:22px;text-wrap:pretty}
.fullname{margin-top:12px;color:var(--mu);font-size:15px}
.prose{color:var(--mu);font-size:18px;max-width:60ch}.prose p+p{margin-top:14px}
/* abertura */
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:clamp(28px,5vw,80px);align-items:center;padding:clamp(40px,7vw,96px) var(--gut) clamp(48px,7vw,104px);max-width:1480px;margin:0 auto;min-height:min(86vh,860px)}
.hero.media-left .hero-copy{order:2}
.hero.no-media{grid-template-columns:1fr;max-width:980px;text-align:left}
.acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:18px 28px;margin-top:44px;padding-top:24px;border-top:1px solid var(--line)}
.facts dt{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mu)}.facts dd{font-weight:600;margin-top:4px;overflow-wrap:anywhere}
.hero-media{position:relative}
.hero-photo{position:relative;margin:0;aspect-ratio:5/4;max-height:76vh;border-radius:var(--r);overflow:hidden;background:var(--bg2);box-shadow:var(--shadow)}
.hero-photo img{width:100%;height:100%;object-fit:cover;animation:settle 1.6s cubic-bezier(.2,.7,.2,1) both}
@keyframes settle{from{transform:scale(1.06);opacity:.4}to{transform:none;opacity:1}}
figure figcaption{position:absolute;left:12px;right:12px;bottom:10px;font-size:11.5px;line-height:1.35;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.9)}
figure figcaption a{color:#fff}
.stage{position:relative;aspect-ratio:1/1;max-height:78vh;margin-left:auto;border-radius:var(--r);background:radial-gradient(70% 60% at 50% 42%,color-mix(in srgb,var(--ink) ${ivory ? 6 : 10}%,var(--bg2)),var(--bg2) 70%);overflow:hidden}
.stage canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1s}
.stage.is-ready canvas{opacity:1}
.stage-fallback{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .8s}
.stage.is-ready .stage-fallback,.stage.is-ready .stage-loading{opacity:0}
.stage-loading{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);font-size:12px;color:var(--mu);background:var(--bg);padding:6px 12px;border-radius:999px;transition:opacity .4s}
.stage:not(:has(.stage-fallback)) .stage-loading{bottom:50%}
.stage.is-failed .stage-loading{display:none}
/* seções */
.sec{max-width:1480px;margin:0 auto;padding:clamp(64px,8vw,120px) var(--gut)}
.sec-head{max-width:760px;margin-bottom:clamp(32px,4vw,56px)}
.cards{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(14px,1.6vw,22px)}
.card{position:relative;padding:28px 26px 30px;border-radius:var(--r);background:var(--card);border:1px solid var(--line);transition:border-color .25s,transform .25s}
.card:hover{border-color:color-mix(in srgb,var(--ac) 55%,transparent);transform:translateY(-2px)}
.card .num{display:block;font:500 14px/1 var(--fb);color:var(--ac);letter-spacing:.1em;margin-bottom:26px}
.card h3{font:${dw} calc(22px * var(--ts))/1.2 var(--fd);letter-spacing:-.01em;margin-bottom:10px}
.card p{color:var(--mu);font-size:16px}
.menu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:clamp(20px,3vw,48px)}
.menu-cat h3{font:${dw} calc(24px * var(--ts))/1.2 var(--fd);padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:6px}
.menu-cat ul{list-style:none}.menu-cat li{display:grid;grid-template-columns:1fr auto;gap:2px 16px;padding:12px 0;border-bottom:1px dashed var(--line)}
.mi-name{font-weight:600}.mi-price{color:var(--ac);font-weight:600;font-variant-numeric:tabular-nums}.mi-desc{grid-column:1/-1;color:var(--mu);font-size:15px}
.about{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,88px);align-items:center}
.about.no-media{grid-template-columns:1fr;max-width:980px}
.about-photo{position:relative;margin:0;aspect-ratio:4/3.2;border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);background:var(--bg2)}
.about-photo img{width:100%;height:100%;object-fit:cover}
.stats{padding-top:0}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:28px}
.nums b{font:${dw} clamp(44px,5vw,72px)/1 var(--fd)}.nums small{color:var(--ac);margin-left:6px;font-weight:600}.nums dd{color:var(--mu)}.src{display:block;font-size:12px;opacity:.75}
.gallery{display:grid;gap:clamp(10px,1.4vw,18px);grid-template-columns:repeat(6,1fr);grid-auto-rows:clamp(150px,17vw,260px)}
.gallery>div{grid-column:span 2}
.gallery.g2>div{grid-column:span 3;grid-row:span 2}
.gallery.g3>div:first-child{grid-column:span 4;grid-row:span 2}.gallery.g3>div:not(:first-child){grid-column:span 2}
.gallery.g4>div{grid-column:span 3;grid-row:span 1}
.gallery.g5>div:first-child{grid-column:span 4;grid-row:span 2}.gallery.g5>div:nth-child(n+4){grid-column:span 3}
.g-item{position:relative;margin:0;height:100%;border-radius:var(--r);overflow:hidden;background:var(--bg2)}
.g-item img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
.g-item:hover img{transform:scale(1.03)}
.visit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(14px,2vw,24px)}
.panel{padding:clamp(24px,3vw,36px);border-radius:var(--r);background:var(--card);border:1px solid var(--line)}
.panel h3{font:${dw} calc(22px * var(--ts))/1.2 var(--fd);margin-bottom:18px}
.hours div{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--line)}
.hours dt{color:var(--mu)}.hours dd{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.note{font-size:13.5px;color:var(--mu);margin-top:14px}
.addr{font-size:18px;margin-bottom:18px;max-width:40ch}
.contacts{list-style:none;display:grid;gap:0;margin-top:24px}
.contacts li{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}
.contacts span{color:var(--mu);font-size:14px}.contacts a{font-weight:600;text-decoration:none;text-align:right}.contacts a:hover{color:var(--ac)}
.final{position:relative;overflow:hidden;margin:0 auto clamp(48px,6vw,88px);max-width:calc(1480px - 2 * var(--gut));width:calc(100% - 2 * var(--gut));border-radius:calc(var(--r) + 4px);background:${ivory ? "var(--ink)" : "var(--bg2)"};color:${ivory ? "var(--bg)" : "var(--ink)"};padding:clamp(48px,7vw,104px) clamp(24px,6vw,88px);text-align:center}
.final-bg{position:absolute;inset:0}.final-bg img{width:100%;height:100%;object-fit:cover;opacity:.32;filter:saturate(.9)}
.final.has-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.6))}
.final.has-photo{color:#fff}.final.has-photo .lede{color:rgba(255,255,255,.86)}
.final-copy{position:relative;z-index:1;max-width:760px;margin:0 auto}
.final .lede{margin-inline:auto;color:inherit;opacity:.85}.final .acts{justify-content:center}
footer{padding:48px var(--gut) 56px;border-top:1px solid var(--line);color:var(--mu);font-size:13px;display:grid;gap:8px;max-width:1480px;margin:0 auto}
footer .f-brand{font:600 20px/1.2 var(--fd);color:var(--ink);margin-bottom:6px}
footer ul{list-style:none;display:grid;gap:4px}footer a{color:var(--mu)}
/* revelação discreta ao rolar */
.rv{opacity:0;transform:translateY(22px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--d,0) * 80ms)}
.rv.in,.no-js .rv{opacity:1;transform:none}
@media (max-width:980px){
  .nav,.top>.btn{display:none}.menu{display:block}
  .hero,.about{grid-template-columns:1fr}
  .hero{min-height:0;padding-top:28px;gap:28px}
  .hero .hero-media{order:-1}
  .hero.media-left .hero-copy{order:0}
  .hero-photo{aspect-ratio:4/3}
  .stage{aspect-ratio:1/1;max-height:62vh;width:100%}
  .about-media{order:-1}
}
@media (max-width:640px){
  body{font-size:16px}
  .brand{max-width:56vw;font-size:16px}
  .acts .btn{flex:1 1 100%}
  .facts{grid-template-columns:1fr 1fr}
  .gallery{grid-template-columns:repeat(2,1fr);grid-auto-rows:42vw}
  .gallery>div,.gallery.g2>div,.gallery.g3>div:not(:first-child),.gallery.g4>div,.gallery.g5>div:nth-child(n+4){grid-column:span 1;grid-row:span 1}
  .gallery>div:first-child,.gallery.g3>div:first-child,.gallery.g5>div:first-child{grid-column:1/-1;grid-row:span 1}
  .contacts li,.hours div{flex-direction:column;gap:2px}.contacts a,.hours dd{text-align:left}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.rv{opacity:1;transform:none;transition:none}.hero-photo img{animation:none}.card,.g-item img{transition:none}}
</style>
</head>
<body class="no-js">
${opts.previewRibbon ? `<div class="ribbon">${esc(opts.previewRibbon)}</div>` : ""}
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="top"><a class="brand" href="#${esc(hero?.id ?? "inicio")}">${esc(brand)}</a><nav class="nav" aria-label="Seções">${nav}</nav>${mainBtn ? button(mainBtn, c, "btn") : ""}<details class="menu"><summary>Menu</summary><nav aria-label="Seções">${nav}${mainBtn ? button(mainBtn, c, "") : ""}</nav></details></header>
<main id="conteudo">
${heroHtml}
${parts.join("\n")}
</main>
<footer>
  <p class="f-brand">${esc(brand)}</p>
  <p>${b.address ? esc(b.address) : ""}</p>
  ${credits.length ? `<ul>${credits.map((i) => `<li>${imageCaption(i, "span") || "Imagem: " + esc(i.alt)}</li>`).join("")}</ul>` : ""}
  ${credits.some((i) => i.origin === "stock") ? "<p>Fotos ilustrativas de bancos de imagens livres: não são fotos da empresa.</p>" : ""}
  ${assetInfo ? `<p>Modelo 3D escaneado de um objeto real: ${esc(assetInfo.label)}, por ${esc(assetInfo.authors)} (Poly Haven, CC0), <a href="${esc(assetInfo.url)}" target="_blank" rel="noopener noreferrer">fonte</a>. Ilustrativo, não é produto da empresa.</p>` : ""}
  <p>© ${new Date().getFullYear()} ${esc(b.name)}</p>
  ${opts.footerCredit ? `<p>Site criado com SiteHunter AI</p>` : ""}
</footer>
<script>(function(){document.body.classList.remove("no-js");var els=document.querySelectorAll(".rv");if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});}else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});els.forEach(function(e){io.observe(e)});}document.querySelectorAll(".menu nav a").forEach(function(a){a.addEventListener("click",function(){a.closest("details").removeAttribute("open")})});document.querySelectorAll("main img").forEach(function(i){function x(){var f=i.closest("figure,.gallery>div,.final-bg");if(f&&!i.classList.contains("stage-fallback"))f.remove()}if(i.complete&&i.naturalWidth===0&&i.currentSrc)x();else i.addEventListener("error",x)})})();</script>
${cfg ? `<script src="${esc(threeSrc)}" defer></script>
<script src="${esc(vendor("GLTFLoader.js"))}" defer></script>
<script src="${esc(vendor("RGBELoader.js"))}" defer></script>
<script>var __name=function(f){return f};window.addEventListener("DOMContentLoaded",function(){(${realRuntime.toString()})(${JSON.stringify(cfg).replace(/</g, "\\u003c")});});</script>` : ""}
</body>
</html>`;
}
