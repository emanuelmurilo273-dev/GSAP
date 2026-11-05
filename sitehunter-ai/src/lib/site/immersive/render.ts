import type { Concept, Section, SiteContent, SiteImage } from "../types";
import { button, esc, imageCaption, imgSrc, mapsHref, nl2p, safeUrl, telHref, waNumber, type RenderOpts } from "../render";
import { objectSvg, type ObjectKind } from "../stage";
import { buildConcept } from "./concept";
import { immersiveRuntime } from "./runtime";
import type { ModelKind } from "./kinds";

// Vitrine 3D: página escura em capítulos. Um canvas fixo (three.js) fica atrás do texto e o
// objeto do negócio muda de posição, ângulo e escala a cada capítulo. Textos e botões ficam em
// HTML comum (legíveis, indexáveis, acessíveis); o 3D é decoração (aria-hidden).

const FALLBACK: Record<ModelKind, ObjectKind> = {
  scissors: "scissors", razor: "scissors", pole: "scissors", comb: "hairdryer", hairdryer: "hairdryer", bottle: "hairdryer", polish: "hairdryer",
  tooth: "tooth", implant: "tooth", cup: "plate", bean: "plate", loaf: "bread", croissant: "bread", cake: "bread", plate: "plate", cloche: "plate", cutlery: "plate",
  pizza: "plate", burger: "plate", dumbbell: "dumbbell", kettlebell: "dumbbell", wheel: "wheel", wrench: "gear", gear: "gear", hanger: "tshirt", tshirt: "tshirt",
  bone: "paw", paw: "paw", key: "house", house: "house", pill: "cross", glasses: "gear",
};

/** Conceito salvo no conteúdo; sites antigos trocados para a Vitrine recebem um conceito derivado do que já existe. */
export function conceptOf(c: SiteContent): Concept {
  if (c.concept) return c.concept;
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
  Syne: ":wght@500;700;800", Unbounded: ":wght@400;600;800", Anton: "", "Bricolage Grotesque": ":opsz,wght@12..96,400;600;800", "Instrument Serif": ":ital@0;1",
  Fraunces: ":opsz,wght@9..144,400;600;800", "Cormorant Garamond": ":wght@500;600;700", "Space Grotesk": ":wght@400;500;700", "Archivo Black": "", Archivo: ":wght@400;600",
  Sora: ":wght@300;400;600;700", Inter: ":wght@400;500;600", Manrope: ":wght@400;500;700",
};
function fontsHref(fams: string[]) {
  return `https://fonts.googleapis.com/css2?${[...new Set(fams)].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}${FONT_W[f] ?? ":wght@400;700"}`).join("&")}&display=swap`;
}

type Ch = { id: string; side: "left" | "right" | "center"; cls?: string; html: string; nav?: string };

function sideFor(concept: Concept, i: number): Ch["side"] {
  if (concept.layout === "center") return i === 0 ? "center" : i % 2 ? "left" : "right";
  if (concept.layout === "editorial") return i % 2 ? "right" : "left";
  const first = concept.layout === "left" ? "left" : "right";
  return i % 2 ? (first === "left" ? "right" : "left") : first;
}

/** Comprimento da palavra mais longa: o título encolhe para caber sem cortar palavras. */
const longest = (t: string) => Math.max(4, ...t.split(/\s+/).map((w) => w.length));
/** "IBIO (Instituto Brasileiro ...)" → título "IBIO" e o nome completo em linha menor. */
function splitName(t: string): [string, string] {
  const m = t.match(/^(.{2,40}?)\s*\((.{6,})\)\s*$/);
  return m ? [m[1]!.trim(), m[2]!.trim()] : [t, ""];
}
const WIDE: Record<string, number> = { Unbounded: 1.08, "Archivo Black": 0.92, Syne: 0.9, Anton: 0.5, "Bricolage Grotesque": 0.6, "Instrument Serif": 0.46, Fraunces: 0.58, "Cormorant Garamond": 0.5, "Space Grotesk": 0.6, Sora: 0.62 };

function card(i: SiteImage, k: number, cls = ""): string {
  const src = imgSrc(i);
  if (!src) return "";
  return `<figure class="pcard ${cls}" data-depth style="--k:${k}"><img src="${esc(src)}" alt="${esc(i.alt)}" loading="lazy" decoding="async">${imageCaption(i)}</figure>`;
}

export function renderImmersive(c: SiteContent, opts: RenderOpts = {}): string {
  const k = conceptOf(c);
  const P = k.palette;
  const visible = c.sections.filter((s) => s.visible);
  const get = <T extends Section["type"]>(t: T) => visible.find((s) => s.type === t) as Extract<Section, { type: T }> | undefined;
  const hero = get("hero"), services = get("services"), products = get("products"), menu = get("menu"), about = get("about"), stats = get("stats"), gallery = get("gallery"), hours = get("hours"), cta = get("cta"), contact = get("contact");
  const b = c.business;
  const wa = waNumber(b.whatsapp);
  const chapters: Omit<Ch, "side">[] = [];

  // Capítulo 0: abertura com a palavra gigante atrás do objeto 3D
  const heroImg = hero?.image && hero.image.origin === "company" ? hero.image : undefined;
  chapters.push({
    id: hero?.id ?? "inicio",
    cls: "ch-hero",
    html: `<div class="bgclip" aria-hidden="true"><div class="bgword">${esc(k.heroWord)}</div></div>
      ${heroImg ? `<div class="hero-photo">${card(heroImg, 0, "pc-hero")}</div>` : ""}
      <div class="panel">
        ${k.kicker ? `<p class="kicker rv">${esc(k.kicker)}</p>` : ""}
        ${(() => { const [t, full] = splitName(hero?.title || c.siteName); return `<h1 class="display rv" style="--d:1;--L:${longest(t)}">${esc(t)}</h1>${full ? `<p class="fullname rv" style="--d:1">${esc(full)}</p>` : ""}`; })()}
        ${hero?.subtitle ? `<p class="lede rv" style="--d:2">${esc(hero.subtitle)}</p>` : ""}
        ${hero?.buttons.length ? `<div class="acts rv" style="--d:3">${hero.buttons.map((x, i) => button(x, c, i ? "btn ghost" : "btn")).join("")}</div>` : ""}
        ${k.highlights.length ? `<p class="badge rv" style="--d:4">${esc(k.highlights[0])}</p>` : ""}
      </div>
      <div class="cue" aria-hidden="true"><span></span>Role para explorar</div>`,
  });

  // Serviços / produtos / cardápio: um capítulo por item (o objeto gira entre eles)
  const items = services?.items.map((i) => ({ t: i.title, d: i.description }))
    ?? products?.items.map((i) => ({ t: i.name, d: i.description }))
    ?? menu?.categories.filter((cat) => cat.items.some((i) => i.name && !/^item do card/i.test(i.name))).map((cat) => ({ t: cat.name, d: cat.items.map((i) => i.name).slice(0, 4).join(" · ") }))
    ?? [];
  const sec = services ?? products ?? menu;
  items.slice(0, 4).forEach((it, i) => {
    chapters.push({
      id: i === 0 && sec ? sec.id : `${sec?.id ?? "servicos"}-${i + 1}`,
      nav: i === 0 && sec ? sec.title : undefined,
      html: `<div class="panel">
        ${i === 0 && sec ? `<p class="kicker rv">${esc(sec.title)}</p>` : ""}
        <span class="idx rv" aria-hidden="true">${String(i + 1).padStart(2, "0")}<small>/${String(Math.min(4, items.length)).padStart(2, "0")}</small></span>
        <h2 class="h2 rv" style="--d:1;--L:${longest(it.t)}">${esc(it.t)}</h2>
        <p class="body rv" style="--d:2">${esc(it.d)}</p>
      </div>`,
    });
  });

  // Sobre (com foto em profundidade quando houver)
  if (about && (about.text || about.title)) {
    const img = about.image ? card(about.image, 1, "pc-about") : "";
    chapters.push({
      id: about.id, nav: "Sobre",
      html: `<div class="panel">
        <p class="kicker rv">${esc(about.title)}</p>
        <div class="body big rv" style="--d:1">${nl2p(about.text)}</div>
        ${img ? `<div class="float-photo rv" style="--d:2">${img}</div>` : ""}
      </div>`,
    });
  }

  // Números confirmados
  const st = stats?.items.filter((i) => i.value.trim() && i.label.trim()) ?? [];
  if (stats && st.length) {
    chapters.push({
      id: stats.id,
      html: `<div class="panel"><p class="kicker rv">${esc(stats.title)}</p><dl class="nums">${st
        .map((i, n) => `<div class="rv" style="--d:${n + 1}"><dt><b data-count="${esc(i.value)}">${esc(i.value)}</b>${i.unit ? `<small>${esc(i.unit)}</small>` : ""}</dt><dd>${esc(i.label)}${i.source ? `<span class="src">Fonte: ${esc(i.source)}</span>` : ""}</dd></div>`)
        .join("")}</dl></div>`,
    });
  }

  // Galeria: cartões de foto em camadas que atravessam a cena
  // A foto de capa de banco (não da empresa) não cobre o objeto 3D: vai para a galeria.
  const gimgs = [...(hero?.image && !heroImg ? [hero.image] : []), ...(gallery?.images ?? [])].filter((i) => imgSrc(i));
  if (gimgs.length) {
    chapters.push({
      id: gallery?.id ?? "galeria", nav: "Galeria", cls: "ch-gallery",
      html: `<div class="panel narrow"><p class="kicker rv">${esc(gallery?.title || "Galeria")}</p></div><div class="stack">${gimgs.slice(0, 6).map((i, n) => card(i, n)).join("")}</div>`,
    });
  }

  // Horários publicados
  const lines = hours?.lines.filter((l) => l.value.trim()) ?? [];
  if (hours && lines.length) {
    chapters.push({
      id: hours.id, nav: "Horários",
      html: `<div class="panel"><p class="kicker rv">${esc(hours.title)}</p>${k.highlights[0] ? `<h2 class="h2 rv" style="--d:1;--L:${longest(k.highlights[0])}">${esc(k.highlights[0])}</h2>` : ""}<dl class="hours">${lines
        .map((l, n) => `<div class="rv" style="--d:${n + 2}"><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`)
        .join("")}</dl>${hours.note ? `<p class="note rv">${esc(hours.note)}</p>` : ""}</div>`,
    });
  }

  // Final: contato confirmado
  const contacts = [
    b.address && `<li><span>Endereço</span><a href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">${esc(b.address)}</a></li>`,
    wa && `<li><span>WhatsApp</span><a href="https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vim pelo site da ${b.name}.`)}" target="_blank" rel="noopener noreferrer">${esc(b.whatsapp)}</a></li>`,
    b.phone && `<li><span>Telefone</span><a href="${esc(telHref(b.phone))}">${esc(b.phone)}</a></li>`,
    b.email && `<li><span>E-mail</span><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
    b.instagram && `<li><span>Instagram</span><a href="${esc(safeUrl(b.instagram))}" target="_blank" rel="noopener noreferrer">${esc(b.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, ""))}</a></li>`,
  ].filter(Boolean);
  chapters.push({
    id: contact?.id ?? "contato", nav: "Contato", cls: "ch-final",
    html: `<div class="panel">
      <p class="kicker rv">${esc(contact?.title || "Contato")}</p>
      <h2 class="display sm rv" style="--d:1;--L:${longest(splitName(cta?.title || b.name)[0])}">${esc(splitName(cta?.title || b.name)[0])}</h2>
      ${cta?.text || contact?.text ? `<p class="lede rv" style="--d:2">${esc(cta?.text || contact?.text)}</p>` : ""}
      ${cta ? `<div class="acts rv" style="--d:3">${button(cta.button, c, "btn")}</div>` : ""}
      ${contacts.length ? `<ul class="contacts rv" style="--d:4">${contacts.join("")}</ul>` : ""}
    </div>`,
  });

  const all: Ch[] = chapters.map((ch, i) => ({ ...ch, side: sideFor(k, i) }));
  const nav = all.filter((x) => x.nav).slice(0, 4).map((x) => `<a href="#${esc(x.id)}">${esc(x.nav!)}</a>`).join("");
  const mainBtn = hero?.buttons[0];
  const fallbackArt = objectSvg(FALLBACK[k.model], P.accent, P.accent2, "fb");
  const credits = [heroImg, about?.image, ...gimgs].filter((i): i is SiteImage => !!i && !!imgSrc(i));
  const threeSrc = opts.threeSrc ?? "/vendor/three.min.js";
  const cfg = { model: k.model, secondary: k.secondary, material: k.material, motif: k.motif, choreo: k.choreo, pal: P, seed: k.seed };
  const up = k.caseStyle === "upper";
  const kw = (WIDE[k.display] ?? 0.6) * (up ? 1.12 : 1);

  return `<!doctype html>
<html lang="${esc(opts.lang ?? "pt-BR")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.seo.title || c.siteName)}</title>
<meta name="description" content="${esc(c.seo.description)}">
${opts.noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta name="theme-color" content="${P.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref([k.display, k.body])}">
<style>
:root{--kw:${kw.toFixed(2)};--pw:min(540px,44vw);--bg:${P.bg};--bg2:${P.bg2};--ink:${P.ink};--mu:${P.muted};--ac:${P.accent};--ac2:${P.accent2};--fd:'${k.display}',system-ui,sans-serif;--fb:'${k.body}',system-ui,sans-serif;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;overflow-x:clip}
body{overflow-x:clip;background:radial-gradient(120% 80% at 70% 0%,var(--bg2),var(--bg) 60%) fixed,var(--bg);color:var(--ink);font:400 17px/1.6 var(--fb);-webkit-font-smoothing:antialiased}
a{color:inherit}
img{display:block;max-width:100%}
#stage3d{position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}
.fallback{display:none}
.no3d .fallback{display:block;position:fixed;right:4vw;top:16vh;width:min(42vw,520px);z-index:1;opacity:.9;pointer-events:none}
.no3d #stage3d{display:none}
.ribbon{position:fixed;left:0;right:0;top:0;z-index:20;background:var(--ac);color:var(--bg);font:600 12px/1 var(--fb);text-align:center;padding:7px 10px;letter-spacing:.04em}
.top{position:fixed;left:0;right:0;top:${opts.previewRibbon ? "26px" : "0"};z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px clamp(16px,4vw,48px);background:linear-gradient(var(--bg),transparent)}
.brand{font:700 15px/1 var(--fd);letter-spacing:${up ? ".14em" : ".01em"};text-transform:${up ? "uppercase" : "none"};text-decoration:none;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.top nav{display:flex;gap:26px;font-size:14px;color:var(--mu)}
.top nav a{text-decoration:none}.top nav a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:999px;background:var(--ac);color:var(--bg);font:600 15px/1 var(--fb);text-decoration:none;border:1px solid var(--ac);transition:transform .25s,box-shadow .25s;box-shadow:0 10px 40px -12px var(--ac)}
.btn:hover{transform:translateY(-2px)}
.btn.ghost{background:transparent;color:var(--ink);border-color:color-mix(in srgb,var(--ink) 30%,transparent);box-shadow:none}
.top .btn{min-height:40px;padding:0 18px;font-size:14px}
main{position:relative}
.ch{position:relative;min-height:150vh;display:flex;align-items:flex-start;padding:0 clamp(16px,6vw,96px)}
.ch .panel{position:sticky;top:max(96px,24vh);z-index:3;max-width:min(540px,44vw);padding-bottom:10vh}
.ch[data-side=right]{justify-content:flex-end}
.ch[data-side=center]{justify-content:center;text-align:center}
.ch[data-side=center] .panel{max-width:min(760px,92vw)}
.ch[data-side=center] .acts{justify-content:center}
.ch::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none}
.ch[data-side=left]::before{background:linear-gradient(90deg,color-mix(in srgb,var(--bg) 78%,transparent),transparent 58%)}
.ch[data-side=right]::before{background:linear-gradient(270deg,color-mix(in srgb,var(--bg) 78%,transparent),transparent 58%)}
.ch-hero{min-height:130vh}
.ch-hero .panel{top:max(110px,22vh)}
.ch-hero[data-side=center] .panel{top:max(96px,13vh)}
.bgclip{position:absolute;inset:0 0 auto 0;height:100vh;overflow:hidden;z-index:0;pointer-events:none}
.bgword{position:absolute;z-index:0;left:50%;top:50%;transform:translate(-50%,-56%);font:800 clamp(90px,21vw,360px)/.85 var(--fd);letter-spacing:-.04em;white-space:nowrap;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--ink) 22%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 16%,transparent),transparent 80%);-webkit-background-clip:text;background-clip:text;pointer-events:none;user-select:none}
.kicker{font:600 12px/1.3 var(--fb);letter-spacing:.22em;text-transform:uppercase;color:var(--ac);margin-bottom:18px}
.display{font:${up ? 800 : 600} min(clamp(44px,7.4vw,112px),calc(var(--pw) / (var(--L,8) * var(--kw))))/.92 var(--fd);letter-spacing:${up ? "-.01em" : "-.035em"};text-transform:${up ? "uppercase" : "none"};text-wrap:balance}
.display.sm{font-size:min(clamp(38px,5.6vw,84px),calc(var(--pw) / (var(--L,8) * var(--kw))))}
.fullname{margin-top:12px;font-size:14px;letter-spacing:.06em;color:var(--mu);max-width:40ch}
.ch[data-side=center]{--pw:min(760px,90vw)}
.h2{font:${up ? 800 : 600} min(clamp(34px,4.6vw,68px),calc(var(--pw) / (var(--L,8) * var(--kw))))/1 var(--fd);letter-spacing:${up ? "0" : "-.03em"};text-transform:${up ? "uppercase" : "none"};text-wrap:balance;margin-bottom:18px}
.lede{font-size:clamp(17px,1.5vw,21px);color:var(--mu);margin-top:22px;max-width:46ch}
.ch[data-side=center] .lede{margin-inline:auto}
.body{color:var(--mu);font-size:clamp(16px,1.3vw,19px);max-width:44ch}
.body.big{font-size:clamp(19px,1.8vw,26px);line-height:1.45;color:var(--ink)}
.body p+p{margin-top:12px}
.acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.badge{display:inline-block;margin-top:26px;padding:8px 14px;border:1px solid color-mix(in srgb,var(--ac) 50%,transparent);border-radius:999px;font-size:13px;color:var(--ac)}
.idx{display:block;font:500 clamp(64px,9vw,140px)/.8 var(--fd);color:transparent;-webkit-text-stroke:1px var(--ac);margin-bottom:22px}
.idx small{font-size:.22em;-webkit-text-stroke:0;color:var(--mu);margin-left:8px;vertical-align:top}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:26px;margin-top:10px}
.nums b{font:700 clamp(52px,6vw,88px)/1 var(--fd);color:var(--ink)}.nums small{color:var(--ac);margin-left:4px;font-weight:600}
.nums dd{color:var(--mu);font-size:15px}.src{display:block;font-size:12px;opacity:.7}
.hours{display:grid;gap:2px;margin-top:8px;max-width:440px}
.hours div{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 12%,transparent)}
.hours dt{color:var(--mu)}.hours dd{font-weight:600;font-variant-numeric:tabular-nums}
.note{font-size:13px;color:var(--mu);margin-top:16px}
.contacts{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:40px;text-align:left}
.contacts li{display:flex;flex-direction:column;gap:4px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--ink) 12%,transparent);border-radius:18px;background:color-mix(in srgb,var(--bg) 70%,transparent);overflow-wrap:anywhere}
.contacts span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--mu)}
.contacts a{text-decoration:none;font-weight:600}
.ch-final{min-height:120vh}
.cue{position:absolute;z-index:3;left:50%;top:calc(100vh - 110px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--mu)}
.cue span{width:1px;height:46px;background:linear-gradient(var(--ac),transparent);animation:cue 2.2s infinite}
@keyframes cue{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
.pcard{position:relative;border-radius:22px;overflow:hidden;background:var(--bg2);box-shadow:0 40px 80px -30px rgba(0,0,0,.8),0 0 0 1px color-mix(in srgb,var(--ink) 10%,transparent)}
.pcard img{width:100%;height:100%;object-fit:cover}
.pcard figcaption{position:absolute;left:10px;right:10px;bottom:8px;font-size:11px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9)}
.pcard figcaption a{color:#fff}
.float-photo{position:relative;width:min(100%,380px);aspect-ratio:4/3;margin-top:30px;perspective:1200px}
.float-photo .pcard{height:100%;transform:rotateY(calc((var(--p,.5) - .5) * -26deg)) translateZ(calc(var(--p,.5) * 60px)) translateY(calc((.5 - var(--p,.5)) * 60px))}
.hero-photo{position:absolute;z-index:0;right:6vw;top:18vh;width:min(26vw,320px);aspect-ratio:3/4;opacity:.55}
.hero-photo .pcard{height:100%}
.ch-gallery{flex-direction:column;align-items:stretch;gap:6vh;min-height:auto;padding-top:14vh;padding-bottom:14vh}
.ch-gallery .panel{position:relative;top:0;padding:0}
.stack{position:relative;z-index:3;display:grid;grid-template-columns:repeat(3,1fr);gap:22px;perspective:1400px}
.stack .pcard{aspect-ratio:4/5;transform:translate3d(0,calc((.5 - var(--p,.5)) * (60px + var(--k) * 26px)),calc(var(--p,.5) * 80px - var(--k) * 20px)) rotateX(calc((var(--p,.5) - .5) * 14deg)) rotateY(calc((var(--k) - 1) * -7deg))}
.rv{opacity:0;transform:translateY(34px);filter:blur(8px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1),filter .9s;transition-delay:calc(var(--d,0) * 90ms)}
.in .rv{opacity:1;transform:none;filter:none}
footer{position:relative;z-index:3;padding:48px clamp(16px,6vw,96px) 64px;border-top:1px solid color-mix(in srgb,var(--ink) 10%,transparent);background:var(--bg);color:var(--mu);font-size:13px;display:grid;gap:10px}
footer ul{list-style:none;display:grid;gap:4px}
footer a{color:var(--mu)}
@media (max-width:760px){
  body{font-size:16px}
  .top nav{display:none}
  .ch,.ch[data-side=right],.ch[data-side=left]{justify-content:flex-start;align-items:flex-end;min-height:140svh;padding:0 18px 7svh}
  .ch .panel{max-width:100%;top:auto;bottom:6svh;padding-bottom:0}
  .ch-hero{min-height:120svh}.ch-hero .panel,.ch-hero[data-side=center] .panel{top:auto}
  .cue{display:none}
  .ch::before,.ch[data-side=left]::before,.ch[data-side=right]::before{background:linear-gradient(180deg,transparent 30%,color-mix(in srgb,var(--bg) 88%,transparent) 62%)}
  .ch[data-side=center]{text-align:left}.ch[data-side=center] .acts{justify-content:flex-start}
  .bgclip{height:100svh}.bgword{top:30%;font-size:28vw}
  :root,.ch[data-side=center]{--pw:calc(100vw - 36px)}
  .display{font-size:min(clamp(40px,12vw,64px),calc(var(--pw) / (var(--L,8) * var(--kw))))}
  .h2{font-size:min(clamp(30px,9vw,44px),calc(var(--pw) / (var(--L,8) * var(--kw))))}
  .idx{font-size:72px}
  .float-photo{max-width:300px;aspect-ratio:16/10;margin-top:20px}
  .hero-photo{display:none}
  .stack{grid-template-columns:repeat(2,1fr);gap:12px}
  .ch-gallery{padding-top:16svh;min-height:auto}
  .btn{min-height:50px}
  .acts .btn{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .rv{transition:opacity .4s;transform:none;filter:none}
  .cue span{animation:none}
  .float-photo .pcard,.stack .pcard{transform:none}
}
</style>
</head>
<body>
${opts.previewRibbon ? `<div class="ribbon">${esc(opts.previewRibbon)}</div>` : ""}
<header class="top"><a class="brand" href="#${esc(all[0]!.id)}">${esc(splitName(c.siteName || b.name)[0])}</a><nav>${nav}</nav>${mainBtn ? button(mainBtn, c, "btn") : ""}</header>
<canvas id="stage3d" aria-hidden="true"></canvas>
<div class="fallback" aria-hidden="true">${fallbackArt}</div>
<main>
${all.map((ch, i) => `<section id="${esc(ch.id)}" class="ch ${ch.cls ?? ""}" data-ch="${i}" data-side="${ch.side}">${ch.html}</section>`).join("\n")}
</main>
<footer>
  <p>© ${new Date().getFullYear()} ${esc(b.name)}${b.address ? ` · ${esc(b.address)}` : ""}</p>
  ${credits.length ? `<ul>${credits.map((i) => `<li>${imageCaption(i, "span") || "Imagem: " + esc(i.alt)}</li>`).join("")}</ul>` : ""}
  <p>Objeto 3D ilustrativo, criado para esta prévia (não é foto de produto da empresa).</p>
  ${opts.footerCredit ? `<p>Site criado com SiteHunter AI</p>` : ""}
</footer>
<script src="${esc(threeSrc)}" defer></script>
<script>var __name=function(f){return f};window.addEventListener("DOMContentLoaded",function(){(${immersiveRuntime.toString()})(${JSON.stringify(cfg).replace(/</g, "\\u003c")});});</script>
</body>
</html>`;
}
