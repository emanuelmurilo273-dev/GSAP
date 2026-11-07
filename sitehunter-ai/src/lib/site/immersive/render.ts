import type { Concept, Section, SiteButton, SiteContent, SiteImage } from "../types";
import { button, esc, imageCaption, imgSrc, mapsHref, nl2p, safeUrl, telHref, waNumber, type RenderOpts } from "../render";
import { buildConcept, withMood } from "./concept";
import { realRuntime } from "./realRuntime";
import { arcRuntime } from "./arcRuntime";
import { isAutoRetailText, nicheOf } from "../nicheProfile";
import { SPLINE_VIEWER_SRC, isSplineUrl, splineRuntime } from "../spline";
import { GLTF_ASSETS, assetForModel } from "./kinds";
import { libraryMetaBySrc } from "../photoLibrary";
import { hoursRuntime, parseDays, parseSchedule, statusAt, statusText, timezoneFromAddress, todayText } from "../openHours";

// Site imersivo por empresa ("Vitrine"): profundidade, parallax, transições e elementos interativos em
// HTML/CSS (rápido e legível), com 3D só quando há modelo escaneado de um objeto real. A estrutura segue
// uma ordem lógica (proposta → serviços → sobre → galeria → visita com horário ao vivo → chamada final)
// e muda por ramo: tipo de abertura, intensidade do movimento, paleta, tipografia e acabamento.

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

/** Telefone publicado no formato brasileiro, quando o número tem DDI 55 (senão mostra como veio). */
const showPhone = (p: string) => { const d = p.replace(/\D/g, ""); return /^55\d{10,11}$/.test(d) ? prettyPhone(d) : p.trim(); };
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
/** Título com palavras em <span> para a entrada palavra a palavra (o texto continua inteiro para leitores de tela). */
const words = (t: string) => t.split(/\s+/).filter(Boolean).map((w, i) => `<span class="w" style="--i:${i}"><span>${esc(w)}</span></span>`).join(" ");

type Img = SiteImage & { src: string; w: number | null };

/** <img> com srcset para fotos da biblioteca (versão menor no celular) e dimensões contra salto de layout. */
function picture(i: Img, sizes: string, opts: { eager?: boolean; cls?: string } = {}): string {
  const meta = libraryMetaBySrc(i.src);
  const m = i.src.match(/^(.*\/photos\/[a-z]+\/(h?)\d+)\.jpg$/);
  const mw = m?.[2] ? 1200 : 640;
  const srcset = meta && m ? ` srcset="${esc(`${m[1]}-m.jpg`)} ${Math.min(mw, meta.w)}w, ${esc(i.src)} ${meta.w}w" sizes="${esc(sizes)}"` : "";
  const dims = meta ? ` width="${meta.w}" height="${meta.h}"` : "";
  return `<img${opts.cls ? ` class="${opts.cls}"` : ""} src="${esc(i.src)}"${srcset}${dims} alt="${esc(i.alt)}" ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
/** Pré-carga com o mesmo srcset do <img>: o navegador baixa só a versão que vai usar (sem baixar duas vezes). */
function preloadImage(i: Img, sizes: string): string {
  const meta = libraryMetaBySrc(i.src);
  const m = i.src.match(/^(.*\/photos\/[a-z]+\/(h?)\d+)\.jpg$/);
  if (!meta || !m) return `<link rel="preload" as="image" href="${esc(i.src)}">`;
  const mw = Math.min(m[2] ? 1200 : 640, meta.w);
  return `<link rel="preload" as="image" href="${esc(i.src)}" imagesrcset="${esc(`${m[1]}-m.jpg`)} ${mw}w, ${esc(i.src)} ${meta.w}w" imagesizes="${esc(sizes)}">`;
}
function figure(i: Img, sizes: string, cls: string, eager = false, extra = ""): string {
  return `<figure class="${cls}"${extra}>${picture(i, sizes, { eager })}${imageCaption(i)}</figure>`;
}

/** Ramos e o caráter do movimento: calmo (saúde), equilibrado ou intenso. */
const CALM = new Set(["tooth", "implant", "pill", "glasses"]);
const BOLD = new Set(["scissors", "razor", "pole", "dumbbell", "kettlebell", "wheel", "wrench", "gear", "burger", "pizza"]);

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
  const motion = CALM.has(k.model) ? "calm" : BOLD.has(k.model) ? "bold" : "even";
  const amp = motion === "calm" ? 0.5 : motion === "bold" ? 1.25 : 1;

  // ---------- imagens: cada foto aparece uma vez só; as maiores vão para os lugares grandes ----------
  const used = new Set<string>();
  const asImg = (i: SiteImage | undefined): Img | null => { const src = imgSrc(i); return i && src ? { ...i, src, w: libraryMetaBySrc(src)?.w ?? null } : null; };
  const pool: Img[] = [hero?.image, about?.image, ...(gallery?.images ?? []), ...(products?.items.map((p) => p.image) ?? [])].map(asImg).filter((x): x is Img => !!x);
  const take = (prefer?: SiteImage, minW = 0): Img | null => {
    const p = asImg(prefer);
    if (p && !used.has(p.src) && (p.w == null || p.w >= minW)) { used.add(p.src); return p; }
    const next = pool.find((x) => !used.has(x.src) && (x.w == null || x.w >= minW)) ?? pool.find((x) => !used.has(x.src));
    if (next) used.add(next.src);
    return next ?? null;
  };
  const isLarge = (i: Img | null) => !!i && (i.w == null ? i.origin === "company" : i.w >= 1800);

  // ---------- 3D realista (só com modelo escaneado) ----------
  // O conceito guarda se há modelo escaneado para o ramo (concessionária, pneus, lavagem etc. usam fotografia).
  const asset = isAutoRetailText(`${c.business.name} ${c.siteName} ${c.seo.description}`) ? null : assetForModel(k.model, seed);
  const threeSrc = opts.threeSrc ?? "/vendor/three.min.js";
  const base = opts.assetBase ?? threeSrc.replace(/vendor\/three\.min\.js$/, "models/");
  const res = (p: string) => (opts.assetUrl ? opts.assetUrl(`models/${p}`) : base + p);
  const vendor = (f: string) => (opts.assetUrl ? opts.assetUrl(`vendor/${f}`) : threeSrc.replace(/three\.min\.js$/, f));

  // ---------- horário: status ao vivo (fuso da empresa), nada presumido ----------
  const hoursLines = hours?.lines.filter((l) => l.value.trim()) ?? [];
  const tz = hours?.timezone || timezoneFromAddress(b.address) || null;
  const schedule = tz ? parseSchedule(hoursLines) : null;
  const status = statusAt(schedule, hoursLines.length > 0, new Date(), tz ?? "America/Sao_Paulo");
  const statusCls = status.kind === "open" ? " is-open" : status.kind === "closed" ? " is-closed" : " is-unknown";
  const statusPill = (cls = "") => `<p class="status${statusCls}${cls ? ` ${cls}` : ""}"${schedule ? " data-open-status" : ""} role="status"><i aria-hidden="true"></i><span data-open-text>${esc(statusText(status))}</span></p>`;

  // ---------- ramo: linguagem visual e conteúdo típico (a confirmar com a empresa) ----------
  const niche = nicheOf(k.model, `${b.name} ${c.siteName} ${c.seo.description}`);
  const svcItems = services?.items.filter((i) => i.title.trim()) ?? products?.items.filter((i) => i.name.trim()).map((i) => ({ title: i.name, description: i.description })) ?? [];
  const realItem = (i: { name: string }) => i.name.trim() && !/^item do card/i.test(i.name);
  const menuCats = menu?.categories.filter((cat) => cat.name.trim()).map((cat) => ({ ...cat, items: cat.items.filter(realItem) })).filter((cat) => cat.items.length) ?? [];
  const chipSet = new Map<string, string>();
  for (const w of [...svcItems.map((i) => i.title), ...menuCats.map((m) => m.name), ...niche.chips]) if (w.trim() && !chipSet.has(fold(w))) chipSet.set(fold(w), w.trim());
  const chips = [...chipSet.values()];

  // ---------- abertura inspirada em heros com arco de luz: centrada, pílula de status, dois botões e um painel ----------
  const title = (hero?.title || c.siteName).trim();
  const sub = (hero?.subtitle ?? "").trim();
  const titleIsName = fold(title).includes(fold(brand)) || fold(brand).includes(fold(title));
  const proposal = titleIsName ? firstSentence(sub) || title : title;
  const lede = titleIsName ? sub.replace(proposal, "").trim() : sub;
  const where = k.kicker;
  const mainBtn = hero?.buttons[0];
  const heroImg = take(hero?.image, 1200);
  // Variedade: ramos de vitrine usam a foto em tela cheia (cinema); os demais, o arco com painel.
  const kind: "arc" | "cinema" = !asset && isLarge(heroImg) && ["pet", "roupas", "imobiliaria"].includes(niche.key) ? "cinema" : "arc";
  const todayStr = todayText(schedule, new Date(), tz ?? "America/Sao_Paulo");

  const arrow = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  /** Botão com troca de letras no hover, seta em círculo (primário) ou preenchimento em círculo (secundário). */
  const rollBtn = (x: SiteButton, cls: string, withArrow = false) => {
    const html = button(x, c, `btn roll ${cls}`);
    const label = x.label;
    const letters = [...label].map((ch, i) => `<i style="--i:${i}" data-c="${ch === " " ? "&nbsp;" : esc(ch)}"><span>${ch === " " ? "&nbsp;" : esc(ch)}</span></i>`).join("");
    return html.replace(`>${esc(label)}</a>`, `><span class="rl" aria-hidden="true">${letters}</span><span class="sr">${esc(label)}</span>${withArrow ? `<span class="ar" aria-hidden="true">${arrow}</span>` : ""}</a>`);
  };

  const sideList = (svcItems.length ? svcItems.map((i) => i.title) : niche.chips).slice(0, 4);
  const contactLines = [
    wa ? { t: "WhatsApp", v: prettyPhone(wa) } : null,
    b.phone ? { t: "Telefone", v: showPhone(b.phone) } : null,
    !wa && !b.phone && b.email ? { t: "E-mail", v: b.email } : null,
  ].filter((x): x is { t: string; v: string } => !!x).slice(0, 2);
  const hotAction = mainBtn ? { ...mainBtn, label: mainBtn.action === "whatsapp" || mainBtn.action === "section" ? niche.panelCta : mainBtn.action === "phone" ? "Ligar agora" : mainBtn.label } : null;
  // Palco do painel, por prioridade: cena do Spline (se configurada e válida) > modelo escaneado > foto em profundidade.
  const splineUrl = isSplineUrl(k.spline?.url) ? k.spline!.url.trim() : null;
  const photoMedia = heroImg ? figure(heroImg, "(max-width: 900px) 100vw, 40vw", "ph", true) : `<div class="ph ph-empty" aria-hidden="true"><b>${esc(brand.charAt(0))}</b></div>`;
  const media = splineUrl
    ? `<div class="spl" data-spline data-spline-state="waiting"><div class="spl-fallback">${photoMedia}</div><span class="spl-load" aria-hidden="true">Carregando cena 3D…</span></div>`
    : asset
      ? `<div class="stage" data-stage3d aria-hidden="true"><canvas></canvas>${heroImg ? picture(heroImg, "(max-width: 900px) 100vw, 40vw", { cls: "stage-fallback" }) : ""}<span class="stage-loading">Carregando modelo 3D…</span></div>`
      : photoMedia;
  const ribbon = niche.accent ? `<div class="ap-ribbon ${niche.accent}" aria-hidden="true"></div>` : "";
  const panel = `<div class="arc-panel" data-arc-panel>
    ${ribbon}
    <div class="ap-side">
      <p class="ap-brand"><i aria-hidden="true">${esc(brand.charAt(0))}</i><span>${esc(brand)}</span></p>
      <p class="ap-label">${esc(niche.panelTitle)}</p>
      <ul>${sideList.map((t, n) => `<li${n === 0 ? ' class="on"' : ""}>${esc(t)}</li>`).join("")}</ul>
      ${where ? `<p class="ap-where">${esc(where)}</p>` : ""}
    </div>
    <div class="ap-main">
      <header class="ap-head"><div><h2>${esc(niche.panelTitle)}</h2>${todayStr ? `<p class="ap-sub">Hoje · <b data-today>${esc(todayStr)}</b></p>` : `<p class="ap-sub">Horário não informado</p>`}</div>${statusPill()}</header>
      <div class="ap-grid">
        <div class="ap-media"${!asset && !splineUrl ? " data-tilt-media" : ""}>${media}</div>
        ${b.address ? `<div class="ap-card"><span>Endereço</span><p>${esc(b.address.split("·").slice(0, 2).join(" ·"))}</p><a href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">Abrir no mapa →</a></div>` : ""}
        ${contactLines.length ? `<div class="ap-card"><span>Contato</span>${contactLines.map((l) => `<p><small>${esc(l.t)}</small> ${esc(l.v)}</p>`).join("")}</div>` : ""}
        ${hotAction ? button(hotAction, c, "ap-card hot").replace(/>([^<]+)<\/a>$/, (_m, t) => `><span>${niche.label}</span><b>${t}</b><em aria-hidden="true">${arrow}</em></a>`) : ""}
      </div>
    </div>
  </div>`;
  const acts = hero?.buttons.length ? `<div class="acts rv" style="--d:4">${hero.buttons.map((x, i) => (i ? rollBtn(x, "ghost") : rollBtn(x, "hero-primary mag", true))).join("")}</div>` : "";
  const pill = `<a class="pill rv" href="#${esc(hours ? hours.id : "contato")}">${statusPill("in-pill")}<em aria-hidden="true">${arrow}</em></a>`;
  const heroHtml = kind === "cinema" && heroImg
    ? `<section id="${esc(hero?.id ?? "inicio")}" class="hero cinema" aria-labelledby="h-hero">
  <div class="cine-bg" data-par="-0.18" aria-hidden="true">${picture(heroImg, "100vw", { eager: true })}</div>
  <div class="cine-shade" aria-hidden="true"></div>
  <div class="hero-copy">${pill}
    <h1 id="h-hero" class="h1 split" aria-label="${esc(proposal)}">${words(proposal)}</h1>
    ${brandFull ? `<p class="fullname rv" style="--d:3">${esc(brandFull)}</p>` : ""}
    ${lede ? `<p class="lede rv" style="--d:3">${esc(lede)}</p>` : ""}
    ${acts}
  </div>
  ${imageCaption(heroImg, "p", "cine-cap")}
  <a class="scroll-cue" href="#${esc((services ?? products ?? menu ?? about)?.id ?? "contato")}" aria-label="Rolar para o conteúdo"><span></span></a>
</section>`
    : `<section id="${esc(hero?.id ?? "inicio")}" class="hero arc glow-${niche.glow}" aria-labelledby="h-hero">
  <div class="arc-fx" aria-hidden="true"><canvas data-arc></canvas></div>
  <div class="arc-copy">
    ${pill}
    <h1 id="h-hero" class="h1 split" aria-label="${esc(proposal)}">${words(proposal)}</h1>
    ${brandFull ? `<p class="fullname rv" style="--d:3">${esc(brandFull)}</p>` : ""}
    ${lede ? `<p class="lede rv" style="--d:3">${esc(lede)}</p>` : ""}
    ${acts}
  </div>
  ${panel}
</section>`;

  // ---------- faixa em movimento: serviços reais + tipologia do ramo ----------
  const marqueeWords = [...chips, ...k.highlights].filter(Boolean).slice(0, 10);
  const marquee = marqueeWords.length >= 3 ? `<div class="marquee" aria-hidden="true"><div class="mq-track">${[0, 1].map(() => `<span>${marqueeWords.map((w) => `${esc(w)}<i>✦</i>`).join("")}</span>`).join("")}</div></div>` : "";

  // ---------- serviços: trilho horizontal fixado (computador) / deslizar (celular) ----------
  const parts: string[] = [];
  const navItems: { id: string; label: string }[] = [];
  const svc = services ?? products;
  if (svc && svcItems.length) {
    navItems.push({ id: svc.id, label: svc.title || "Serviços" });
    // Foto em todos os cartões ou em nenhum (cartões desiguais parecem inacabados); guarda fotos para a galeria.
    const nCards = Math.min(svcItems.length, 6);
    const cardImgs = pool.length - used.size >= nCards + 4 ? svcItems.slice(0, nCards).map(() => take()) : [];
    const head = `<header class="sec-head"><p class="kicker rv">${esc(svc.title || "Serviços")}</p>${svc.intro && svc.intro.length <= 70 ? `<h2 id="h-svc" class="h2 rv" style="--d:1">${esc(svc.intro)}</h2>` : `<h2 id="h-svc" class="h2 rv" style="--d:1">${esc(svc.title && fold(svc.title) !== "servicos" ? svc.title : "O que oferecemos")}</h2>${svc.intro ? `<p class="lede rv" style="--d:2">${esc(svc.intro)}</p>` : ""}`}</header>`;
    const cards = svcItems.slice(0, 6).map((it, n) => `<li class="card" data-tilt-card>${cardImgs[n] ? `<div class="card-img">${picture(cardImgs[n]!, "(max-width: 900px) 80vw, 30vw")}</div>` : ""}<div class="card-body"><span class="num" aria-hidden="true">${String(n + 1).padStart(2, "0")}</span><h3>${esc(it.title)}</h3>${it.description ? `<p>${esc(it.description)}</p>` : ""}</div></li>`).join("");
    const pinned = svcItems.length >= 4;
    parts.push(pinned
      ? `<section id="${esc(svc.id)}" class="rail" aria-labelledby="h-svc" data-rail style="--n:${Math.min(svcItems.length, 6)}"><div class="rail-sticky">${head}<ol class="rail-track" data-rail-track>${cards}</ol><div class="rail-bar" aria-hidden="true"><i data-rail-bar></i></div></div></section>`
      : `<section id="${esc(svc.id)}" class="sec" aria-labelledby="h-svc">${head}<ol class="cards">${cards}</ol></section>`);
  }
  // ---------- frase de destaque: as palavras acendem conforme a rolagem (sem texto novo: usa a frase do ramo e o nome) ----------
  const stmt = `${niche.tagline.replace(/[.!?]+$/, "")}. ${brand}.`;
  parts.push(`<section class="stmt" data-stmt aria-label="${esc(stmt)}"><p class="stmt-text" aria-hidden="true">${stmt.split(/\s+/).filter(Boolean).map((w) => `<span class="sw">${esc(w)}</span>`).join(" ")}</p></section>`);

  if (menu && menuCats.length) {
    navItems.push({ id: menu.id, label: menu.title || "Cardápio" });
    parts.push(`<section id="${esc(menu.id)}" class="sec" aria-labelledby="h-menu">
  <header class="sec-head"><p class="kicker rv">${esc(menu.title || "Cardápio")}</p><h2 id="h-menu" class="h2 rv" style="--d:1">${esc(menu.intro || "Do nosso cardápio")}</h2></header>
  <div class="menu-grid">${menuCats.slice(0, 6).map((cat, n) => `<div class="menu-cat rv" style="--d:${(n % 3) + 1}"><h3>${esc(cat.name)}</h3><ul>${cat.items.slice(0, 8).map((i) => `<li><span class="mi-name">${esc(i.name)}</span>${i.price ? `<span class="mi-price">${esc(i.price)}</span>` : ""}${i.description ? `<span class="mi-desc">${esc(i.description)}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}</div>
</section>`);
  }

  // ---------- sobre: foto com revelação e parallax interno ----------
  const aboutImg = take(about?.image);
  const aboutSec = about && (about.text || about.title) ? about : textSec ? { id: textSec.id, title: textSec.title, text: textSec.text } : null;
  if (aboutSec) {
    navItems.push({ id: aboutSec.id, label: "Sobre" });
    parts.push(`<section id="${esc(aboutSec.id)}" class="sec about${aboutImg ? "" : " no-media"}" aria-labelledby="h-about">
  ${aboutImg ? `<div class="about-media reveal">${figure(aboutImg, "(max-width: 900px) 100vw, 46vw", "ph", false, ` data-par-inner="0.12"`)}</div>` : ""}
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

  // ---------- galeria em colunas com velocidades diferentes ----------
  const gimgs: Img[] = [];
  for (let n = 0; n < 6; n++) { const i = take(); if (i) gimgs.push(i); }
  if (gimgs.length >= 2) {
    navItems.push({ id: gallery?.id ?? "galeria", label: "Galeria" });
    const cols = gimgs.length >= 5 ? 3 : 2;
    const colImgs = Array.from({ length: cols }, (_, ci) => gimgs.filter((_, n) => n % cols === ci));
    parts.push(`<section id="${esc(gallery?.id ?? "galeria")}" class="sec gal" aria-labelledby="h-gal">
  <header class="sec-head"><p class="kicker rv">${esc(gallery?.title || "Galeria")}</p><h2 id="h-gal" class="h2 rv" style="--d:1">Um pouco do ambiente</h2></header>
  <div class="gal-cols c${cols}">${colImgs.map((col, ci) => `<div class="gal-col" data-par="${[0.05, -0.1, 0.12][ci]}">${col.map((i) => `<div class="reveal">${figure(i, `(max-width: 900px) 50vw, ${Math.round(100 / cols)}vw`, "ph")}</div>`).join("")}</div>`).join("")}</div>
</section>`);
  }

  // ---------- visita: horário com status ao vivo + localização e contatos ----------
  const contacts = [
    wa && `<li><span>WhatsApp</span><a href="https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vim pelo site da ${b.name}.`)}" target="_blank" rel="noopener noreferrer">${esc(prettyPhone(wa))}</a></li>`,
    b.phone && `<li><span>Telefone</span><a href="${esc(telHref(b.phone))}">${esc(showPhone(b.phone))}</a></li>`,
    b.email && `<li><span>E-mail</span><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
    b.instagram && `<li><span>Instagram</span><a href="${esc(safeUrl(b.instagram))}" target="_blank" rel="noopener noreferrer">${esc(b.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, ""))}</a></li>`,
  ].filter(Boolean);
  const contactId = contact?.id ?? "contato";
  navItems.push({ id: contactId, label: "Contato" });
  const hoursHtml = hoursLines.length
    ? `<dl class="hours">${hoursLines.map((l) => { const d = parseDays(l.label); return `<div${d ? ` data-days="${d.join(",")}"` : ""}><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`; }).join("")}</dl>${hours?.note ? `<p class="note">${esc(hours.note)}</p>` : ""}${!schedule ? `<p class="note">${tz ? "Não foi possível calcular se está aberto agora a partir destes horários: confirme com a empresa." : "Fuso horário da empresa não identificado: o site não calcula se está aberto agora."}</p>` : ""}`
    : `<p class="note">A empresa não publicou o horário de funcionamento nas fontes consultadas.</p>`;
  parts.push(`<section id="${esc(contactId)}" class="sec visit" aria-labelledby="h-visit">
  <header class="sec-head"><p class="kicker rv">${esc(contact?.title || "Contato e localização")}</p><h2 id="h-visit" class="h2 rv" style="--d:1">${esc(contact?.text || "Fale com a gente ou venha nos visitar")}</h2></header>
  <div class="visit-grid">
    <div class="panel rv" style="--d:1"><h3>${esc(hours?.title || "Horário de funcionamento")}</h3>${statusPill("big")}${hoursHtml}</div>
    <div class="panel rv" style="--d:2"><h3>Onde estamos</h3>${b.address ? `<p class="addr">${esc(b.address)}</p><a class="btn ghost sm" href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>` : `<p class="note">Endereço a confirmar com a empresa.</p>`}${contacts.length ? `<ul class="contacts">${contacts.join("")}</ul>` : ""}</div>
  </div>
</section>`);

  // ---------- consulta rápida (ramos em que o cliente chega com um veículo e uma necessidade) ----------
  // Monta a mensagem no navegador e leva ao contato publicado da própria empresa (WhatsApp, telefone ou e-mail).
  // Nada é enviado pelo site: o visitante toca no link. Sem contato publicado, a seção não aparece.
  const ASK: Partial<Record<string, { title: string; lede: string; extra: string; ph: string }>> = {
    oficina: { title: "Peça seu orçamento", lede: "Conte qual é o veículo e o que está acontecendo. A mensagem já vai pronta para a oficina.", extra: "O que está acontecendo?", ph: "ex.: barulho ao frear" },
    autopecas: { title: "Consulte uma peça", lede: "Informe o veículo e a peça. A loja confirma se tem e o prazo.", extra: "Peça desejada", ph: "ex.: pastilha de freio dianteira" },
    pneus: { title: "Consulte pneus", lede: "Informe o veículo e, se souber, a medida do pneu. A loja responde com opções e prazo.", extra: "Medida do pneu (opcional)", ph: "ex.: 195/55 R16" },
    funilaria: { title: "Peça uma avaliação", lede: "Conte o veículo e o que precisa de reparo. Combine o envio de fotos pelo contato.", extra: "O que precisa de reparo?", ph: "ex.: amassado na porta" },
    concessionaria: { title: "Fale sobre o veículo que procura", lede: "Diga o modelo e o ano de interesse. A equipe retorna com as opções disponíveis.", extra: "Tem veículo para troca? (opcional)", ph: "ex.: sim, um modelo 2015" },
  };
  const ask = ASK[niche.key];
  const askVia = wa ? "wa" : b.phone ? "tel" : b.email ? "mail" : "";
  if (ask && askVia) {
    if (navItems.length < 4) navItems.push({ id: "consulta", label: "Consulta" });
    const goLabel = askVia === "wa" ? "Enviar pelo WhatsApp" : askVia === "tel" ? "Ligar para a empresa" : "Enviar por e-mail";
    const goHref = askVia === "wa" ? `https://wa.me/${wa}` : askVia === "tel" ? telHref(b.phone!) : `mailto:${b.email}`;
    parts.push(`<section id="consulta" class="sec ask" aria-labelledby="h-ask" data-ask data-via="${askVia}" data-biz="${esc(b.name)}">
  <header class="sec-head"><p class="kicker rv">Consulta rápida</p><h2 id="h-ask" class="h2 rv" style="--d:1">${esc(ask.title)}</h2><p class="lede rv" style="--d:2">${esc(ask.lede)}</p></header>
  <div class="ask-card rv" style="--d:2">
    <label><span>Veículo (marca e modelo)</span><input data-f="veiculo" maxlength="60" autocomplete="off" placeholder="ex.: Fiat Uno"></label>
    <label><span>Ano</span><input data-f="ano" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="ex.: 2014"></label>
    <label class="wide"><span>${esc(ask.extra)}</span><input data-f="extra" maxlength="120" autocomplete="off" placeholder="${esc(ask.ph)}"></label>
    <p class="ask-preview wide" data-ask-preview aria-live="polite"></p>
    <a class="btn wide" data-ask-go href="${esc(goHref)}" ${askVia === "wa" ? 'target="_blank" rel="noopener noreferrer"' : ""}>${goLabel}<span aria-hidden="true">→</span></a>
    <p class="note wide">${askVia === "tel" ? "Esta empresa não publicou WhatsApp: o botão liga, e a mensagem acima serve de roteiro para a ligação." : "Nada é enviado por este site. Você revisa e confirma a mensagem no seu aplicativo."}</p>
  </div>
</section>`);
  }

  // ---------- chamada final ----------
  const finalBtn = cta?.button ?? (quote ? { label: quote.buttonLabel || "Pedir orçamento", action: wa ? ("whatsapp" as const) : b.phone ? ("phone" as const) : ("email" as const) } : mainBtn);
  const finalImg = take();
  if (finalBtn) {
    parts.push(`<section class="final${finalImg ? " has-photo" : ""}" aria-labelledby="h-final">
  ${finalImg ? `<div class="final-bg" data-par="-0.15" aria-hidden="true">${picture(finalImg, "100vw")}</div>` : ""}
  <div class="final-copy"><h2 id="h-final" class="h2 xl rv">${esc(cta?.title || quote?.title || `Vamos conversar?`)}</h2>${cta?.text || quote?.text ? `<p class="lede rv" style="--d:1">${esc(cta?.text || quote?.text)}</p>` : ""}<div class="acts rv" style="--d:2">${button(finalBtn, c, "btn mag")}</div></div>
</section>`);
  }

  // Barra fixa no celular com o contato principal (WhatsApp, telefone ou mapa).
  const dock = [
    wa ? `<a class="dock-main" href="https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vim pelo site da ${b.name}.`)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : b.phone ? `<a class="dock-main" href="${esc(telHref(b.phone))}">Ligar</a>` : "",
    b.address ? `<a href="${esc(mapsHref(c))}" target="_blank" rel="noopener noreferrer">Como chegar</a>` : "",
  ].filter(Boolean);

  const nav = navItems.slice(0, 5).map((x) => `<a href="#${esc(x.id)}">${esc(x.label)}</a>`).join("");
  const shown = [...used].map((src) => pool.find((p) => p.src === src)!).filter(Boolean);
  const credits = [...new Map(shown.map((i) => [i.src, i])).values()];
  const assetInfo = asset ? GLTF_ASSETS[asset] : null;
  const cfg3d = asset ? { gltfUrl: res(`${asset}/model.gltf`), hdrUrl: res("hdri/studio_small_09_1k.hdr"), dark: !ivory } : null;
  const mixHex = (a: string, bHex: string, t: number) => { const f = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = f(a), y = f(bHex); return "#" + x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, "0")).join(""); };
  const glowColors: [string, string, string] = niche.glow === "fire" ? ["#ffe3ac", "#ff7a1a", "#c2300a"] : niche.glow === "sparks" ? ["#ffffff", "#ff9a3c", mixHex(P.accent2, "#8fa6c0", 0.5)] : [mixHex(P.accent, "#ffffff", 0.55), P.accent, P.accent2];
  const arcCfg = { kind: niche.glow, c: glowColors, dark: !ivory, bg: P.bg };
  const ts = TITLE_SCALE[k.display] ?? 1;
  const up = k.caseStyle === "upper";
  const dw = ["Anton", "Instrument Serif", "Archivo Black"].includes(k.display) ? 400 : 600;

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
${heroImg && !asset ? preloadImage(heroImg, kind === "cinema" ? "100vw" : "(max-width: 900px) 100vw, 40vw") : ""}
<style>
:root{--bg:${P.bg};--bg2:${P.bg2};--ink:${P.ink};--mu:${P.muted};--ac:${P.accent};--ac2:${P.accent2};--fd:'${k.display}',Georgia,serif;--fb:'${k.body}',system-ui,sans-serif;--ts:${ts};--line:color-mix(in srgb,var(--ink) 13%,transparent);--card:color-mix(in srgb,var(--ink) ${ivory ? 4 : 6}%,var(--bg));--shadow:${ivory ? "0 30px 70px -34px rgba(40,30,20,.4)" : "0 40px 90px -40px rgba(0,0,0,.95)"};--r:${ivory ? "12px" : "18px"};--gut:clamp(16px,5vw,72px);--ease:cubic-bezier(.2,.75,.15,1);color-scheme:${ivory ? "light" : "dark"}}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;scroll-padding-top:84px}
body{background:var(--bg);color:var(--ink);font:400 17px/1.65 var(--fb);-webkit-font-smoothing:antialiased;overflow-x:clip}
a{color:inherit}
img{display:block;max-width:100%;height:auto}
.ribbon{position:relative;z-index:31;background:var(--ac);color:var(--bg);font:600 12px/1 var(--fb);text-align:center;padding:8px 12px;letter-spacing:.03em}
.skip{position:fixed;left:12px;top:-60px;z-index:60;padding:12px 16px;border-radius:10px;background:var(--ac);color:var(--bg);font-weight:600;text-decoration:none}.skip:focus{top:12px}
a:focus-visible,summary:focus-visible,button:focus-visible{outline:2px solid var(--ac);outline-offset:3px;border-radius:6px}
.progress{position:fixed;left:0;top:0;height:3px;width:100%;transform-origin:0 50%;transform:scaleX(var(--p,0));background:linear-gradient(90deg,var(--ac),var(--ac2));z-index:40}
/* cabeçalho */
.top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:20px;padding:16px var(--gut);transition:padding .35s var(--ease),background .35s,border-color .35s;border-bottom:1px solid transparent}
.top.solid{padding-block:10px;background:color-mix(in srgb,var(--bg) 82%,transparent);-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2);border-bottom-color:var(--line)}
.on-cinema .top:not(.solid){color:#fff}.on-cinema .top:not(.solid) .nav{color:rgba(255,255,255,.85)}
.brand{font:${up ? 700 : 600} 19px/1.1 var(--fd);letter-spacing:${up ? ".08em" : "-.01em"};text-transform:${up ? "uppercase" : "none"};text-decoration:none;max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav{display:flex;gap:26px;margin-left:auto;font-size:15px;color:var(--mu)}
.nav a{position:relative;text-decoration:none;padding:6px 0}.nav a::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--ac);transform:scaleX(0);transform-origin:right;transition:transform .35s var(--ease)}.nav a:hover{color:var(--ink)}.nav a:hover::after{transform:scaleX(1);transform-origin:left}
.top .status{margin:0}
.top .btn{min-height:42px;padding:0 18px;font-size:14px}
.menu{display:none;margin-left:auto;position:relative}
.menu summary{list-style:none;cursor:pointer;min-height:44px;min-width:44px;display:flex;align-items:center;padding:0 14px;border:1px solid var(--line);border-radius:999px;font-weight:600;font-size:14px;background:color-mix(in srgb,var(--bg) 60%,transparent)}
.menu summary::-webkit-details-marker{display:none}
.menu nav{position:absolute;right:0;top:calc(100% + 10px);min-width:240px;display:grid;padding:8px;border-radius:14px;background:var(--bg);color:var(--ink);border:1px solid var(--line);box-shadow:var(--shadow)}
.menu nav a{padding:14px 16px;text-decoration:none;font-size:16px;border-radius:10px}.menu nav a:hover{background:var(--card)}
/* status aberto/fechado */
.status{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;border:1px solid var(--line);font-size:14px;font-weight:600;line-height:1.2;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.status i{width:9px;height:9px;border-radius:50%;background:var(--mu);flex:0 0 auto}
.status.is-open i{background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:pulse 2.2s infinite}
.status.is-closed i{background:#ef4444}
.status.big{font-size:16px;padding:10px 16px;margin-bottom:18px}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 10px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
/* botões */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 28px;border-radius:999px;background:var(--ac);color:var(--bg);font:600 16px/1 var(--fb);text-decoration:none;border:1px solid var(--ac);transition:transform .3s var(--ease),box-shadow .3s,background .3s;will-change:transform}
.btn:hover{box-shadow:0 16px 40px -14px var(--ac)}
.btn.ghost{background:transparent;color:inherit;border-color:color-mix(in srgb,currentColor 35%,transparent)}
.btn.ghost:hover{border-color:currentColor;box-shadow:none}
.btn.sm{min-height:44px;padding:0 18px;font-size:15px}
/* tipografia */
.eyebrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font:600 13px/1.3 var(--fb);letter-spacing:.16em;text-transform:uppercase;color:var(--ac);margin-bottom:22px}
.eyebrow span{color:var(--mu);letter-spacing:.08em;font-weight:500}.eyebrow span::before{content:"";display:inline-block;width:22px;height:1px;background:currentColor;opacity:.5;vertical-align:middle;margin-right:12px}
.h1{font:${dw} calc(clamp(42px,5.6vw,88px) * var(--ts))/1.0 var(--fd);letter-spacing:-.03em;text-wrap:balance;overflow-wrap:break-word}
.h2{font:${dw} calc(clamp(30px,3.6vw,54px) * var(--ts))/1.06 var(--fd);letter-spacing:-.02em;text-wrap:balance;overflow-wrap:break-word}
.h2.xl{font-size:calc(clamp(36px,5vw,76px) * var(--ts))}
.ask-card{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:760px;padding:clamp(18px,3vw,30px);border:1px solid color-mix(in srgb,var(--ink) 14%,transparent);border-radius:20px;background:color-mix(in srgb,var(--bg2) 70%,transparent)}
.ask-card label{display:grid;gap:6px;font:500 12px/1.2 var(--fb);letter-spacing:.06em;text-transform:uppercase;color:var(--mu)}
.ask-card input{font:400 16px/1.3 var(--fb);letter-spacing:0;text-transform:none;color:var(--ink);background:color-mix(in srgb,var(--ink) 6%,transparent);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:12px;padding:13px 14px;min-height:48px;width:100%}
.ask-card input:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.ask-card .wide{grid-column:1/-1}
.ask-preview{margin:0;font:400 14px/1.45 var(--fb);color:var(--mu);min-height:1.45em}
.ask-card .btn{justify-self:start}
@media(max-width:620px){.ask-card{grid-template-columns:1fr}}
.stmt{padding:clamp(72px,14vh,160px) var(--gut,5vw);display:grid;place-items:center;min-height:60vh}
.stmt-text{max-width:20ch;margin:0 auto;text-align:center;font:${dw} calc(clamp(38px,7.2vw,116px) * var(--ts))/1.02 var(--fd);letter-spacing:-.035em;text-wrap:balance;${up ? "text-transform:uppercase;" : ""}overflow-wrap:break-word}
.stmt-js .sw{opacity:.16;transition:opacity .35s linear,color .35s linear}
.stmt-js .sw.on{opacity:1}
.stmt-js .sw.on:last-child,.stmt-js .sw.on:nth-last-child(2){color:var(--ac)}
.split .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em}
.split .w>span{display:inline-block;transform:translateY(105%);transition:transform 1s var(--ease);transition-delay:calc(var(--i) * 70ms + 120ms)}
.ready .split .w>span{transform:none}
.kicker{display:flex;align-items:center;gap:12px;font:600 12.5px/1.3 var(--fb);letter-spacing:.18em;text-transform:uppercase;color:var(--ac);margin-bottom:16px}
.kicker::before{content:"";width:28px;height:1px;background:currentColor}
.lede{font-size:clamp(18px,1.45vw,21px);line-height:1.55;color:var(--mu);max-width:46ch;margin-top:22px;text-wrap:pretty}
.fullname{margin-top:12px;color:var(--mu);font-size:15px}
.prose{color:var(--mu);font-size:18px;max-width:60ch}.prose p+p{margin-top:14px}
/* abertura */
.hero{position:relative;max-width:1520px;margin:0 auto}
.acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.ph{position:relative;margin:0;height:100%;border-radius:var(--r);overflow:hidden;background:var(--bg2);box-shadow:var(--shadow)}
.ph img{width:100%;height:100%;object-fit:cover}
.ph-empty{display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,color-mix(in srgb,var(--ac) 35%,var(--bg2)),var(--bg2))}.ph-empty b{font:${dw} 96px/1 var(--fd);color:color-mix(in srgb,var(--ink) 80%,transparent)}
figure figcaption{position:absolute;left:12px;right:12px;bottom:10px;font-size:11.5px;line-height:1.35;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.9);pointer-events:auto}
figure figcaption a{color:#fff}
/* abertura com arco de luz */
.hero.arc{max-width:none;margin:0;overflow:hidden;padding:clamp(40px,6vw,92px) var(--gut) 0;min-height:calc(100svh - 76px);display:flex;flex-direction:column;align-items:center}
.arc-fx{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse 78% 46% at 50% 64%,color-mix(in srgb,var(--ac) ${ivory ? 22 : 42}%,transparent),transparent 72%)}
.arc-fx canvas{position:absolute;inset:0;width:100%;height:100%}
.arc-copy{position:relative;z-index:2;text-align:center;max-width:980px;display:flex;flex-direction:column;align-items:center}
.arc-copy .h1{font-size:calc(clamp(40px,5.4vw,84px) * var(--ts));background:linear-gradient(180deg,var(--ink) 30%,color-mix(in srgb,var(--ink) 60%,var(--ac)));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding-bottom:.06em}
.arc-copy .split .w>span{-webkit-text-fill-color:transparent}
.arc-copy .lede{margin-inline:auto;margin-top:20px;max-width:56ch}
.arc-copy .acts{justify-content:center;margin-top:30px}
.pill{display:inline-flex;align-items:center;gap:10px;margin-bottom:26px;padding:7px 8px 7px 14px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--bg) 55%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);text-decoration:none;font-size:14px;transition:border-color .3s,transform .4s var(--ease)}
.pill:hover{border-color:color-mix(in srgb,var(--ink) 40%,transparent);transform:translateY(-1px)}
.pill .status{border:0;background:transparent;padding:0;margin:0;font-weight:500}
.pill em{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:color-mix(in srgb,var(--ink) 10%,transparent);color:var(--ink)}
.pill em svg{width:13px;height:13px}
.arc-panel{position:relative;z-index:2;width:min(1220px,100%);margin-top:clamp(36px,5.5vw,84px);margin-bottom:-150px;display:grid;grid-template-columns:230px minmax(0,1fr);border:1px solid color-mix(in srgb,var(--ink) 16%,transparent);border-radius:24px 24px 0 0;background:linear-gradient(180deg,color-mix(in srgb,var(--bg2) 92%,transparent),color-mix(in srgb,var(--bg) 96%,transparent));box-shadow:0 -20px 80px -30px color-mix(in srgb,var(--ac) 45%,transparent),var(--shadow);overflow:hidden;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.arc-panel::before{content:"";position:absolute;inset:0 0 auto 0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--ac) 80%,#fff),transparent);opacity:.9}
.hero.arc::after{content:"";position:absolute;left:0;right:0;bottom:0;height:150px;z-index:3;pointer-events:none;background:linear-gradient(180deg,transparent,var(--bg))}
.ap-ribbon{position:absolute;left:0;right:0;top:0;height:5px;z-index:2;opacity:.95}
.ap-ribbon.pole{background:repeating-linear-gradient(115deg,#d92f2f 0 14px,#f4f4f4 14px 28px,#2d5fd0 28px 42px,#f4f4f4 42px 56px);background-size:112px 100%;animation:poleMove 7s linear infinite}
.ap-ribbon.checker{background:conic-gradient(#d92f2f 25%,#f4f1ea 0 50%,#d92f2f 0 75%,#f4f1ea 0) 0 0/10px 10px}
.ap-ribbon.stripe{background:repeating-linear-gradient(-45deg,#f5c518 0 10px,#15151a 10px 20px)}
@keyframes poleMove{to{background-position:112px 0}}
.ap-side{padding:22px 16px 28px 18px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
.ap-brand{display:flex;align-items:center;gap:10px;font:${dw} 17px/1.1 var(--fd);margin-bottom:18px}
.ap-brand i{font-style:normal;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--ac);color:var(--bg);font-weight:700;flex:0 0 auto}
.ap-brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ap-label{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--mu);margin-bottom:4px}
.ap-side ul{list-style:none;display:grid;gap:4px}
.ap-side li{padding:10px 12px;border-radius:10px;font-size:14.5px;color:var(--mu);border:1px solid transparent}
.ap-side li.on{color:var(--ink);background:color-mix(in srgb,var(--ac) 14%,transparent);border-color:color-mix(in srgb,var(--ac) 40%,transparent);box-shadow:inset 3px 0 0 var(--ac)}
.ap-where{margin-top:auto;padding-top:20px;font-size:12.5px;color:var(--mu)}
.ap-main{padding:22px clamp(16px,2vw,28px) 0}
.ap-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.ap-head h2{font:${dw} calc(26px * var(--ts))/1.1 var(--fd);letter-spacing:-.01em}
.ap-sub{margin-top:6px;font-size:14px;color:var(--mu)}.ap-sub b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.ap-grid{display:grid;grid-template-columns:1.25fr 1fr 1fr;grid-auto-rows:minmax(150px,auto);gap:14px}
.ap-media{grid-row:span 2;position:relative;min-height:300px}
.ap-media .ph,.ap-media .stage{height:100%;min-height:300px;border-radius:16px;box-shadow:none}
.ap-media .stage{position:relative;inset:auto;aspect-ratio:auto;width:100%}
.spl{position:relative;height:100%;min-height:300px;border-radius:16px;overflow:hidden;background:radial-gradient(70% 60% at 50% 42%,color-mix(in srgb,var(--ink) 10%,var(--bg2)),var(--bg2) 72%)}
.spl-fallback{position:absolute;inset:0;transition:opacity 1.1s}.spl-fallback .ph{border-radius:0;box-shadow:none}
.spl spline-viewer{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1.1s;transform:translateY(calc(var(--sp,0) * -16px)) rotate(calc(var(--sp,0) * 1.6deg))}
.spl[data-spline-state=live] spline-viewer{opacity:1}.spl[data-spline-state=live] .spl-fallback,.spl[data-spline-state=live] .spl-load{opacity:0}
.spl-load{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);font-size:12px;color:#fff;background:rgba(0,0,0,.5);padding:5px 11px;border-radius:999px;display:none;transition:opacity .4s}
.spl[data-spline-state=loading] .spl-load{display:block}
.ap-media[data-tilt-media]{perspective:1100px}
.ap-media[data-tilt-media] .ph{transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .4s var(--ease);transform-style:preserve-3d;will-change:transform}
.ap-media[data-tilt-media] .ph img{transform:translate(var(--tx,0px),var(--ty,0px));transition:transform .6s var(--ease);animation:drift 14s ease-in-out infinite alternate}
.ap-media[data-tilt-media] .ph::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at var(--mx,30%) var(--my,18%),rgba(255,255,255,.26),transparent 46%);mix-blend-mode:soft-light;transition:background-position .3s}
@keyframes drift{from{scale:1.06}to{scale:1.15}}
.ap-card{display:flex;flex-direction:column;gap:6px;padding:18px 18px 20px;border-radius:16px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 4%,var(--bg2));text-decoration:none;color:var(--ink);font-size:15px;min-width:0}
.ap-card>span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--mu)}
.ap-card p{font-weight:600;overflow-wrap:anywhere;line-height:1.35}.ap-card p small{display:block;font-weight:400;color:var(--mu);font-size:12px}
.ap-card a{margin-top:auto;font-size:13.5px;color:var(--ac);text-decoration:none;font-weight:600}
.ap-card.hot{grid-column:span 2;justify-content:space-between;background:linear-gradient(135deg,var(--ac),color-mix(in srgb,var(--ac2) 55%,var(--ac)));color:var(--bg);border-color:transparent;position:relative;overflow:hidden;transition:transform .5s var(--ease),box-shadow .5s}
.ap-card.hot::before{content:"";position:absolute;inset:-40% -20% auto auto;width:70%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.35),transparent 65%);pointer-events:none}
.ap-card.hot>span{color:color-mix(in srgb,var(--bg) 70%,transparent)}
.ap-card.hot b{font:${dw} calc(clamp(24px,2.4vw,34px) * var(--ts))/1.1 var(--fd);letter-spacing:-.01em}
.ap-card.hot em{position:absolute;right:18px;bottom:18px;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--bg);color:var(--ink);transition:transform .5s var(--ease)}
.ap-card.hot:hover{transform:translateY(-3px);box-shadow:0 24px 50px -22px var(--ac)}.ap-card.hot:hover em{transform:translateX(4px) rotate(-45deg)}
/* botões: troca de letras, seta em círculo e preenchimento em círculo */
.btn.roll{overflow:hidden;isolation:isolate;gap:10px}
.btn.roll .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.rl{display:inline-flex;white-space:pre}
.rl i{position:relative;display:inline-block;overflow:hidden;height:1.25em;line-height:1.25em;font-style:normal;vertical-align:top}
.rl i span{display:block;transition:transform .5s var(--ease);transition-delay:calc(var(--i) * 14ms)}
.rl i::after{content:attr(data-c);position:absolute;left:0;top:100%;transition:transform .5s var(--ease);transition-delay:calc(var(--i) * 14ms)}
.btn.roll:hover .rl i span,.btn.roll:hover .rl i::after{transform:translateY(-100%)}
.btn.hero-primary{background:var(--ink);color:var(--bg);border-color:var(--ink);padding-right:8px}
.btn.hero-primary .ar{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--bg);color:var(--ink);transition:transform .5s var(--ease)}
.btn.hero-primary:hover .ar{transform:translateX(3px)}
.btn.roll:active{transform:scale(.97)!important}
.btn.roll.ghost{z-index:0;background:color-mix(in srgb,var(--bg) 40%,transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:color .5s var(--ease),border-color .5s,transform .3s}
.btn.roll.ghost::before{content:"";position:absolute;z-index:-1;left:50%;top:70%;width:170%;aspect-ratio:1;border-radius:50%;background:var(--ink);transform:translate(-50%,0) scale(0);transition:transform .7s var(--ease),top .7s var(--ease)}
.btn.roll.ghost:hover{color:var(--bg);border-color:var(--ink)}.btn.roll.ghost:hover::before{top:-60%;transform:translate(-50%,0) scale(1)}
.hero-copy{position:relative;z-index:2}
.cinema{position:relative;display:flex;align-items:flex-end}
.stage{inset:0;border-radius:var(--r);background:radial-gradient(70% 60% at 50% 42%,color-mix(in srgb,var(--ink) ${ivory ? 6 : 11}%,var(--bg2)),var(--bg2) 72%);overflow:hidden;box-shadow:var(--shadow)}
.hero.stage .layer.stage{inset:4% 0 0 14%}
.stage canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.2s}
.stage.is-ready canvas{opacity:1}
.stage-fallback{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .8s}
.stage.is-ready .stage-fallback,.stage.is-ready .stage-loading{opacity:0}
.stage-loading{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);font-size:12px;color:var(--mu);background:var(--bg);padding:6px 12px;border-radius:999px;transition:opacity .4s}
.stage.is-failed .stage-loading{display:none}
.cinema{display:flex;align-items:flex-end;max-width:none;min-height:100svh;margin-top:-76px;padding-top:120px;padding-bottom:clamp(56px,9vh,110px);color:#fff;overflow:hidden}
.cinema .hero-copy{position:relative;z-index:2;max-width:880px}
.cinema .eyebrow,.cinema .eyebrow span{color:#fff}.cinema .lede,.cinema .facts dt{color:rgba(255,255,255,.82)}
.cinema .hero-meta{border-color:rgba(255,255,255,.22)}.cinema .status{background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.25);color:#fff}
.cine-bg{position:absolute;inset:-8% 0;will-change:transform}.cine-bg img{width:100%;height:100%;object-fit:cover;animation:settle 2.4s var(--ease) both}
.cine-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.15) 35%,rgba(0,0,0,.35) 60%,rgba(0,0,0,.82) 100%)}
.cinema .btn.ghost{background:rgba(0,0,0,.32);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-color:rgba(255,255,255,.45)}
.cinema .lede{text-shadow:0 1px 14px rgba(0,0,0,.55)}
.cine-cap{position:absolute;right:16px;bottom:12px;z-index:2;font-size:11.5px;color:rgba(255,255,255,.75);max-width:60%;text-align:right}.cine-cap a{color:inherit}
.scroll-cue{position:absolute;left:50%;bottom:22px;z-index:2;width:26px;height:42px;border:2px solid rgba(255,255,255,.6);border-radius:14px;transform:translateX(-50%)}
.scroll-cue span{position:absolute;left:50%;top:8px;width:4px;height:8px;margin-left:-2px;border-radius:2px;background:#fff;animation:cue 1.8s infinite}
@keyframes cue{0%{opacity:0;transform:translateY(0)}30%{opacity:1}100%{opacity:0;transform:translateY(14px)}}
/* faixa */
.marquee{overflow:hidden;border-block:1px solid var(--line);padding:18px 0;background:var(--bg2)}
.mq-track{display:flex;width:max-content;animation:mq ${motion === "calm" ? 60 : 38}s linear infinite}
.marquee:hover .mq-track{animation-play-state:paused}
.mq-track span{display:flex;align-items:center;gap:28px;padding-right:28px;font:${dw} calc(clamp(22px,2.4vw,34px) * var(--ts))/1 var(--fd);white-space:nowrap}
.mq-track i{font-style:normal;color:var(--ac);font-size:.6em}
@keyframes mq{to{transform:translateX(-50%)}}
/* seções */
.sec{max-width:1520px;margin:0 auto;padding:clamp(72px,9vw,140px) var(--gut)}
.sec-head{max-width:780px;margin-bottom:clamp(32px,4vw,56px)}
.cards{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(14px,1.6vw,22px)}
.card{position:relative;display:flex;flex-direction:column;border-radius:var(--r);background:var(--card);border:1px solid var(--line);overflow:hidden;transition:border-color .3s,transform .5s var(--ease),box-shadow .5s;transform-style:preserve-3d;will-change:transform}
.card:hover{border-color:color-mix(in srgb,var(--ac) 55%,transparent);box-shadow:var(--shadow)}
.card-img{aspect-ratio:16/10;overflow:hidden}.card-img img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease)}.card:hover .card-img img{transform:scale(1.05)}
.card-body{padding:26px 26px 30px}
.card .num{display:block;font:500 14px/1 var(--fb);color:var(--ac);letter-spacing:.1em;margin-bottom:22px}
.card h3{font:${dw} calc(23px * var(--ts))/1.2 var(--fd);letter-spacing:-.01em;margin-bottom:10px}
.card p{color:var(--mu);font-size:16px}
.rail{position:relative;height:calc(100svh + var(--n) * 34vh)}
.rail-sticky{position:sticky;top:0;height:100svh;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding:80px 0 40px}
.rail .sec-head{padding:0 var(--gut);margin-bottom:28px}
.rail-track{list-style:none;display:flex;gap:clamp(14px,1.6vw,24px);padding:0 var(--gut);width:max-content;will-change:transform}
.rail-track .card{width:clamp(280px,30vw,420px);flex:0 0 auto;min-height:clamp(300px,48vh,480px);background:linear-gradient(160deg,color-mix(in srgb,var(--ac) 9%,var(--card)),var(--card) 55%)}
.rail-track .card-body{display:flex;flex-direction:column;flex:1;padding:30px 30px 34px}
.rail-track .card .num{font:${dw} clamp(56px,6vw,96px)/1 var(--fd);color:transparent;-webkit-text-stroke:1px var(--ac);letter-spacing:-.02em;margin-bottom:auto}
.rail-track .card-img+.card-body .num{font-size:15px;color:var(--ac);-webkit-text-stroke:0;margin-bottom:18px}
.rail-track .card h3{font-size:calc(clamp(24px,2.2vw,32px) * var(--ts));margin-top:28px}
.rail-bar{margin:28px var(--gut) 0;height:2px;background:var(--line);border-radius:2px;overflow:hidden;max-width:420px}.rail-bar i{display:block;height:100%;width:100%;background:var(--ac);transform-origin:0 50%;transform:scaleX(var(--rp,0))}
.menu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:clamp(20px,3vw,48px)}
.menu-cat h3{font:${dw} calc(24px * var(--ts))/1.2 var(--fd);padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:6px}
.menu-cat ul{list-style:none}.menu-cat li{display:grid;grid-template-columns:1fr auto;gap:2px 16px;padding:12px 0;border-bottom:1px dashed var(--line)}
.mi-name{font-weight:600}.mi-price{color:var(--ac);font-weight:600;font-variant-numeric:tabular-nums}.mi-desc{grid-column:1/-1;color:var(--mu);font-size:15px}
.about{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,96px);align-items:center}
.about.no-media{grid-template-columns:1fr;max-width:1000px}
.about-media .ph{aspect-ratio:4/4.4;height:auto}
.about-media .ph img{height:115%;will-change:transform}
.reveal{clip-path:inset(12% 8% 12% 8% round var(--r));opacity:.2;transition:clip-path 1.3s var(--ease),opacity 1.1s var(--ease)}
.reveal.in{clip-path:inset(0 0 0 0 round var(--r));opacity:1}
.stats{padding-top:0}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:28px}
.nums b{font:${dw} clamp(44px,5vw,76px)/1 var(--fd)}.nums small{color:var(--ac);margin-left:6px;font-weight:600}.nums dd{color:var(--mu)}.src{display:block;font-size:12px;opacity:.75}
.gal-cols{display:grid;gap:clamp(10px,1.4vw,20px)}.gal-cols.c2{grid-template-columns:1fr 1fr}.gal-cols.c3{grid-template-columns:1fr 1fr 1fr}
.gal-col{display:grid;gap:clamp(10px,1.4vw,20px);align-content:start;will-change:transform}
.gal-col:nth-child(2){margin-top:12%}
.gal-col .ph{aspect-ratio:4/5;height:auto}.gal-col>div:nth-child(2n) .ph{aspect-ratio:4/3}
.gal-col .ph img{transition:transform 1.4s var(--ease)}.gal-col .ph:hover img{transform:scale(1.04)}
.visit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(14px,2vw,24px)}
.panel{padding:clamp(24px,3vw,38px);border-radius:var(--r);background:var(--card);border:1px solid var(--line)}
.panel h3{font:${dw} calc(23px * var(--ts))/1.2 var(--fd);margin-bottom:18px}
.hours div{display:flex;justify-content:space-between;gap:16px;padding:12px 10px;margin:0 -10px;border-bottom:1px solid var(--line);border-radius:8px;transition:background .3s}
.hours div.is-today{background:color-mix(in srgb,var(--ac) 14%,transparent);border-bottom-color:transparent}
.hours div.is-today dt{color:var(--ink);font-weight:600}.hours div.is-today dt::after{content:" · hoje";color:var(--ac);font-weight:600}
.hours dt{color:var(--mu)}.hours dd{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.note{font-size:13.5px;color:var(--mu);margin-top:14px}
.addr{font-size:18px;margin-bottom:18px;max-width:40ch}
.contacts{list-style:none;display:grid;margin-top:24px}
.contacts li{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}
.contacts span{color:var(--mu);font-size:14px}.contacts a{font-weight:600;text-decoration:none;text-align:right}.contacts a:hover{color:var(--ac)}
.final{position:relative;overflow:hidden;margin:0 auto clamp(48px,6vw,96px);width:calc(100% - 2 * var(--gut));max-width:1480px;border-radius:calc(var(--r) + 6px);background:${ivory ? "var(--ink)" : "var(--bg2)"};color:${ivory ? "var(--bg)" : "var(--ink)"};padding:clamp(64px,9vw,140px) clamp(24px,6vw,96px);text-align:center}
.final-bg{position:absolute;inset:-12% 0;will-change:transform}.final-bg img{width:100%;height:100%;object-fit:cover;opacity:.38}
.final.has-photo{color:#fff}.final.has-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.4),rgba(0,0,0,.7))}
.final-copy{position:relative;z-index:1;max-width:820px;margin:0 auto}
.final .lede{margin-inline:auto;color:inherit;opacity:.86}.final .acts{justify-content:center}
footer{padding:48px var(--gut) 96px;border-top:1px solid var(--line);color:var(--mu);font-size:13px;display:grid;gap:8px;max-width:1520px;margin:0 auto}
footer .f-brand{font:${dw} 22px/1.2 var(--fd);color:var(--ink);margin-bottom:6px}
footer ul{list-style:none;display:grid;gap:4px}footer a{color:var(--mu)}
.dock{display:none}
${ivory ? "" : `body::after{content:"";position:fixed;inset:0;z-index:50;pointer-events:none;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}`}
/* revelação discreta */
.rv{opacity:0;transform:translateY(26px);transition:opacity .9s var(--ease),transform .9s var(--ease);transition-delay:calc(var(--d,0) * 90ms)}
.rv.in,.no-js .rv,.no-js .reveal{opacity:1;transform:none;clip-path:none}
.no-js .split .w>span{transform:none}
@media (max-width:1100px){.top .status{display:none}}
@media (max-width:980px){
  .nav,.top>.btn{display:none}.menu{display:block}
  .hero,.about{grid-template-columns:1fr}
  .hero{min-height:0;padding-top:20px;gap:30px}
  .hero .hero-media{order:-1;min-height:0}
  .hero.media-left .hero-copy{order:0}
  .layer{position:relative}.layer.back{display:none}.layer.front,.media-left .layer.front,.hero.stage .layer.stage{inset:auto}
  .layer.front .ph{aspect-ratio:4/3;height:auto}
  .hero.stage .layer.stage{aspect-ratio:1/1;width:100%}
  .mosaic{min-height:0;grid-template-rows:auto auto}.mosaic .ph{aspect-ratio:4/5;height:auto}.mosaic .t0 .ph{aspect-ratio:auto;height:100%}.mosaic .t1,.mosaic .t2{margin:0}
  .cinema{min-height:92svh;margin-top:-70px}
  .cine-shade{background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,.45) 40%,rgba(0,0,0,.55) 65%,rgba(0,0,0,.88) 100%)}
  .scroll-cue{display:none}.cinema{padding-bottom:72px}.cine-cap{left:16px;right:16px;bottom:12px;max-width:none;text-align:left}
  .rail{height:auto}.rail-sticky{position:relative;height:auto;padding:72px 0}
  .rail-track{width:auto;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px;transform:none!important;scrollbar-width:none}.rail-track::-webkit-scrollbar{display:none}
  .rail-track .card{width:78vw;scroll-snap-align:start}
  .rail-bar{display:none}
  .about-media{order:-1}
  .dock{position:fixed;left:12px;right:12px;bottom:12px;z-index:35;display:flex;gap:8px;padding:8px;border-radius:999px;background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid var(--line);box-shadow:var(--shadow);transform:translateY(140%);transition:transform .45s var(--ease)}
  .dock.show{transform:none}
  .dock a{flex:1;display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px}
  .dock .dock-main{background:var(--ac);color:var(--bg)}
}
@media (max-width:980px){
  .hero.arc{min-height:0;padding-top:28px}
  .arc-panel{grid-template-columns:1fr;margin-bottom:-120px}
  .ap-side{display:none}
  .ap-grid{grid-template-columns:1fr 1fr;grid-auto-rows:auto}
  .ap-media{grid-column:1/-1;grid-row:auto;min-height:0}.ap-media .ph,.ap-media .stage{min-height:0;aspect-ratio:4/3;height:auto}
  .ap-card.hot{grid-column:1/-1;min-height:120px}
}
@media (max-width:640px){
  .arc-copy .h1{font-size:calc(clamp(34px,10.5vw,52px) * var(--ts))}
  .pill{font-size:13px}
  .ap-grid{grid-template-columns:1fr}
  .arc-panel{border-radius:20px 20px 0 0}
  body{font-size:16px}
  .brand{max-width:58vw;font-size:17px}
  .acts .btn{flex:1 1 100%}
  .hero-meta{flex-direction:column;align-items:flex-start}
  .gal-cols.c3{grid-template-columns:1fr 1fr}.gal-cols.c3 .gal-col:nth-child(3){display:contents}
  .gal-col:nth-child(2){margin-top:18%}
  .contacts li,.hours div{flex-direction:column;gap:2px}.contacts a,.hours dd{text-align:left}
}
@media (prefers-reduced-motion:reduce){
  .ap-media[data-tilt-media] .ph img{animation:none;scale:1}.ap-media[data-tilt-media] .ph{transform:none}.spl spline-viewer{transition:none}
  .ap-ribbon.pole{animation:none}.btn.roll .rl i span,.btn.roll .rl i::after{transition:none}
  html{scroll-behavior:auto}.rv,.reveal{opacity:1;transform:none;clip-path:none;transition:none}
  .split .w>span{transform:none;transition:none}.layer.front .ph img,.cine-bg img{animation:none}
  .mq-track{animation:none}.status.is-open i{animation:none}.scroll-cue span{animation:none}
  .rail{height:auto}.rail-sticky{position:relative;height:auto}.rail-track{width:auto;flex-wrap:wrap}.rail-track .card{width:clamp(260px,30vw,420px)}
}
</style>
</head>
<body class="no-js${kind === "cinema" ? " on-cinema" : ""}">
${opts.previewRibbon ? `<div class="ribbon">${esc(opts.previewRibbon)}</div>` : ""}
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<div class="progress" aria-hidden="true"></div>
<header class="top"><a class="brand" href="#${esc(hero?.id ?? "inicio")}">${esc(brand)}</a><nav class="nav" aria-label="Seções">${nav}</nav>${statusPill()}${mainBtn ? button(mainBtn, c, "btn") : ""}<details class="menu"><summary>Menu</summary><nav aria-label="Seções">${nav}${mainBtn ? button(mainBtn, c, "") : ""}</nav></details></header>
<main id="conteudo">
${heroHtml}
${marquee}
${parts.join("\n")}
</main>
<footer>
  <p class="f-brand">${esc(brand)}</p>
  <p>${b.address ? esc(b.address) : ""}</p>
  ${credits.length ? `<ul>${credits.map((i) => `<li>${imageCaption(i, "span") || "Imagem: " + esc(i.alt)}</li>`).join("")}</ul>` : ""}
  ${credits.some((i) => i.origin === "stock") ? "<p>Fotos ilustrativas de bancos de imagens livres: não são fotos da empresa.</p>" : ""}
  ${splineUrl ? `<p>Cena 3D interativa criada no <a href="https://spline.design" target="_blank" rel="noopener noreferrer">Spline</a>, ilustrativa (não é produto da empresa).</p>` : ""}
  ${assetInfo ? `<p>Modelo 3D escaneado de um objeto real: ${esc(assetInfo.label)}, por ${esc(assetInfo.authors)} (Poly Haven, CC0), <a href="${esc(assetInfo.url)}" target="_blank" rel="noopener noreferrer">fonte</a>. Ilustrativo, não é produto da empresa.</p>` : ""}
  ${schedule ? `<p>Status de aberto/fechado calculado pelo horário publicado, no fuso ${esc(tz!)}; feriados não são considerados.</p>` : ""}
  <p>© ${new Date().getFullYear()} ${esc(b.name)}</p>
  ${opts.footerCredit ? `<p>Site criado com SiteHunter AI</p>` : ""}
</footer>
${dock.length ? `<nav class="dock" aria-label="Contato rápido">${dock.join("")}</nav>` : ""}
<script>var __name=function(f){return f};(${motionRuntime.toString()})(${JSON.stringify({ amp })});</script>
${splineUrl ? `<script>var __name=function(f){return f};window.addEventListener("DOMContentLoaded",function(){(${splineRuntime.toString()})(${JSON.stringify({ src: SPLINE_VIEWER_SRC, url: splineUrl, skip: "" })});});</script>` : ""}
${kind === "arc" ? `<script>var __name=function(f){return f};window.addEventListener("DOMContentLoaded",function(){(${arcRuntime.toString()})(${JSON.stringify(arcCfg)});});</script>` : ""}
${schedule && tz ? `<script>var __name=function(f){return f};(${hoursRuntime.toString()})(${JSON.stringify({ schedule, tz })});</script>` : ""}
${cfg3d ? `<script src="${esc(threeSrc)}" defer></script>
<script src="${esc(vendor("GLTFLoader.js"))}" defer></script>
<script src="${esc(vendor("RGBELoader.js"))}" defer></script>
<script>var __name=function(f){return f};window.addEventListener("DOMContentLoaded",function(){(${realRuntime.toString()})(${JSON.stringify(cfg3d).replace(/</g, "\\u003c")});});</script>` : ""}
</body>
</html>`;
}

/**
 * Movimento da página (serializado no site): revelações, parallax por rolagem e mouse, trilho horizontal
 * fixado, barra de progresso, cabeçalho compacto, botões magnéticos, cartões com inclinação e barra fixa
 * de contato no celular. Só transform/opacity, um laço de animação, nada roda com "reduzir movimento".
 */
export function motionRuntime(cfg: { amp: number }) {
  var d = document, w = window, body = d.body;
  body.classList.remove("no-js");
  var reduce = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = w.matchMedia && w.matchMedia("(hover: none)").matches;
  requestAnimationFrame(function () { body.classList.add("ready"); });
  // revelações
  var rv = d.querySelectorAll(".rv,.reveal");
  if ("IntersectionObserver" in w && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    rv.forEach(function (e) { io.observe(e); });
  } else rv.forEach(function (e) { e.classList.add("in"); });
  // menu do celular fecha ao escolher
  d.querySelectorAll(".menu nav a").forEach(function (a) { a.addEventListener("click", function () { var dt = a.closest("details"); if (dt) dt.removeAttribute("open"); }); });
  // imagem quebrada some
  d.querySelectorAll("main img").forEach(function (i) {
    var img = i as HTMLImageElement;
    function x() { var f = img.closest(".tile,.layer.back,.gal-col>div,.card-img,.final-bg,.about-media"); if (f && !img.classList.contains("stage-fallback")) f.remove(); }
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) x(); else img.addEventListener("error", x);
  });
  var top = d.querySelector(".top"), prog = d.querySelector(".progress") as HTMLElement | null, dock = d.querySelector(".dock");
  var hero = d.querySelector(".hero") as HTMLElement | null;
  var par = Array.prototype.slice.call(d.querySelectorAll("[data-par]")) as HTMLElement[];
  var parIn = Array.prototype.slice.call(d.querySelectorAll("[data-par-inner]")) as HTMLElement[];
  var depth = Array.prototype.slice.call(d.querySelectorAll("[data-depth]")) as HTMLElement[];
  var rail = d.querySelector("[data-rail]") as HTMLElement | null, track = d.querySelector("[data-rail-track]") as HTMLElement | null, rbar = d.querySelector("[data-rail-bar]") as HTMLElement | null;
  // frase de destaque: acende uma palavra por vez com a rolagem (tudo aceso sem JS ou com movimento reduzido)
  var stm = d.querySelector("[data-stmt]") as HTMLElement | null, sws = stm ? Array.prototype.slice.call(stm.querySelectorAll(".sw")) as HTMLElement[] : [];
  function stmtUpdate() {
    if (!stm) return;
    var r = stm.getBoundingClientRect(), vh = w.innerHeight, p = (vh * 0.85 - r.top) / (vh * 0.55 + r.height * 0.3);
    p = Math.max(0, Math.min(1, p));
    var n = Math.round(p * sws.length);
    sws.forEach(function (s, i) { s.classList.toggle("on", i < n); });
  }
  if (stm && !reduce) { stm.classList.add("stmt-js"); stmtUpdate(); w.addEventListener("scroll", stmtUpdate, { passive: true }); w.addEventListener("resize", stmtUpdate, { passive: true }); }
  // consulta rápida: monta a mensagem e atualiza o link do contato da empresa (o visitante toca para enviar)
  var askEl = d.querySelector("[data-ask]") as HTMLElement | null;
  if (askEl) {
    var go = askEl.querySelector("[data-ask-go]") as HTMLAnchorElement, pv = askEl.querySelector("[data-ask-preview]") as HTMLElement;
    var via = askEl.getAttribute("data-via"), biz = askEl.getAttribute("data-biz") || "";
    var baseHref = go.getAttribute("href") || "";
    var upd = function () {
      var f = function (k: string) { var i = askEl!.querySelector('[data-f="' + k + '"]') as HTMLInputElement; return i ? i.value.trim() : ""; };
      var lab = askEl!.querySelector('[data-f="extra"]')!.parentElement!.querySelector("span")!.textContent || "";
      var parts = ["Olá! Vim pelo site da " + biz + "."];
      if (f("veiculo")) parts.push("Veículo: " + f("veiculo") + (f("ano") ? " (" + f("ano") + ")" : "") + ".");
      else if (f("ano")) parts.push("Ano: " + f("ano") + ".");
      if (f("extra")) parts.push(lab.replace(/\s*\(opcional\)/, "").replace(/\?$/, "") + ": " + f("extra") + ".");
      var msg = parts.join(" ");
      pv.textContent = msg;
      if (via === "wa") go.href = baseHref + "?text=" + encodeURIComponent(msg);
      else if (via === "mail") go.href = baseHref + "?subject=" + encodeURIComponent("Consulta pelo site") + "&body=" + encodeURIComponent(msg);
    };
    askEl.addEventListener("input", upd); upd();
  }
  var mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
  if (!reduce && !touch && hero) hero.addEventListener("pointermove", function (e) { var r = hero!.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick(); }, { passive: true });
  if (hero) hero.addEventListener("pointerleave", function () { tx = 0; ty = 0; kick(); });
  // foto em profundidade: inclina para o ponteiro, luz que acompanha e deslocamento da imagem (só com mouse)
  var tm = d.querySelector("[data-tilt-media]") as HTMLElement | null;
  if (tm && hero && !reduce && !touch) {
    hero.addEventListener("pointermove", function (e) {
      var r = tm!.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      x = Math.max(-0.4, Math.min(1.4, x)); y = Math.max(-0.4, Math.min(1.4, y));
      tm!.style.setProperty("--rx", ((0.5 - y) * 7 * cfg.amp).toFixed(2) + "deg");
      tm!.style.setProperty("--ry", ((x - 0.5) * 9 * cfg.amp).toFixed(2) + "deg");
      tm!.style.setProperty("--tx", ((0.5 - x) * 14 * cfg.amp).toFixed(1) + "px");
      tm!.style.setProperty("--ty", ((0.5 - y) * 10 * cfg.amp).toFixed(1) + "px");
      tm!.style.setProperty("--mx", (x * 100).toFixed(0) + "%"); tm!.style.setProperty("--my", (y * 100).toFixed(0) + "%");
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { ["--rx", "--ry", "--tx", "--ty"].forEach(function (p) { tm!.style.removeProperty(p); }); });
  }
  // botões magnéticos e cartões com inclinação (só com mouse)
  if (!reduce && !touch) {
    d.querySelectorAll(".btn.mag").forEach(function (el) {
      var b = el as HTMLElement;
      b.addEventListener("pointermove", function (e) { var r = b.getBoundingClientRect(); b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * 0.18) + "px," + ((e.clientY - r.top - r.height / 2) * 0.28) + "px)"; });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
    d.querySelectorAll("[data-tilt-card]").forEach(function (el) {
      var c = el as HTMLElement;
      c.addEventListener("pointermove", function (e) { var r = c.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; c.style.transform = "perspective(900px) rotateX(" + (-y * 6) + "deg) rotateY(" + (x * 8) + "deg) translateY(-4px)"; });
      c.addEventListener("pointerleave", function () { c.style.transform = ""; });
    });
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    var vh = w.innerHeight, sy = w.scrollY, docH = d.documentElement.scrollHeight - vh;
    if (prog) prog.style.setProperty("--p", String(docH > 0 ? sy / docH : 0));
    if (top) top.classList.toggle("solid", sy > 40);
    if (dock) dock.classList.toggle("show", sy > vh * 0.6);
    if (!reduce) {
      mx += (tx - mx) * 0.08; my += (ty - my) * 0.08;
      par.forEach(function (el) {
        var r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) return;
        var k = parseFloat(el.getAttribute("data-par") || "0") * cfg.amp;
        el.style.transform = "translate3d(0," + (((r.top + r.height / 2) - vh / 2) * k).toFixed(1) + "px,0)";
      });
      parIn.forEach(function (el) {
        var img = el.querySelector("img") as HTMLElement | null; if (!img) return;
        var r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
        var k = parseFloat(el.getAttribute("data-par-inner") || "0") * cfg.amp;
        img.style.transform = "translate3d(0," + (((r.top + r.height / 2) - vh / 2) * -k - r.height * 0.07).toFixed(1) + "px,0)";
      });
      if (!touch) depth.forEach(function (el) {
        var k = parseFloat(el.getAttribute("data-depth") || "0") * cfg.amp * 26;
        var base = el.style.getPropertyValue("--base") || "";
        el.style.translate = (mx * k).toFixed(1) + "px " + (my * k).toFixed(1) + "px";
        void base;
      });
      if (rail && track && w.innerWidth > 980) {
        var rr = rail.getBoundingClientRect();
        var total = rr.height - vh, pr = Math.min(1, Math.max(0, -rr.top / (total || 1)));
        var dist = Math.max(0, track.scrollWidth - w.innerWidth);
        track.style.transform = "translate3d(" + (-pr * dist).toFixed(1) + "px,0,0)";
        if (rbar) rbar.style.setProperty("--rp", pr.toFixed(3));
      }
      if (Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002) kick();
    }
  }
  w.addEventListener("scroll", kick, { passive: true });
  w.addEventListener("resize", kick, { passive: true });
  frame();
}
