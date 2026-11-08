import type { Archetype, Step } from "../direction";

// Arquétipos de página: cada um troca a estrutura (abertura, lista de serviços, galeria, ritmo de seções),
// não só cores. O renderer monta os dados uma vez e entrega pedaços de HTML prontos a estas funções.

export type Svc = { title: string; description: string };
export type ArchCtx = {
  esc: (s: string) => string;
  heroId: string;
  proposal: string;
  wordsHtml: string;
  brandFull: string;
  brand: string;
  lede: string;
  where: string;
  pill: string;
  acts: string;
  media: string;
  bgPic: string;
  caption: string;
  statusHtml: string;
  todayStr: string;
  address: string | null;
  mapsHref: string;
  contacts: { t: string; v: string }[];
  niche: { label: string; panelTitle: string; panelCta: string; chips: string[] };
  svcItems: Svc[];
  steps: Step[];
  seed: number;
  layout: string;
  hasPhoto: boolean;
  arrow: string;
  geo?: { lat: number; lng: number } | null;
};

const rom = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const two = (n: number) => String(n + 1).padStart(2, "0");

export function archHero(a: Archetype, c: ArchCtx): string {
  const e = c.esc;
  const h1 = `<h1 id="h-hero" class="h1 split" aria-label="${e(c.proposal)}">${c.wordsHtml}</h1>`;
  const lede = c.lede ? `<p class="lede rv" style="--d:3">${e(c.lede)}</p>` : "";
  const full = c.brandFull ? `<p class="fullname rv" style="--d:3">${e(c.brandFull)}</p>` : "";
  const addrShort = c.address ? e(c.address.split("·").slice(0, 2).join(" ·")) : "";
  switch (a) {
    case "showroom":
      return `<section id="${e(c.heroId)}" class="hx hx-showroom" aria-labelledby="h-hero">
  <div class="hx-bg${c.bgPic ? "" : " none"}" data-par="-0.14" aria-hidden="true">${c.bgPic}</div>
  <div class="hx-shade" aria-hidden="true"></div>
  <div class="hx-in">
    ${c.where ? `<p class="hx-top rv">${e(c.where)}</p>` : ""}
    ${h1}${full}${lede}
    <div class="hx-foot">
      ${c.acts}
      <dl class="hx-facts rv" style="--d:4">
        <div><dt>Hoje</dt><dd>${c.statusHtml}</dd></div>
        ${addrShort ? `<div><dt>Onde</dt><dd>${addrShort}</dd></div>` : ""}
        ${c.contacts[0] ? `<div><dt>${e(c.contacts[0].t)}</dt><dd>${e(c.contacts[0].v)}</dd></div>` : ""}
      </dl>
    </div>
  </div>
  ${c.caption}
</section>`;
    case "display":
      return `<section id="${e(c.heroId)}" class="hx hx-display" aria-labelledby="h-hero">
  ${c.pill}
  <h1 id="h-hero" class="h1 split hx-giant" aria-label="${e(c.proposal)}">${c.wordsHtml}</h1>
  <div class="hx-row${c.layout === "right" ? " flip" : ""}">
    <div class="hx-copy">${full}${lede}${c.acts}</div>
    <div class="hx-card rv" style="--d:2"><div class="hx-media">${c.media}</div></div>
  </div>
  <div class="hx-sticker" aria-hidden="true"><b>${e(c.niche.label)}</b></div>
</section>`;
    case "poster":
      return `<section id="${e(c.heroId)}" class="hx hx-poster${c.layout === "right" ? " flip" : ""}" aria-labelledby="h-hero">
  <div class="hx-text">
    <p class="hx-chap rv"><i aria-hidden="true">I</i><span>${e(c.niche.panelTitle)}</span></p>
    ${h1}${full}${lede}${c.acts}
    <p class="hx-note rv" style="--d:5">${c.statusHtml}</p>
    ${c.niche.chips.length ? `<ul class="hx-chips rv" style="--d:5" aria-label="Tipos de atendimento do ramo">${c.niche.chips.slice(0, 4).map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}
  </div>
  <div class="hx-arch rv" style="--d:2">
    <div class="hx-arch-in">${c.media}</div>
    ${c.where ? `<p class="hx-vert" aria-hidden="true">${e(c.where)}</p>` : ""}
  </div>
</section>`;
    case "plate":
      return `<section id="${e(c.heroId)}" class="hx hx-plate" aria-labelledby="h-hero">
  ${c.pill}
  <div class="hx-disc rv" style="--d:1"><div class="hx-disc-in">${c.media}</div></div>
  ${h1}${full}${lede}${c.acts}
</section>`;
    case "spec":
      return `<section id="${e(c.heroId)}" class="hx hx-spec" aria-labelledby="h-hero">
  <div class="hx-hazard" aria-hidden="true"></div>
  <div class="hx-text">
    <p class="hx-os rv"><span>${e(c.niche.label)}</span>${c.where ? `<span>${e(c.where)}</span>` : ""}</p>
    ${h1}${full}${lede}${c.acts}
    <dl class="hx-cells rv" style="--d:4">
      <div><dt>Hoje</dt><dd>${c.statusHtml}</dd></div>
      ${addrShort ? `<div><dt>Endereço</dt><dd>${addrShort}</dd></div>` : ""}
      ${c.contacts[0] ? `<div><dt>${e(c.contacts[0].t)}</dt><dd>${e(c.contacts[0].v)}</dd></div>` : ""}
      ${c.geo ? `<div><dt>Coordenadas</dt><dd class="mono" title="Posição publicada na fonte dos dados">${c.geo.lat.toFixed(4)}, ${c.geo.lng.toFixed(4)}</dd></div>` : ""}
    </dl>
  </div>
  <aside class="hx-sheet rv" style="--d:2" aria-label="${e(c.niche.panelTitle)}">
    <header><span>${e(c.niche.panelTitle)}</span><b>${c.todayStr ? `Hoje · <span data-today>${e(c.todayStr)}</span>` : "Horário não informado"}</b></header>
    <div class="hx-sheet-media">${c.media}</div>
    <ul>${c.svcItems.slice(0, 5).map((s) => `<li>${e(s.title)}</li>`).join("") || c.niche.chips.slice(0, 5).map((s) => `<li>${e(s)}</li>`).join("")}</ul>
  </aside>
</section>`;
    case "calm":
      return `<section id="${e(c.heroId)}" class="hx hx-calm${c.layout === "right" ? " flip" : ""}" aria-labelledby="h-hero">
  <div class="hx-text">
    ${c.pill}
    ${h1}${full}${lede}${c.acts}
    ${c.niche.chips.length ? `<ul class="hx-chips rv" style="--d:5" aria-label="Tipos de atendimento do ramo">${c.niche.chips.slice(0, 4).map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}
  </div>
  <div class="hx-photo rv" style="--d:2">
    <div class="hx-photo-in">${c.media}</div>
    <div class="hx-float a">${c.statusHtml}</div>
    ${addrShort ? `<a class="hx-float b" href="${e(c.mapsHref)}" target="_blank" rel="noopener noreferrer"><span>Endereço</span>${addrShort} →</a>` : ""}
  </div>
</section>`;
    default:
      return "";
  }
}

/** Lista de serviços do arquétipo (o "arc" mantém o trilho horizontal fixado já existente). */
export function archServices(a: Archetype, id: string, head: string, c: ArchCtx): string {
  const e = c.esc;
  const items = c.svcItems.slice(0, 8);
  const sec = (cls: string, body: string, tag = "section") => `<${tag} id="${e(id)}" class="sec sv ${cls}" aria-labelledby="h-svc">${head}${body}</${tag}>`;
  switch (a) {
    case "showroom":
      return sec("sv-showroom", `<ol class="sv-rows">${items.map((s, n) => `<li class="rv" style="--d:${(n % 3) + 1}"><span class="n">${two(n)}</span><h3>${e(s.title)}</h3><p>${e(s.description)}</p><i aria-hidden="true">${c.arrow}</i></li>`).join("")}</ol>`);
    case "display":
      return sec("sv-display", `<ol class="sv-stack">${items.slice(0, 6).map((s, n) => `<li style="--i:${n}"><span class="big" aria-hidden="true">${two(n)}</span><div><h3>${e(s.title)}</h3><p>${e(s.description)}</p></div></li>`).join("")}</ol>`);
    case "poster":
    case "plate":
      return sec("sv-leaders-wrap", `<ul class="sv-leaders">${items.map((s, n) => `<li class="rv" style="--d:${(n % 3) + 1}"><span class="t">${e(s.title)}</span><i class="dots" aria-hidden="true"></i><span class="r" aria-hidden="true">${rom[n] ?? n + 1}</span><p>${e(s.description)}</p></li>`).join("")}</ul>`);
    case "spec": {
      const grid = `<ol class="sv-grid">${items.map((s, n) => `<li class="rv" style="--d:${(n % 3) + 1}"><span class="code">SV-${two(n)}</span><h3>${e(s.title)}</h3><p>${e(s.description)}</p></li>`).join("")}</ol>`;
      const steps = c.steps.length ? `<div class="steps"><p class="kicker">Como pedir</p><ol>${c.steps.map((s, n) => `<li class="rv" style="--d:${n + 1}"><b>${n + 1}</b><h3>${e(s.t)}</h3><p>${e(s.d)}</p></li>`).join("")}</ol></div>` : "";
      return sec("sv-spec", grid + steps);
    }
    case "calm":
      return sec("sv-calm", `<ul class="sv-soft">${items.map((s, n) => `<li class="rv" style="--d:${(n % 3) + 1}"><span class="ic" aria-hidden="true">${e(s.title.charAt(0).toUpperCase())}</span><h3>${e(s.title)}</h3><p>${e(s.description)}</p></li>`).join("")}</ul>`);
    default:
      return "";
  }
}

export const GALLERY_CLASS: Record<Archetype, string> = { arc: "", showroom: "strip", display: "bento", poster: "", plate: "strip", spec: "bento", calm: "" };
/** Faixa em movimento: só onde combina (energia, oficina); fora nos arquétipos quietos. */
export const WITH_MARQUEE: Record<Archetype, boolean> = { arc: true, showroom: false, display: true, poster: false, plate: false, spec: true, calm: false };

/** Cor de texto legível sobre a cor de destaque (blocos de cor do arquétipo "display"). */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#0b0a09";
  const n = parseInt(m[1]!, 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  return L > 0.35 ? "#0b0a09" : "#ffffff";
}

export function archCss(a: Archetype, dw: number | string, up: boolean): string {
  const caps = up ? "text-transform:uppercase;" : "";
  const common = `@media(max-width:860px){.a-display .about,.a-poster .about,.a-plate .about,.a-spec .about,.a-calm .about,.a-showroom .about{grid-template-columns:1fr}.a-display .about-media,.a-poster .about-media{order:0}.a-poster .about-media .ph{aspect-ratio:4/4.4}}
.hx{position:relative}
.hx .h1{overflow-wrap:break-word}
@keyframes hxspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.hx-disc::before,.hx-sticker{animation:none}.hx-card{transform:none}.gal-strip{scroll-behavior:auto}}`;
  const per: Record<Archetype, string> = {
    arc: "",
    showroom: `.a-showroom .about{grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);gap:clamp(24px,4vw,64px)}
.a-showroom .about-media .ph{aspect-ratio:16/10}.a-showroom .about-copy .h2{${caps}letter-spacing:-.03em}
.a-showroom .stmt-text{text-align:left;max-width:none;margin:0;${caps}font-size:calc(clamp(40px,8.4vw,150px) * var(--ts))}.a-showroom .stmt{place-items:start;padding-inline:var(--gut)}
.a-showroom .top:not(.solid){color:#fff}.a-showroom .top:not(.solid) .nav{color:rgba(255,255,255,.85)}
.hx-showroom{min-height:100svh;margin-top:-76px;display:flex;align-items:flex-end;overflow:hidden;color:#fff}
.hx-bg{position:absolute;inset:-6% 0;will-change:transform}.hx-bg img{width:100%;height:100%;object-fit:cover}
.hx-bg.none{background:radial-gradient(80% 60% at 70% 30%,color-mix(in srgb,var(--ac) 40%,var(--bg)),var(--bg))}
.hx-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,.08) 34%,rgba(0,0,0,.82))}
.hx-showroom .hx-in{position:relative;z-index:2;width:100%;max-width:1520px;margin:0 auto;padding:150px var(--gut) clamp(32px,5vw,64px);display:grid;gap:14px}
.hx-top{font:600 12.5px/1.2 var(--fb);letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.hx-showroom .h1{font-size:calc(clamp(48px,9vw,164px) * var(--ts));line-height:.9;max-width:13ch;${caps}text-shadow:0 4px 50px rgba(0,0,0,.35)}
.hx-showroom .lede{color:rgba(255,255,255,.86);max-width:48ch}.hx-showroom .fullname{color:rgba(255,255,255,.75)}
.hx-showroom .btn.ghost{color:#fff}
.hx-foot{display:flex;flex-wrap:wrap;gap:24px 56px;align-items:flex-end;justify-content:space-between;border-top:1px solid rgba(255,255,255,.3);padding-top:22px;margin-top:18px}
.hx-foot .acts{margin-top:0}
.hx-facts{display:flex;flex-wrap:wrap;gap:20px 40px}.hx-facts dt{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.7}.hx-facts dd{margin:4px 0 0;font-weight:600}
.hx-showroom .status{background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.25);color:#fff;margin:0}
.sv-rows{list-style:none;border-top:1px solid var(--line)}
.sv-rows li{display:grid;grid-template-columns:70px minmax(0,1.1fr) minmax(0,1fr) 36px;gap:24px;align-items:baseline;padding:clamp(22px,3vw,40px) 12px;border-bottom:1px solid var(--line);transition:padding .4s var(--ease),background .3s}
.sv-rows li:hover{padding-left:28px;background:color-mix(in srgb,var(--ac) 9%,transparent)}
.sv-rows .n{font:500 14px var(--fb);color:var(--ac);letter-spacing:.12em}
.sv-rows h3{font:${dw} calc(clamp(26px,3.6vw,54px) * var(--ts))/1 var(--fd);letter-spacing:-.02em;${caps}}
.sv-rows p{color:var(--mu)}.sv-rows i{color:var(--ac);transition:transform .4s var(--ease)}.sv-rows li:hover i{transform:translateX(6px)}
@media(max-width:820px){.a-showroom .about{grid-template-columns:1fr}.sv-rows li{grid-template-columns:44px 1fr;gap:6px 16px}.sv-rows p{grid-column:2}.sv-rows i{display:none}}`,
    display: `.a-display .about{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}.a-display .about-media{transform:rotate(-2.4deg);order:2}.a-display .about-media .ph{aspect-ratio:1;box-shadow:12px 12px 0 var(--ac)}
.a-display .about-copy{order:1}.a-display .about-copy .h2{${caps}font-size:calc(clamp(34px,5.4vw,92px) * var(--ts));line-height:.9}
.a-display .stmt-text{${caps}font-size:calc(clamp(44px,10vw,180px) * var(--ts));line-height:.88;max-width:14ch}.a-display .stmt-js .sw.on{color:var(--ac)}
.a-display .top:not(.solid){color:var(--on-ac);background:var(--ac)}.a-display .top:not(.solid) .brand,.a-display .top:not(.solid) .nav,.a-display .top:not(.solid) .nav a{color:var(--on-ac)}.a-display .top:not(.solid) .nav{opacity:.9}
.a-display .top:not(.solid) .status{background:transparent;border-color:color-mix(in srgb,var(--on-ac) 40%,transparent);color:var(--on-ac)}
.a-display .top:not(.solid) .btn{background:var(--on-ac);color:var(--ac);border-color:var(--on-ac)}
.a-display .top:not(.solid) .menu summary{color:var(--on-ac)}
.hx-display{background:var(--ac);color:var(--on-ac);padding:clamp(20px,3vw,40px) var(--gut) clamp(48px,6vw,96px);overflow:hidden}
.hx-display .pill{border-color:color-mix(in srgb,var(--on-ac) 40%,transparent);color:inherit;background:transparent}.hx-display .pill .status{color:inherit}
.hx-giant{font-size:calc(clamp(52px,12.6vw,232px) * var(--ts));line-height:.84;letter-spacing:-.045em;text-transform:uppercase;max-width:none;margin:8px 0 0}
.hx-display .h1 .w>span{-webkit-text-fill-color:currentColor}
.hx-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.85fr);gap:clamp(20px,4vw,64px);align-items:end;margin-top:clamp(18px,3vw,40px)}
.hx-row.flip{direction:rtl}.hx-row.flip>*{direction:ltr}
.hx-display .lede,.hx-display .fullname{color:color-mix(in srgb,var(--on-ac) 82%,transparent)}
.hx-display .btn.hero-primary{background:var(--on-ac);color:var(--ac);border-color:var(--on-ac)}.hx-display .btn.hero-primary .ar{background:var(--ac);color:var(--on-ac)}
.hx-display .btn.ghost{color:var(--on-ac);background:transparent}
.hx-card{transform:rotate(-3.2deg);transition:transform .6s var(--ease)}.hx-card:hover{transform:rotate(-1deg) scale(1.01)}
.hx-media{border-radius:var(--r);overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.55);aspect-ratio:4/3;background:var(--bg2)}
.hx-media .ph,.hx-media .stage{height:100%;border-radius:0;box-shadow:none;position:relative;inset:auto;aspect-ratio:auto}
.hx-sticker{position:absolute;right:clamp(12px,4vw,64px);top:clamp(70px,9vw,150px);width:clamp(96px,10vw,150px);aspect-ratio:1;border-radius:50%;background:var(--bg);color:var(--ink);display:grid;place-content:center;text-align:center;gap:2px;padding:10px;transform:rotate(12deg);animation:hxspin 40s linear infinite reverse}
.hx-sticker b{font:${dw} clamp(13px,1.3vw,18px)/1.1 var(--fd);${caps}}.hx-sticker span{font-size:11px;color:var(--mu)}
.a-display .marquee{background:var(--ink);color:var(--bg)}
.sv-stack{list-style:none;padding:0;display:block}
.sv-stack li{position:sticky;top:calc(84px + var(--i) * 20px);min-height:clamp(240px,40vh,360px);margin-bottom:22px;padding:clamp(22px,3.2vw,46px);border-radius:var(--r);display:grid;grid-template-columns:auto 1fr;gap:clamp(14px,3vw,44px);align-content:start;border:1px solid var(--line);background:color-mix(in srgb,var(--ac) calc(var(--i) * 6% + 7%),var(--bg2))}
.sv-stack .big{font:${dw} clamp(70px,11vw,190px)/.8 var(--fd);color:transparent;-webkit-text-stroke:2px var(--ac)}
.sv-stack h3{font:${dw} calc(clamp(26px,3.4vw,52px) * var(--ts))/1 var(--fd);letter-spacing:-.02em;${caps}margin-bottom:12px}.sv-stack p{color:var(--mu);max-width:48ch}
@media(max-width:700px){.hx-row{grid-template-columns:1fr}.sv-stack li{grid-template-columns:1fr;position:relative;top:auto}.hx-sticker{display:none}}`,
    poster: `.a-poster .about{grid-template-columns:minmax(0,1fr) minmax(0,.8fr)}.a-poster .about-media{order:2}.a-poster .about-media .ph{border-radius:999px 999px 24px 24px;aspect-ratio:3/4}
.a-poster .about-copy .prose p:first-child::first-letter{font:${dw} 4.6em/.8 var(--fd);float:left;padding:.08em .12em 0 0;color:var(--ac)}
.a-poster .stmt-text{font-style:italic;font-weight:400;max-width:18ch}
.hx-poster{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(24px,5vw,88px);align-items:center;max-width:1520px;margin:0 auto;padding:clamp(28px,4vw,56px) var(--gut) clamp(40px,6vw,96px);min-height:calc(100svh - 76px)}
.hx-poster.flip .hx-text{order:2}
.hx-poster .h1{font-size:calc(clamp(44px,6.8vw,124px) * var(--ts));line-height:.94;font-weight:500;letter-spacing:-.025em}
.hx-chap{display:flex;gap:14px;align-items:center;font:600 12px var(--fb);letter-spacing:.22em;text-transform:uppercase;color:var(--ac);margin-bottom:22px}
.hx-chap i{font:italic ${dw} 28px/1 var(--fd);letter-spacing:0;border:1px solid var(--ac);border-radius:50%;width:48px;height:48px;display:grid;place-items:center}
.hx-note{margin-top:28px}.hx-note .status{margin:0}
.hx-poster .hx-chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.hx-poster .hx-chips li{padding:7px 14px;border:1px solid var(--line);border-radius:999px;font-size:14px;color:var(--mu)}
.hx-arch{position:relative}
.hx-arch-in{border-radius:999px 999px 28px 28px;overflow:hidden;aspect-ratio:3/4.1;box-shadow:0 50px 90px -40px #000;outline:1px solid var(--ac);outline-offset:12px;background:var(--bg2)}
.hx-arch-in .ph,.hx-arch-in .stage{height:100%;border-radius:0;box-shadow:none;position:relative;inset:auto;aspect-ratio:auto}
.hx-vert{position:absolute;right:-34px;top:50%;writing-mode:vertical-rl;transform:translateY(-50%) rotate(180deg);font:600 12px var(--fb);letter-spacing:.3em;text-transform:uppercase;color:var(--mu)}
.sv-leaders-wrap .sec-head,.sv-leaders-wrap{max-width:1040px;margin-inline:auto}
.sv-leaders{list-style:none;display:grid;gap:clamp(22px,2.6vw,38px);margin-top:12px}
.sv-leaders li{display:grid;grid-template-columns:auto 1fr auto;column-gap:14px;align-items:baseline}
.sv-leaders .t{font:${dw} calc(clamp(24px,2.9vw,42px) * var(--ts))/1.1 var(--fd);letter-spacing:-.015em}
.sv-leaders .dots{border-bottom:2px dotted color-mix(in srgb,var(--ink) 38%,transparent);transform:translateY(-7px)}
.sv-leaders .r{font:italic 500 18px var(--fd);color:var(--ac);letter-spacing:.08em}
.sv-leaders p{grid-column:1/-1;margin-top:6px;color:var(--mu);max-width:58ch}
@media(max-width:860px){.hx-poster{grid-template-columns:1fr;min-height:0}.hx-poster.flip .hx-text{order:0}.hx-arch-in{aspect-ratio:4/4.4;outline-offset:8px}.hx-vert{display:none}}`,
    plate: `.a-plate .about{grid-template-columns:minmax(0,.8fr) minmax(0,1fr)}.a-plate .about-media .ph{border-radius:50%;aspect-ratio:1;box-shadow:0 0 0 10px color-mix(in srgb,var(--ac) 22%,transparent)}
.a-plate .about-copy{text-align:left}.a-plate .stmt-text{max-width:16ch}
.hx-plate{display:grid;justify-items:center;text-align:center;overflow:hidden;padding:clamp(24px,4vw,56px) var(--gut) clamp(40px,6vw,88px)}
.hx-plate .pill{margin-bottom:10px}
.hx-disc{position:relative;width:min(74vw,600px);aspect-ratio:1;margin:18px auto 0}
.hx-disc::before{content:"";position:absolute;inset:-5%;border:1px dashed color-mix(in srgb,var(--ac) 65%,transparent);border-radius:50%;animation:hxspin 70s linear infinite}
.hx-disc-in{position:absolute;inset:0;border-radius:50%;overflow:hidden;box-shadow:0 50px 100px -30px #000,0 0 0 10px color-mix(in srgb,var(--ac) 22%,transparent);background:var(--bg2)}
.hx-disc-in .ph,.hx-disc-in .stage{height:100%;border-radius:0;box-shadow:none;position:relative;inset:auto;aspect-ratio:auto}
.hx-plate .h1{margin-top:calc(-1 * clamp(36px,7vw,110px));position:relative;z-index:2;font-size:calc(clamp(42px,7.2vw,132px) * var(--ts));line-height:.95;max-width:16ch;text-shadow:0 6px 44px rgba(0,0,0,.5)}
.hx-plate .lede{margin-inline:auto;max-width:54ch}.hx-plate .acts{justify-content:center}
.sv-leaders-wrap{max-width:900px;margin-inline:auto}.sv-leaders-wrap .sec-head{text-align:center}.sv-leaders-wrap .kicker{justify-content:center}
.a-plate .sv-leaders li{grid-template-columns:auto 1fr auto}
.a-plate .gal-strip,.a-showroom .gal-strip{margin-top:8px}`,
    spec: `.a-spec .about{grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);border:1px solid var(--line);padding:clamp(20px,3vw,40px);gap:clamp(20px,3vw,48px)}
.a-spec .about-media .ph{aspect-ratio:4/3;border-radius:4px;filter:saturate(.85) contrast(1.05)}.a-spec .about-copy .h2{${caps}font-size:calc(clamp(28px,3.6vw,56px) * var(--ts))}
.a-spec .about-copy .kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.a-spec .stmt-text{${caps}text-align:left;font-size:calc(clamp(34px,6.4vw,110px) * var(--ts));max-width:none}.a-spec .stmt{place-items:start;padding-inline:var(--gut)}
.hx-spec{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(20px,3vw,52px);align-items:start;max-width:1520px;margin:0 auto;padding:0 var(--gut) clamp(40px,5vw,72px)}
.hx-hazard{grid-column:1/-1;height:12px;margin:0 calc(-1 * var(--gut)) clamp(22px,3vw,44px);background:repeating-linear-gradient(-45deg,var(--ac) 0 14px,#111 14px 28px)}
.hx-os{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}.hx-os span{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--ac);color:var(--ac);padding:6px 10px}
.hx-spec .h1{font-size:calc(clamp(42px,6.2vw,112px) * var(--ts));line-height:.95;text-transform:uppercase;letter-spacing:-.02em}
.hx-cells{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border:1px solid var(--line);margin-top:30px}
.hx-cells div{padding:14px 16px;border-right:1px solid var(--line);min-width:0}.hx-cells div:last-child{border-right:0}
.hx-cells dt{font:600 11px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mu)}.hx-cells dd{margin:6px 0 0;font-weight:600;overflow-wrap:anywhere}
.hx-cells .status{margin:0;padding:0;border:0;background:transparent}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.hx-sheet{border:1px solid var(--line);background:var(--bg2);border-radius:6px;overflow:hidden;box-shadow:0 30px 60px -36px #000}
.hx-sheet header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line);font:600 11px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--mu)}.hx-sheet header b{color:var(--ink)}
.hx-sheet-media{aspect-ratio:16/10;background:var(--bg)}.hx-sheet-media .ph,.hx-sheet-media .stage{height:100%;border-radius:0;box-shadow:none;position:relative;inset:auto;aspect-ratio:auto}
.hx-sheet ul{list-style:none;padding:8px 16px 16px}.hx-sheet li{padding:10px 0 10px 28px;border-bottom:1px solid var(--line);position:relative;font-weight:500}.hx-sheet li:last-child{border-bottom:0}
.hx-sheet li::before{content:"✓";position:absolute;left:0;color:var(--ac);font-weight:700}
.sv-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));border-top:3px solid var(--ink);border-left:1px solid var(--line)}
.sv-grid li{padding:26px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);transition:background .3s}.sv-grid li:hover{background:color-mix(in srgb,var(--ac) 10%,transparent)}
.sv-grid .code{font:500 12px ui-monospace,monospace;color:var(--ac);letter-spacing:.12em}
.sv-grid h3{font:${dw} calc(23px * var(--ts))/1.2 var(--fd);margin:10px 0 8px;text-transform:uppercase}.sv-grid p{color:var(--mu);font-size:16px}
.steps{margin-top:clamp(36px,5vw,72px)}.steps ol{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(16px,2vw,28px);margin-top:18px}
.steps li{padding-top:18px;border-top:3px solid var(--ac)}.steps b{font:500 44px/1 ui-monospace,monospace;color:var(--ac)}.steps h3{font:${dw} calc(22px * var(--ts))/1.2 var(--fd);margin:10px 0 6px}.steps p{color:var(--mu)}
@media(max-width:900px){.hx-spec{grid-template-columns:1fr}}`,
    calm: `.a-calm .about-media .ph{border-radius:40px;aspect-ratio:4/4.6}.a-calm .about{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}
.a-calm .about-copy{padding:clamp(8px,2vw,24px)}.a-calm .stmt{min-height:44vh}.a-calm .stmt-text{font-weight:500;max-width:22ch;font-size:calc(clamp(30px,5vw,80px) * var(--ts))}
.hx-calm{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,5vw,80px);align-items:center;max-width:1520px;margin:0 auto;padding:clamp(20px,4vw,64px) var(--gut) clamp(40px,6vw,88px);min-height:calc(100svh - 90px)}
.hx-calm.flip .hx-text{order:2}
.hx-calm .h1{font-size:calc(clamp(38px,5.2vw,80px) * var(--ts));line-height:1.02;letter-spacing:-.025em}
.hx-calm .pill{margin-bottom:22px}
.hx-chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}.hx-chips li{padding:8px 14px;border-radius:999px;border:1px solid var(--line);font-size:14px;color:var(--mu);background:var(--bg2)}
.hx-photo{position:relative;padding:0 0 30px}
.hx-photo-in{aspect-ratio:4/4.5;border-radius:40px;overflow:hidden;background:var(--bg2);box-shadow:0 40px 80px -40px rgba(0,0,0,.4)}
.hx-photo-in .ph,.hx-photo-in .stage{height:100%;border-radius:0;box-shadow:none;position:relative;inset:auto;aspect-ratio:auto}
.hx-float{position:absolute;padding:12px 16px;border-radius:18px;background:var(--bg);border:1px solid var(--line);box-shadow:0 20px 40px -20px rgba(0,0,0,.35);font-size:14px;font-weight:600;text-decoration:none;color:var(--ink)}
.hx-float.a{left:-4%;top:10%}.hx-float.b{right:-3%;bottom:0;max-width:260px}.hx-float.a .status{margin:0;border:0;padding:0;background:transparent}
.hx-float span{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mu);font-weight:500;margin-bottom:2px}
.sv-soft{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.sv-soft li{padding:28px;border-radius:26px;background:var(--bg2);border:1px solid var(--line);transition:transform .4s var(--ease),box-shadow .4s}.sv-soft li:hover{transform:translateY(-4px);box-shadow:0 24px 50px -30px var(--ac)}
.sv-soft .ic{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--ac);font:700 19px var(--fd);margin-bottom:16px}
.sv-soft h3{font:${dw} calc(22px * var(--ts))/1.2 var(--fd);margin-bottom:8px}.sv-soft p{color:var(--mu)}
.a-calm .gal-col .ph{border-radius:28px}
@media(max-width:860px){.hx-calm{grid-template-columns:1fr;min-height:0}.hx-calm.flip .hx-text{order:0}.hx-float.a{left:8px}.hx-float.b{right:8px}}`,
  };
  const gallery = `.gal-strip{display:flex;gap:clamp(12px,1.6vw,22px);overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:14px;-webkit-overflow-scrolling:touch}
.gal-strip .gal-col{display:contents}.gal-strip .gal-col>div{flex:0 0 min(80vw,560px);scroll-snap-align:start}
.gal-strip .ph{aspect-ratio:4/3;height:auto}
.gal-bento{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:clamp(110px,15vw,210px);gap:clamp(10px,1.4vw,18px)}
.gal-bento .gal-col{display:contents}.gal-bento .gal-col>div{min-width:0}.gal-bento .ph{height:100%;aspect-ratio:auto}
.gal-bento .gal-col>div:nth-child(1){grid-column:span 3;grid-row:span 2}.gal-bento .gal-col>div:nth-child(2){grid-column:span 3}
.gal-bento .gal-col>div:nth-child(3){grid-column:span 2}.gal-bento .gal-col>div:nth-child(4){grid-column:span 1}
.gal-bento .gal-col>div:nth-child(n+5){grid-column:span 2}
@media(max-width:700px){.gal-bento{grid-template-columns:repeat(2,minmax(0,1fr))}.gal-bento .gal-col>div{grid-column:span 1!important;grid-row:span 1!important}.gal-bento .gal-col>div:first-child{grid-column:span 2!important}}`;
  return `${common}\n${per[a]}\n${gallery}`;
}
