import type { Concept, Section, SiteContent, SiteImage } from "../types";
import { button, esc, imageCaption, imgSrc, mapsHref, nl2p, safeUrl, telHref, waNumber, type RenderOpts } from "../render";
import { objectSvg, type ObjectKind } from "../stage";
import { buildConcept, withMood } from "./concept";
import { immersiveRuntime } from "./runtime";
import { DISHES, GLTF_ASSETS, type ModelKind } from "./kinds";

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
  Syne: ":wght@500;700;800", Unbounded: ":wght@400;600;800", Anton: "", "Bricolage Grotesque": ":opsz,wght@12..96,400;600;800", "Instrument Serif": ":ital@0;1",
  Fraunces: ":opsz,wght@9..144,400;600;800", "Cormorant Garamond": ":wght@500;600;700", "Space Grotesk": ":wght@400;500;700", "Archivo Black": "", Archivo: ":wght@400;600",
  Sora: ":wght@300;400;600;700", Inter: ":wght@400;500;600", Manrope: ":wght@400;500;700",
};
function fontsHref(fams: string[]) {
  return `https://fonts.googleapis.com/css2?${[...new Set(fams)].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}${FONT_W[f] ?? ":wght@400;700"}`).join("&")}&display=swap`;
}

type Ch = { id: string; side: "left" | "right" | "center"; cls?: string; html: string; nav?: string; hide?: boolean };

function sideFor(concept: Concept, i: number): Ch["side"] {
  if (concept.layout === "center") return i === 0 ? "center" : i % 2 ? "left" : "right";
  if (concept.layout === "editorial") return i % 2 ? "right" : "left";
  const first = concept.layout === "left" ? "left" : "right";
  return i % 2 ? (first === "left" ? "right" : "left") : first;
}

const prettyPhone = (n: string) => { const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${n}`; };

/** Comprimento da palavra mais longa: o título encolhe para caber sem cortar palavras. */
const longest = (t: string) => Math.max(4, ...t.split(/\s+/).map((w) => w.length));
/** "IBIO (Instituto Brasileiro ...)" → título "IBIO" e o nome completo em linha menor. */
function splitName(t: string): [string, string] {
  const m = t.match(/^(.{2,40}?)\s*\((.{6,})\)\s*$/);
  if (m) return [m[1]!.trim(), m[2]!.trim()];
  // "Nome - complemento" (ex.: "É da Pam - Restaurante e Café Colonial", "Dra. Cleo - CRO 170844 SP")
  const d = t.match(/^(.{3,40}?)\s+[-–—|]\s+(.{4,})$/);
  return d ? [d[1]!.trim(), d[2]!.trim()] : [t, ""];
}
const WIDE: Record<string, number> = { Unbounded: 1.15, "Archivo Black": 1.0, Syne: 1.12, Anton: 0.5, "Bricolage Grotesque": 0.6, "Instrument Serif": 0.46, Fraunces: 0.58, "Cormorant Garamond": 0.5, "Space Grotesk": 0.6, Sora: 0.62 };

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

  const heroImg = hero?.image && hero.image.origin === "company" ? hero.image : undefined;
  // Abertura editorial (referência do site imobiliário): foto ampla, texto grande sobreposto e legível.
  const firstImg = [hero?.image, ...(gallery?.images ?? []), about?.image].find((i): i is SiteImage => !!i && !!imgSrc(i));
  const photoHero = k.heroMode === "photo" ? heroImg ?? firstImg : undefined;
  const [heroTitle, heroFull] = splitName(hero?.title || c.siteName);
  const heroText = `
        ${k.kicker ? `<p class="kicker rv">${esc(k.kicker)}</p>` : ""}
        <h1 class="display rv" style="--d:1;--L:${longest(heroTitle)}">${esc(heroTitle)}</h1>${heroFull ? `<p class="fullname rv" style="--d:1">${esc(heroFull)}</p>` : ""}
        ${hero?.subtitle ? `<p class="lede rv" style="--d:2">${esc(hero.subtitle)}</p>` : ""}
        ${hero?.buttons.length ? `<div class="acts rv" style="--d:3">${hero.buttons.map((x, i) => button(x, c, i ? "btn ghost" : "btn")).join("")}</div>` : ""}
        ${k.highlights.length ? `<p class="badge rv" style="--d:4">${esc(k.highlights[0])}</p>` : ""}`;
  if (photoHero) {
    chapters.push({
      id: hero?.id ?? "inicio",
      cls: "ch-hero ch-photo",
      hide: true,
      html: `<figure class="bleed" data-depth><img src="${esc(imgSrc(photoHero)!)}" alt="${esc(photoHero.alt)}" fetchpriority="high" decoding="async">${imageCaption(photoHero, "figcaption", "bleed-cap")}</figure>
      <div class="panel">${heroText}</div>
      <div class="frame-meta" aria-hidden="true"><span>${esc((b.address.split("·")[0] ?? "").trim())}</span><span class="cue-in"><i></i>Role para explorar</span></div>`,
    });
  } else {
    chapters.push({
      id: hero?.id ?? "inicio",
      cls: "ch-hero",
      html: `<div class="bgclip" aria-hidden="true"><div class="bgword">${esc(k.heroWord)}</div></div>
      ${heroImg ? `<div class="hero-photo">${card(heroImg, 0, "pc-hero")}</div>` : ""}
      <div class="panel">${heroText}</div>
      <div class="cue" aria-hidden="true"><span></span>Role para explorar</div>`,
    });
  }

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

  // Sobre: faixa de foto ampla com texto sobreposto (editorial) ou texto com foto em profundidade.
  if (about && (about.text || about.title)) {
    const aImg = about.image && imgSrc(about.image) && about.image !== photoHero ? about.image : undefined;
    const band = !!aImg && (k.heroMode === "photo" || k.seed % 3 !== 0);
    chapters.push(band ? {
      id: about.id, nav: "Sobre", cls: "ch-band", hide: true,
      html: `<figure class="bleed" data-depth><img src="${esc(imgSrc(aImg!)!)}" alt="${esc(aImg!.alt)}" loading="lazy" decoding="async">${imageCaption(aImg!, "figcaption", "bleed-cap")}</figure>
      <div class="panel"><p class="kicker rv">${esc(about.title)}</p><div class="body big rv" style="--d:1">${nl2p(about.text)}</div></div>`,
    } : {
      id: about.id, nav: "Sobre",
      html: `<div class="panel">
        <p class="kicker rv">${esc(about.title)}</p>
        <div class="body big rv" style="--d:1">${nl2p(about.text)}</div>
        ${aImg ? `<div class="float-photo rv" style="--d:2">${card(aImg, 1, "pc-about")}</div>` : ""}
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
  const gimgs = [...(hero?.image && !heroImg ? [hero.image] : []), ...(gallery?.images ?? [])].filter((i) => imgSrc(i) && i !== photoHero && i.url !== photoHero?.url);
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
    wa && `<li><span>WhatsApp</span><a href="https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vim pelo site da ${b.name}.`)}" target="_blank" rel="noopener noreferrer">${esc(prettyPhone(wa))}</a></li>`,
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

  const all: Ch[] = chapters.map((ch, i) => ({ ...ch, side: ch.cls?.includes("ch-photo") ? "center" : ch.hide ? (i === 0 ? "left" : sideFor(k, i) === "center" ? "left" : sideFor(k, i)) : sideFor(k, i) }));
  const nav = all.filter((x) => x.nav).slice(0, 4).map((x) => `<a href="#${esc(x.id)}">${esc(x.nav!)}</a>`).join("");
  const mainBtn = hero?.buttons[0];
  const fallbackArt = objectSvg(FALLBACK[k.model], P.accent, P.accent2, "fb");
  const credits = [photoHero ?? heroImg, about?.image, ...gimgs].filter((i): i is SiteImage => !!i && !!imgSrc(i));
  const threeSrc = opts.threeSrc ?? "/vendor/three.min.js";
  // Recursos reais (modelos CC0 e fotos de pratos): mesma origem do three.js.
  const base = opts.assetBase ?? threeSrc.replace(/vendor\/three\.min\.js$/, "models/");
  const res = (path: string) => (opts.assetUrl ? opts.assetUrl(path) : base + path);
  const dish = k.dish && DISHES[k.dish] ? DISHES[k.dish] : null;
  const gltf = k.asset && GLTF_ASSETS[k.asset] ? k.asset : null;
  // Objetos secundários com modelo real disponível (croissant, chave).
  const SEC_GLTF: Record<string, string> = { croissant: "croissant", wrench: "combination_wrench" };
  const secGltf = Object.fromEntries(k.secondary.filter((x) => SEC_GLTF[x]).map((x) => [x, res(`${SEC_GLTF[x]}/model.gltf`)]));
  const wantsWrench = k.secondary.includes("wrench");
  const assets = {
    dishUrl: dish ? res(`dishes/${dish.file}`) : null, dishKind: dish ? k.dish : null, plate: dish?.plate ?? null,
    gltfUrl: gltf ? res(`${gltf}/model.gltf`) : null, secGltf,
  };
  const loaderSrc = threeSrc.replace(/three\.min\.js$/, "GLTFLoader.js");
  const cfg = { model: k.model, secondary: k.secondary, material: k.material, motif: k.motif, choreo: k.choreo, pal: P, seed: k.seed, assets };
  const credits3d = [
    dish && `Superfície do ${dish.label} em 3D: foto de ${dish.credit} (${dish.license}), <a href="${esc(dish.source)}" target="_blank" rel="noopener noreferrer">fonte</a>. Imagem ilustrativa, não é prato da empresa.`,
    gltf && `Modelo 3D: ${GLTF_ASSETS[gltf]!.label}, por ${GLTF_ASSETS[gltf]!.authors} (Poly Haven, CC0), <a href="${esc(GLTF_ASSETS[gltf]!.url)}" target="_blank" rel="noopener noreferrer">fonte</a>.`,
    wantsWrench && `Modelo 3D da chave: ${GLTF_ASSETS.combination_wrench!.authors} (Poly Haven, CC0).`,
    k.secondary.includes("croissant") && gltf !== "croissant" && `Modelo 3D do croissant: ${GLTF_ASSETS.croissant!.authors} (Poly Haven, CC0).`,
  ].filter(Boolean);
  const up = k.caseStyle === "upper";
  const ivory = k.mood === "ivory";
  const kw = (WIDE[k.display] ?? 0.66) * (up ? 1.12 : 1);

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
<style>
:root{--kw:${kw.toFixed(2)};--pw:min(540px,44vw);--bg:${P.bg};--bg2:${P.bg2};--ink:${P.ink};--mu:${P.muted};--ac:${P.accent};--ac2:${P.accent2};--fd:'${k.display}',system-ui,sans-serif;--fb:'${k.body}',system-ui,sans-serif;--line:color-mix(in srgb,var(--ink) 14%,transparent);--shadow:${ivory ? "0 30px 60px -28px rgba(40,30,20,.35)" : "0 40px 80px -30px rgba(0,0,0,.85)"};color-scheme:${ivory ? "light" : "dark"}}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;overflow-x:clip}
body{overflow-x:clip;background:${ivory ? "radial-gradient(90% 60% at 80% 10%,var(--bg2),var(--bg) 70%) fixed" : "radial-gradient(120% 80% at 70% 0%,var(--bg2),var(--bg) 60%) fixed"},var(--bg);color:var(--ink);font:400 17px/1.6 var(--fb);-webkit-font-smoothing:antialiased}
a{color:inherit}
img{display:block;max-width:100%}
#stage3d{position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}
.fallback{display:none}
.no3d .fallback{display:block;position:fixed;right:4vw;top:16vh;width:min(42vw,520px);z-index:1;opacity:.9;pointer-events:none}
.no3d #stage3d{display:none}
.ribbon{position:fixed;left:0;right:0;top:0;z-index:20;background:var(--ac);color:var(--bg);font:600 12px/1 var(--fb);text-align:center;padding:7px 10px;letter-spacing:.04em}
.top{position:fixed;left:0;right:0;top:${opts.previewRibbon ? "26px" : "0"};z-index:10;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;padding:16px clamp(16px,4vw,48px);transition:background .4s,backdrop-filter .4s,border-color .4s,padding .4s;border-bottom:1px solid transparent}
.top.solid{background:color-mix(in srgb,var(--bg) 74%,transparent);-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2);border-bottom-color:var(--line);padding-block:11px}
.top.over-photo:not(.solid){--ink:#f7f3ee;--mu:rgba(247,243,238,.85);color:var(--ink);text-shadow:0 1px 14px rgba(0,0,0,.55);background:linear-gradient(rgba(0,0,0,.45),transparent)}
.top.over-photo:not(.solid) .menu summary{border-color:rgba(247,243,238,.45)}
.brand{grid-column:2;justify-self:center;font:${up ? 700 : 600} 16px/1 var(--fd);letter-spacing:${up ? ".32em" : ".04em"};text-transform:${up ? "uppercase" : "none"};text-decoration:none;max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:${up ? ".32em" : "0"}}
.nav-l{grid-column:1;display:flex;gap:28px;font:500 11.5px/1 var(--fb);letter-spacing:.18em;text-transform:uppercase;color:var(--mu)}
.nav-l a{text-decoration:none;padding:8px 0;transition:color .25s}.nav-l a:hover{color:var(--ink)}
.top-r{grid-column:3;justify-self:end;display:flex;align-items:center;gap:10px}
.menu{display:none;position:relative}
.menu summary{list-style:none;cursor:pointer;min-height:44px;display:flex;align-items:center;padding:0 14px;border:1px solid var(--line);border-radius:999px;font:500 12px/1 var(--fb);letter-spacing:.16em;text-transform:uppercase}
.menu summary::-webkit-details-marker{display:none}
.menu nav{position:absolute;right:0;top:calc(100% + 10px);min-width:220px;display:grid;padding:8px;border-radius:18px;background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow)}
.menu nav a{padding:14px 16px;text-decoration:none;font-size:16px;border-radius:12px}.menu nav a:hover{background:var(--bg2)}
.skip{position:fixed;left:12px;top:-60px;z-index:50;padding:12px 16px;border-radius:10px;background:var(--ac);color:var(--bg);font-weight:600;text-decoration:none;transition:top .2s}.skip:focus{top:12px}
a:focus-visible,summary:focus-visible,button:focus-visible{outline:2px solid var(--ac);outline-offset:3px;border-radius:8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:999px;background:var(--ac);color:var(--bg);font:600 15px/1 var(--fb);text-decoration:none;border:1px solid var(--ac);transition:transform .25s,box-shadow .25s;box-shadow:0 10px 40px -12px var(--ac)}
.btn:hover{transform:translateY(-2px)}
.btn.ghost{background:transparent;color:var(--ink);border-color:color-mix(in srgb,var(--ink) 30%,transparent);box-shadow:none}
.top .btn{min-height:40px;padding:0 18px;font-size:14px}
main{position:relative}
.ch{position:relative;min-height:150vh;display:flex;align-items:flex-start;padding:0 clamp(16px,6vw,96px)}
.ch .panel{overflow-wrap:break-word;position:sticky;top:max(96px,24vh);z-index:3;max-width:min(540px,44vw);padding-bottom:10vh}
.ch[data-side=right]{justify-content:flex-end}
.ch[data-side=center]{justify-content:center;text-align:center}
.ch[data-side=center] .panel{max-width:min(760px,92vw)}
.ch[data-side=center] .acts{justify-content:center}
.ch::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none}
.ch[data-side=left]::before{background:linear-gradient(90deg,color-mix(in srgb,var(--bg) 90%,transparent) 0%,color-mix(in srgb,var(--bg) 70%,transparent) 38%,transparent 62%)}
.ch[data-side=right]::before{background:linear-gradient(270deg,color-mix(in srgb,var(--bg) 90%,transparent) 0%,color-mix(in srgb,var(--bg) 70%,transparent) 38%,transparent 62%)}
.ch-hero{min-height:130vh}
.ch-hero .panel{top:max(110px,22vh)}
.ch-hero[data-side=center] .panel{top:max(96px,13vh)}
.bleed{position:absolute;inset:0;margin:0;overflow:hidden;z-index:2;background:var(--bg2)}
.bleed img{width:100%;height:100%;object-fit:cover;transform:translateY(calc((var(--p,.5) - .5) * -8%)) scale(1.12);will-change:transform}
.bleed::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--bg) 88%,transparent) 0%,color-mix(in srgb,var(--bg) 55%,transparent) 42%,transparent 75%),linear-gradient(0deg,var(--bg) 0%,transparent 35%,transparent 80%,color-mix(in srgb,var(--bg) 60%,transparent) 100%)}
.bleed-cap{position:absolute;right:16px;bottom:12px;z-index:3;max-width:60%;font-size:11px;color:rgba(255,255,255,.75);text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.8)}
.bleed-cap a{color:inherit}
.ch-photo,.ch-band{min-height:112vh}
.ch.ch-photo{--ink:#f7f3ee;--mu:rgba(247,243,238,.82);--pw:min(1100px,90vw);color:var(--ink);align-items:center;min-height:100svh}
.ch.ch-photo .panel{position:relative;top:auto;max-width:min(980px,92vw);padding:18vh 0 14vh}
.ch-photo .bleed img{scale:1.12;animation:kb 3.2s cubic-bezier(.2,.7,.2,1) both}
@keyframes kb{from{scale:1.26;filter:brightness(.55) saturate(.8)}to{scale:1.12;filter:none}}
.ch-photo .bleed::after,.ch[data-side=right].ch-photo .bleed::after{background:radial-gradient(70% 55% at 50% 48%,rgba(0,0,0,.5) 0%,rgba(0,0,0,.42) 55%,rgba(0,0,0,.8) 100%),linear-gradient(0deg,${ivory ? "rgba(0,0,0,.72)" : "var(--bg)"} 0%,transparent 26%,transparent 82%,rgba(0,0,0,.55) 100%)}
.ch-photo .display{font-size:min(clamp(52px,9vw,148px),calc(var(--pw) / (var(--L,8) * var(--kw))));letter-spacing:${up ? ".04em" : "-.03em"};text-shadow:0 4px 40px rgba(0,0,0,.45)}
.ch-photo .lede{color:var(--mu);margin-inline:auto;text-shadow:0 1px 18px rgba(0,0,0,.6)}
.ch-photo .kicker{color:#f7f3ee;text-shadow:0 1px 12px rgba(0,0,0,.6)}
.ch-photo .fullname{color:var(--mu)}
.ch-photo .btn.ghost{color:#f7f3ee;border-color:rgba(247,243,238,.45);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ch-photo .badge{color:#f7f3ee;border-color:rgba(247,243,238,.35)}
.ch-photo .bleed-cap{bottom:auto;top:${opts.previewRibbon ? "96px" : "76px"}}
.frame-meta{position:absolute;z-index:4;left:clamp(16px,6vw,96px);right:clamp(16px,6vw,96px);bottom:28px;display:flex;justify-content:space-between;gap:20px;font:500 11px/1.4 var(--fb);letter-spacing:.2em;text-transform:uppercase;color:rgba(247,243,238,.7)}
.cue-in{display:flex;align-items:center;gap:12px}.cue-in i{width:42px;height:1px;background:rgba(247,243,238,.7);transform-origin:left;animation:cuex 2.4s infinite}
@keyframes cuex{0%{transform:scaleX(0)}50%{transform:scaleX(1)}100%{transform:scaleX(0);transform-origin:right}}
.ch-photo .panel,.ch-band .panel{z-index:4}
.ch-photo .display{text-shadow:0 2px 30px rgba(0,0,0,.35)}
.ch-band{align-items:center}.ch-band .panel{position:relative;top:auto;margin:22vh 0;padding:clamp(22px,3vw,36px);border-radius:22px;background:color-mix(in srgb,var(--bg) 66%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid color-mix(in srgb,var(--ink) 10%,transparent)}
.ch[data-side=right] .bleed::after{background:linear-gradient(270deg,color-mix(in srgb,var(--bg) 88%,transparent) 0%,color-mix(in srgb,var(--bg) 55%,transparent) 42%,transparent 75%),linear-gradient(0deg,var(--bg) 0%,transparent 35%,transparent 80%,color-mix(in srgb,var(--bg) 60%,transparent) 100%)}
.ch[data-side=right] .bleed-cap{right:auto;left:16px;text-align:left}
.ch-band::before,.ch-photo::before{display:none}
.bgclip{position:absolute;inset:0 0 auto 0;height:100vh;overflow:hidden;z-index:0;pointer-events:none}
.bgword{position:absolute;z-index:0;left:50%;top:50%;transform:translate(-50%,-56%);font:800 clamp(90px,21vw,360px)/.85 var(--fd);letter-spacing:-.04em;white-space:nowrap;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--ink) 22%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 16%,transparent),transparent 80%);-webkit-background-clip:text;background-clip:text;pointer-events:none;user-select:none}
.kicker{display:flex;align-items:center;gap:14px;font:600 11.5px/1.3 var(--fb);letter-spacing:.24em;text-transform:uppercase;color:var(--ac);margin-bottom:22px}
.kicker::before{content:"";flex:0 0 32px;height:1px;background:currentColor;opacity:.75}
.ch[data-side=center] .kicker{justify-content:center}.ch[data-side=center] .kicker::after{content:"";flex:0 0 32px;height:1px;background:currentColor;opacity:.75}
.display{font:${up ? 800 : 600} min(clamp(44px,7.4vw,112px),calc(var(--pw) / (var(--L,8) * var(--kw))))/.92 var(--fd);letter-spacing:${up ? "-.01em" : "-.035em"};text-transform:${up ? "uppercase" : "none"};text-wrap:balance}
.display.sm{font-size:min(clamp(38px,5.6vw,84px),calc(var(--pw) / (var(--L,8) * var(--kw))))}
.fullname{margin-top:12px;font-size:14px;letter-spacing:.06em;color:var(--mu);max-width:40ch}
.ch[data-side=center]{--pw:min(760px,90vw)}
.h2{font:${up ? 800 : 600} min(clamp(34px,4.6vw,68px),calc(var(--pw) / (var(--L,8) * var(--kw))))/1 var(--fd);letter-spacing:${up ? "0" : "-.03em"};text-transform:${up ? "uppercase" : "none"};text-wrap:balance;margin-bottom:18px}
.lede{font-size:clamp(17px,1.5vw,21px);color:var(--mu);margin-top:22px;max-width:46ch}
.ch[data-side=center] .lede,.ch[data-side=center] .fullname{margin-inline:auto}
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
.contacts{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 32px;margin-top:44px;text-align:left}
.contacts li{display:flex;flex-direction:column;gap:6px;padding:18px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}
.contacts a:hover{color:var(--ac)}
.contacts span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--mu)}
.contacts a{text-decoration:none;font-weight:600}
.ch-final{min-height:120vh}
.cue{position:absolute;z-index:3;left:50%;top:calc(100vh - 110px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--mu)}
.cue span{width:1px;height:46px;background:linear-gradient(var(--ac),transparent);animation:cue 2.2s infinite}
@keyframes cue{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
.pcard{position:relative;border-radius:${ivory ? "6px" : "14px"};overflow:hidden;background:var(--bg2);box-shadow:var(--shadow),0 0 0 1px var(--line)}
.pcard img{width:100%;height:100%;object-fit:cover;transition:scale 1.2s cubic-bezier(.2,.7,.2,1)}
.pcard:hover img{scale:1.04}
.pcard figcaption{position:absolute;left:10px;right:10px;bottom:8px;font-size:11px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9)}
.pcard figcaption a{color:#fff}
.float-photo{position:relative;width:min(100%,380px);aspect-ratio:4/3;margin-top:30px;perspective:1200px}
.float-photo .pcard{height:100%;transform:rotateY(calc((var(--p,.5) - .5) * -26deg)) translateZ(calc(var(--p,.5) * 60px)) translateY(calc((.5 - var(--p,.5)) * 60px))}
.hero-photo{position:absolute;z-index:0;right:6vw;top:18vh;width:min(26vw,320px);aspect-ratio:3/4;opacity:.55}
.hero-photo .pcard{height:100%}
.ch-gallery{flex-direction:column;align-items:stretch;gap:6vh;min-height:auto;padding-top:14vh;padding-bottom:14vh}
.ch-gallery .panel{position:relative;top:0;padding:0}
.stack{position:relative;z-index:3;display:grid;grid-template-columns:repeat(12,1fr);gap:clamp(12px,1.6vw,24px)}
.stack .pcard{grid-column:span 4;aspect-ratio:4/5;transform:translateY(calc((.5 - var(--p,.5)) * (24px + var(--k) * 14px)))}
.stack .pcard:nth-child(1){grid-column:span 8;aspect-ratio:16/10}
.stack .pcard:nth-child(2){grid-column:span 4;aspect-ratio:auto}
.stack .pcard:only-child{grid-column:1/-1;aspect-ratio:21/9}
.rv{opacity:0;transform:translateY(34px);filter:blur(8px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1),filter .9s;transition-delay:calc(var(--d,0) * 90ms)}
.in .rv{opacity:1;transform:none;filter:none}
footer{position:relative;z-index:3;padding:64px clamp(16px,6vw,96px) 64px;border-top:1px solid var(--line);background:var(--bg);color:var(--mu);font-size:13px;display:grid;gap:10px}
.foot-brand{font:${up ? 800 : 600} clamp(40px,9vw,140px)/.9 var(--fd);letter-spacing:${up ? ".02em" : "-.04em"};text-transform:${up ? "uppercase" : "none"};color:var(--ink);opacity:.9;margin-bottom:28px;overflow-wrap:anywhere}
body::after{content:"";position:fixed;inset:-50%;z-index:40;pointer-events:none;opacity:${ivory ? ".035" : ".07"};background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
${ivory ? "" : "body::before{content:\"\";position:fixed;inset:0;z-index:2;pointer-events:none;background:radial-gradient(120% 100% at 50% 50%,transparent 55%,rgba(0,0,0,.5) 100%)}"}
footer ul{list-style:none;display:grid;gap:4px}
footer a{color:var(--mu)}
@media (max-width:760px){
  body{font-size:16px}
  .nav-l{display:none}
  .top{grid-template-columns:1fr auto;padding:12px 16px}
  .brand{grid-column:1;justify-self:start;max-width:52vw;font-size:14px;letter-spacing:${up ? ".2em" : ".02em"}}
  .top-r{grid-column:2}
  .top-r>.btn{display:none}
  .menu{display:block}
  .ch.ch-photo{align-items:center;justify-content:center;text-align:center;min-height:100svh;padding-bottom:0;--pw:calc(100vw - 36px)}
  .ch.ch-photo .panel{padding:16svh 0 18svh;bottom:auto}
  .ch.ch-photo .acts{justify-content:center}
  .ch-photo .display{font-size:min(clamp(44px,13vw,72px),calc(var(--pw) / (var(--L,8) * var(--kw))))}
  .frame-meta{bottom:18px;font-size:10px}.frame-meta span:first-child{display:none}
  .stack{grid-template-columns:repeat(2,1fr)}
  .stack .pcard,.stack .pcard:nth-child(2){grid-column:span 1;aspect-ratio:4/5}
  .stack .pcard:nth-child(1){grid-column:1/-1;aspect-ratio:16/11}
  body::after{display:none}
  .ch,.ch[data-side=right],.ch[data-side=left]{justify-content:flex-start;align-items:flex-end;min-height:140svh;padding:0 18px 7svh}
  .ch .panel{max-width:100%;top:auto;bottom:6svh;padding-bottom:0}
  .ch-hero{min-height:120svh}.ch-hero .panel,.ch-hero[data-side=center] .panel{top:auto}
  .cue{display:none}
  .ch::before,.ch[data-side=left]::before,.ch[data-side=right]::before{background:linear-gradient(180deg,transparent 30%,color-mix(in srgb,var(--bg) 88%,transparent) 62%)}
  .ch[data-side=center]{text-align:left}.ch[data-side=center] .acts{justify-content:flex-start}
  .ch-band .bleed::after{background:linear-gradient(0deg,var(--bg) 8%,color-mix(in srgb,var(--bg) 70%,transparent) 45%,transparent 75%)}
  .ch.ch-photo .bleed::after{background:radial-gradient(90% 60% at 50% 50%,rgba(0,0,0,.55),rgba(0,0,0,.45) 60%,rgba(0,0,0,.8)),linear-gradient(0deg,${ivory ? "rgba(0,0,0,.75)" : "var(--bg)"} 0%,transparent 30%)}
  .ch-band .panel{margin:40svh 0 8svh;padding:20px}
  .bleed-cap{max-width:80%;top:12px;bottom:auto}
  .bgclip{height:100svh}.bgword{top:30%;font-size:28vw}
  :root,.ch[data-side=center]{--pw:calc(100vw - 36px)}
  .display{font-size:min(clamp(40px,12vw,64px),calc(var(--pw) / (var(--L,8) * var(--kw))))}
  .h2{font-size:min(clamp(30px,9vw,44px),calc(var(--pw) / (var(--L,8) * var(--kw))))}
  .idx{font-size:72px}
  .float-photo{max-width:300px;aspect-ratio:16/10;margin-top:20px}
  .hero-photo{display:none}
  .ch-gallery{padding-top:16svh;min-height:auto}
  .btn{min-height:50px}
  .acts .btn{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .rv{transition:opacity .4s;transform:none;filter:none}
  .cue span{animation:none}
  .float-photo .pcard,.stack .pcard,.bleed img{transform:none}
  .ch-photo .bleed img,.cue-in i{animation:none}
}
</style>
</head>
<body>
${opts.previewRibbon ? `<div class="ribbon">${esc(opts.previewRibbon)}</div>` : ""}
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="top${photoHero ? " over-photo" : ""}" data-top><nav class="nav-l" aria-label="Seções">${nav}</nav><a class="brand" href="#${esc(all[0]!.id)}">${esc(splitName(c.siteName || b.name)[0])}</a><div class="top-r">${mainBtn ? button(mainBtn, c, "btn") : ""}${nav ? `<details class="menu"><summary>Menu</summary><nav aria-label="Seções">${nav}${mainBtn ? button(mainBtn, c, "") : ""}</nav></details>` : ""}</div></header>
<canvas id="stage3d" aria-hidden="true"></canvas>
<div class="fallback" aria-hidden="true">${fallbackArt}</div>
<main id="conteudo">
${all.map((ch, i) => `<section id="${esc(ch.id)}" class="ch ${ch.cls ?? ""}" data-ch="${i}" data-side="${ch.side}"${ch.hide ? ' data-hide="1"' : ""}>${ch.html}</section>`).join("\n")}
</main>
<footer>
  <p class="foot-brand" aria-hidden="true">${esc(splitName(c.siteName || b.name)[0])}</p>
  <p>© ${new Date().getFullYear()} ${esc(b.name)}${b.address ? ` · ${esc(b.address)}` : ""}</p>
  ${credits.length ? `<ul>${credits.map((i) => `<li>${imageCaption(i, "span") || "Imagem: " + esc(i.alt)}</li>`).join("")}</ul>` : ""}
  <p>Objetos 3D ilustrativos, criados para esta prévia (não são produtos da empresa).</p>
  ${credits3d.map((t) => `<p>${t}</p>`).join("")}
  ${opts.footerCredit ? `<p>Site criado com SiteHunter AI</p>` : ""}
</footer>
<script src="${esc(threeSrc)}" defer></script>
${gltf || Object.keys(secGltf).length ? `<script src="${esc(opts.assetUrl ? opts.assetUrl("vendor/GLTFLoader.js") : loaderSrc)}" defer></script>` : ""}
<script>(function(){var t=document.querySelector("[data-top]");function f(){t&&t.classList.toggle("solid",scrollY>window.innerHeight*0.6)}addEventListener("scroll",f,{passive:true});f();document.querySelectorAll(".menu nav a").forEach(function(a){a.addEventListener("click",function(){a.closest("details").removeAttribute("open")})});document.querySelectorAll("main img").forEach(function(i){function x(){var p=i.closest("figure");if(p)p.remove()}if(i.complete&&i.naturalWidth===0&&i.currentSrc)x();else i.addEventListener("error",x)})})();</script>
<script>var __name=function(f){return f};window.addEventListener("DOMContentLoaded",function(){(${immersiveRuntime.toString()})(${JSON.stringify(cfg).replace(/</g, "\\u003c")});});</script>
</body>
</html>`;
}
