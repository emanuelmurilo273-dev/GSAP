import type { Archetype, Step } from "../direction";

// Recursos de experiência dos sites, cada um com função clara para quem visita um negócio local.
// Técnicas inspiradas (sem copiar) em: Kurage (campo de partículas reativo, pausar movimento lembrado,
// paleta de comandos, respeito a "reduzir transparência"), Hadal e Nolith (passos fixados na rolagem,
// capítulos), Sorvine (partículas que respondem ao ponteiro) e Immersive Robotics (leituras técnicas reais).

export type FxPreset = "embers" | "sparks" | "dust" | "ascii" | "none";
/** Qual campo de partículas combina com cada estrutura (calma e arco ficam sem: já são quietas ou têm o seu). */
export const FX_FOR: Record<Archetype, FxPreset> = { arc: "none", showroom: "dust", display: "ascii", poster: "dust", plate: "embers", spec: "sparks", calm: "none" };

export type PalAction = { label: string; hint?: string; href?: string; action?: "motion" | "copy"; copy?: string; external?: boolean; keys?: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function paletteHtml(actions: PalAction[]): string {
  const items = actions.map((a, i) => {
    const k = esc(`${a.label} ${a.hint ?? ""} ${a.keys ?? ""}`.toLowerCase());
    const inner = `${esc(a.label)}${a.hint ? `<small>${esc(a.hint)}</small>` : ""}`;
    if (a.href) return `<a role="option" id="pal-${i}" data-k="${k}" href="${esc(a.href)}"${a.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>`;
    return `<button type="button" role="option" id="pal-${i}" data-k="${k}" data-action="${a.action}"${a.copy ? ` data-copy="${esc(a.copy)}"` : ""}>${inner}</button>`;
  }).join("");
  return `<div class="pal" data-pal hidden role="dialog" aria-modal="true" aria-label="Atalhos do site">
  <div class="pal-card">
    <label class="sr" for="pal-q">Buscar atalho</label>
    <input id="pal-q" type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" autocomplete="off" placeholder="O que você precisa? Ligar, horários, serviços…">
    <div id="pal-list" role="listbox" aria-label="Atalhos">${items}<p class="pal-empty" hidden>Nenhum atalho com esse texto.</p></div>
    <p class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></p>
  </div>
</div>`;
}

export function chapterNavHtml(items: { id: string; label: string }[]): string {
  if (items.length < 3) return "";
  return `<nav class="cnav" aria-label="Capítulos da página"><ol>${items.slice(0, 7).map((x, i) => `<li><a href="#${esc(x.id)}" data-ch="${esc(x.id)}"><i aria-hidden="true">${String(i + 1).padStart(2, "0")}</i><span>${esc(x.label)}</span></a></li>`).join("")}</ol></nav>`;
}

export function storyHtml(steps: Step[], title: string, kicker: string): string {
  if (steps.length < 2) return "";
  return `<section id="como-funciona" class="sec story" data-story style="--n:${steps.length}" aria-labelledby="h-story">
  <div class="story-pin">
    <header class="sec-head"><p class="kicker rv">${esc(kicker)}</p><h2 id="h-story" class="h2 rv" style="--d:1">${esc(title)}</h2></header>
    <div class="story-body">
      <p class="story-num" aria-hidden="true" data-story-num>01</p>
      <ol class="story-steps">${steps.map((s, i) => `<li data-step${i === 0 ? ' class="on"' : ""}><b aria-hidden="true">${String(i + 1).padStart(2, "0")}</b><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></li>`).join("")}</ol>
    </div>
    <div class="story-bar" aria-hidden="true"><i data-story-bar></i></div>
  </div>
</section>`;
}

export const motionButtonHtml = `<button type="button" class="mc" data-motion-toggle aria-pressed="false">Pausar animações</button>`;

export function extrasCss(arch: Archetype, dw: number | string): string {
  const fxZ = arch === "showroom" ? "1" : "-1";
  return `
.hx{isolation:isolate}
.fx{position:absolute;inset:0;width:100%;height:100%;z-index:${fxZ};pointer-events:none}
.pal-btn{font:500 14px var(--fb);color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 28%,transparent);border-radius:999px;padding:6px 12px;cursor:pointer;display:inline-flex;gap:8px;align-items:center}
.pal-btn:hover,.pal-btn:focus-visible{border-color:currentColor}
.pal-btn kbd,.pal-foot kbd{font:600 11px ui-monospace,Menlo,monospace;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:5px;padding:1px 5px;margin-right:4px}
.pal{position:fixed;inset:0;z-index:80;display:grid;align-items:start;justify-items:center;padding:14vh 16px 16px;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.pal[hidden]{display:none}
.pal-card{width:min(580px,100%);max-height:72vh;display:grid;grid-template-rows:auto 1fr auto;border-radius:18px;background:var(--bg2);color:var(--ink);border:1px solid var(--line);box-shadow:0 40px 90px -30px #000;overflow:hidden}
.pal-card input{font:400 17px var(--fb);color:var(--ink);background:transparent;border:0;border-bottom:1px solid var(--line);padding:18px 20px;outline:none;width:100%}
.pal-card input::placeholder{color:var(--mu)}
#pal-list{overflow:auto;padding:8px;display:grid;align-content:start;gap:2px}
#pal-list [role=option]{display:flex;justify-content:space-between;align-items:baseline;gap:16px;text-align:left;font:500 16px var(--fb);color:var(--ink);background:transparent;border:0;border-radius:10px;padding:13px 14px;text-decoration:none;cursor:pointer;min-height:48px}
#pal-list [role=option] small{color:var(--mu);font-size:13px;font-weight:400;overflow-wrap:anywhere;text-align:right}
#pal-list [role=option].on,#pal-list [role=option]:hover{background:color-mix(in srgb,var(--ac) 16%,transparent)}
#pal-list [hidden]{display:none}
.pal-empty{padding:18px 14px;color:var(--mu)}
.pal-foot{display:flex;gap:18px;flex-wrap:wrap;padding:10px 18px;border-top:1px solid var(--line);font-size:12px;color:var(--mu)}
.cnav{position:fixed;right:clamp(10px,1.6vw,26px);top:50%;transform:translateY(-50%);z-index:25;display:none}
.cnav ol{list-style:none;display:grid;gap:4px}
.cnav a{display:flex;align-items:center;justify-content:flex-end;gap:10px;text-decoration:none;color:var(--mu);font:500 12px var(--fb);padding:5px 0;min-height:24px}
.cnav a span{max-width:0;overflow:hidden;white-space:nowrap;opacity:0;transition:max-width .35s var(--ease),opacity .25s;letter-spacing:.06em;text-transform:uppercase}
.cnav a i{font-style:normal;font-variant-numeric:tabular-nums;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 35%,transparent);font-size:10px;transition:background .25s,color .25s,border-color .25s}
.cnav a:hover span,.cnav a:focus-visible span,.cnav a[aria-current=true] span{max-width:200px;opacity:1}
.cnav a[aria-current=true]{color:var(--ink)}.cnav a[aria-current=true] i{background:var(--ac);border-color:var(--ac);color:var(--bg)}
@media(min-width:1280px){.cnav{display:block}}
.story{position:relative;height:calc(100svh + var(--n) * 42vh);max-width:none;padding:0}
.story-pin{position:sticky;top:0;height:100svh;display:flex;flex-direction:column;justify-content:center;gap:clamp(18px,3vh,36px);padding:80px var(--gut) 40px;max-width:1520px;margin:0 auto}
.story-body{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(20px,5vw,90px);align-items:center}
.story-num{font:${dw} clamp(120px,22vw,340px)/.8 var(--fd);color:transparent;-webkit-text-stroke:2px var(--ac);letter-spacing:-.04em;transition:opacity .35s}
.story-steps{list-style:none;display:grid;gap:clamp(14px,2.4vh,26px)}
.story-steps li{display:grid;grid-template-columns:auto 1fr;column-gap:18px;opacity:.26;transform:translateX(0);transition:opacity .45s var(--ease),transform .45s var(--ease)}
.story-steps li.on{opacity:1;transform:translateX(10px)}.story-steps li.done{opacity:.5}
.story-steps b{grid-row:span 2;font:500 14px ui-monospace,Menlo,monospace;color:var(--ac);padding-top:.5em}
.story-steps h3{font:${dw} calc(clamp(24px,3vw,44px) * var(--ts))/1.05 var(--fd);letter-spacing:-.02em}
.story-steps p{color:var(--mu);max-width:50ch}
.story-bar{height:2px;background:var(--line);border-radius:2px;overflow:hidden}.story-bar i{display:block;height:100%;width:100%;background:var(--ac);transform-origin:0 50%;transform:scaleX(var(--sp,0))}
.story.static,.no-js .story{height:auto}.story.static .story-pin,.no-js .story .story-pin{position:static;height:auto;padding-block:clamp(48px,8vw,110px)}.story.static .story-steps li,.no-js .story .story-steps li{opacity:1;transform:none}
@media(max-width:820px){.story{height:auto}.story-pin{position:static;height:auto;padding-block:clamp(44px,10vw,88px)}.story-body{grid-template-columns:1fr}.story-num{font-size:clamp(88px,30vw,150px)}.story-steps li{opacity:1;transform:none}.story-bar{display:none}}
.mc{font:500 13px var(--fb);color:var(--mu);background:transparent;border:1px solid var(--line);border-radius:999px;padding:7px 14px;cursor:pointer;min-height:36px}.mc:hover,.mc:focus-visible{color:var(--ink);border-color:var(--ink)}
.mc[aria-pressed=true]{color:var(--ac);border-color:var(--ac)}
.paused .mq-track,.paused .hx-sticker,.paused .hx-disc::before,.paused .scroll-cue span{animation:none!important}
.paused .status.is-open i{animation:none}
${arch === "arc" || arch === "spec" ? "" : `.a-${arch} .split .w>span{filter:blur(9px);transition:transform 1s var(--ease),filter 1.1s var(--ease)}.ready .a-${arch} .split .w>span,.a-${arch}.ready .split .w>span{filter:none}`}
/* ---- animações de rolagem (só transform/opacity; sem JS ou pausado, tudo aparece pronto) ---- */
.sx{opacity:0;transform:translate3d(0,38px,0) scale(.985);transition:opacity .8s var(--ease),transform 1s var(--ease);transition-delay:calc(var(--sd,0) * 80ms)}
.sx.in{opacity:1;transform:none}
.h2.hs{opacity:1;transform:none}
.hs .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.12em;margin-bottom:-.12em}
.hs .w>span{display:inline-block;transform:translate3d(0,108%,0);transition:transform .95s var(--ease);transition-delay:calc(var(--wi,0) * 55ms)}
.hs.in .w>span{transform:none}
@supports (animation-timeline:view()){
  @keyframes hx-settle{from{scale:1.16}to{scale:1}}
  @keyframes hx-lift{from{translate:0 var(--lift,34px)}to{translate:0 0}}
  .about-media img,.card-img img,.gal-col img,.hx-sheet img{animation:hx-settle linear both;animation-timeline:view();animation-range:entry 0% cover 60%}
  .final-copy{--lift:46px;animation:hx-lift linear both;animation-timeline:view();animation-range:entry 0% cover 45%}
}
.paused .sx{opacity:1;transform:none;transition:none}
.paused .hs .w>span{transform:none;transition:none}
.paused .about-media img,.paused .card-img img,.paused .gal-col img,.paused .hx-sheet img,.paused .final-copy{animation:none!important}
@media(prefers-reduced-transparency:reduce){.pal,.top.solid,.pill,.btn.ghost,.btn.roll.ghost,.hx-float,.status{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}.pal{background:rgba(0,0,0,.8)}.top.solid{background:var(--bg)}.pill,.btn.ghost,.btn.roll.ghost{background:var(--bg2)}}
@media(prefers-reduced-motion:reduce){.split .w>span{filter:none!important}.story-steps li{transition:none}}
`;
}

/** Roda no navegador (serializado com toString): pausa de movimento, paleta, capítulos, passos fixados e campo de partículas. */
export function extrasRuntime(cfg: { fx: { preset: string; color: string } | null }) {
  var d = document, w = window, body = d.body;
  var mq = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = !!(mq && mq.matches);
  var KEY = "hx-paused", userPaused = false;
  try { userPaused = localStorage.getItem(KEY) === "1"; } catch (e) { /* sem armazenamento: vale só nesta visita */ }
  var toggles = Array.prototype.slice.call(d.querySelectorAll("[data-motion-toggle]")) as HTMLElement[];
  function applyMotion() {
    var off = userPaused || reduce;
    body.classList.toggle("paused", off);
    toggles.forEach(function (b) { b.setAttribute("aria-pressed", off ? "true" : "false"); b.textContent = reduce ? "Animações pausadas (preferência do sistema)" : off ? "Retomar animações" : "Pausar animações"; (b as HTMLButtonElement).disabled = reduce; });
    var pm = d.querySelector('[data-action="motion"]'); if (pm) pm.firstChild!.textContent = off ? "Retomar animações" : "Pausar animações";
    w.dispatchEvent(new CustomEvent("hx:motion", { detail: { paused: off } }));
  }
  function setPaused(v: boolean) { userPaused = v; try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) { /* ok */ } applyMotion(); }
  toggles.forEach(function (b) { b.addEventListener("click", function () { setPaused(!userPaused); }); });
  applyMotion();

  // ---- animações de rolagem: grupos em cascata e títulos que sobem por uma máscara ----
  if (!reduce && "IntersectionObserver" in w) {
    var sio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); sio.unobserve(e.target); } }); }, { rootMargin: "0px 0px -10% 0px" });
    // listas com 3+ itens (menos o trilho horizontal fixado, onde os cartões são movidos pela rolagem)
    d.querySelectorAll("main ol, main ul, .menu-grid, .nums, .gal-cols").forEach(function (g) {
      if (g.closest("[data-rail],.rail,.pal,.story,nav,footer")) return;
      var kids = Array.prototype.slice.call(g.children).filter(function (k) { return !k.classList.contains("rv") && !k.classList.contains("reveal") && !k.hasAttribute("data-par"); }) as HTMLElement[];
      if (kids.length < 3) return;
      kids.forEach(function (k, i) { k.classList.add("sx"); k.style.setProperty("--sd", String(i % 4)); sio.observe(k); });
    });
    d.querySelectorAll(".sec-head .h2, .final .h2").forEach(function (h) {
      if (h.children.length || !h.textContent) return;
      var txt = h.textContent.trim(), i = 0;
      h.setAttribute("aria-label", txt);
      h.textContent = "";
      txt.split(/\s+/).forEach(function (wd, n) {
        var o = d.createElement("span"), inn = d.createElement("span");
        o.className = "w"; o.setAttribute("aria-hidden", "true"); inn.textContent = wd; inn.style.setProperty("--wi", String(i++)); o.appendChild(inn);
        if (n) h.appendChild(d.createTextNode(" "));
        h.appendChild(o);
      });
      h.classList.add("hs");
    });
  }

  // ---- paleta de atalhos (Ctrl/⌘ + K ou "/") ----
  var pal = d.querySelector("[data-pal]") as HTMLElement | null;
  if (pal) {
    var inp = pal.querySelector("input") as HTMLInputElement, opts = Array.prototype.slice.call(pal.querySelectorAll("[role=option]")) as HTMLElement[];
    var empty = pal.querySelector(".pal-empty") as HTMLElement, cur = 0, back: HTMLElement | null = null;
    var vis = function () { return opts.filter(function (o) { return !o.hidden; }); };
    var mark = function (n: number) {
      var v = vis(); if (!v.length) { inp.removeAttribute("aria-activedescendant"); return; }
      cur = (n + v.length) % v.length;
      opts.forEach(function (o) { o.classList.remove("on"); o.setAttribute("aria-selected", "false"); });
      v[cur]!.classList.add("on"); v[cur]!.setAttribute("aria-selected", "true"); inp.setAttribute("aria-activedescendant", v[cur]!.id); v[cur]!.scrollIntoView({ block: "nearest" });
    };
    var filter = function () {
      var q = inp.value.trim().toLowerCase();
      opts.forEach(function (o) { o.hidden = !!q && (o.getAttribute("data-k") || "").indexOf(q) < 0; });
      empty.hidden = vis().length > 0; mark(0);
    };
    var openPal = function () { back = d.activeElement as HTMLElement; pal!.hidden = false; body.classList.add("pal-open"); inp.value = ""; filter(); inp.focus(); };
    var closePal = function () { pal!.hidden = true; body.classList.remove("pal-open"); if (back && back.focus) back.focus(); };
    var run = function (o: HTMLElement) {
      var a = o.getAttribute("data-action");
      if (a === "motion") { setPaused(!userPaused); closePal(); }
      else if (a === "copy") { var t = o.getAttribute("data-copy") || ""; try { navigator.clipboard.writeText(t).then(function () { o.firstChild!.textContent = "Copiado"; }, function () { /* ok */ }); } catch (e) { /* ok */ } }
      else { closePal(); if (o.tagName === "A") (o as HTMLAnchorElement).click(); }
    };
    d.querySelectorAll("[data-pal-open]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); openPal(); }); });
    inp.addEventListener("input", filter);
    opts.forEach(function (o) { o.addEventListener("click", function (e) { if (o.tagName === "A") { closePal(); return; } e.preventDefault(); run(o); }); o.addEventListener("mousemove", function () { var v = vis(); var i = v.indexOf(o); if (i >= 0 && i !== cur) mark(i); }); });
    pal.addEventListener("mousedown", function (e) { if (e.target === pal) closePal(); });
    d.addEventListener("keydown", function (e) {
      var tag = (e.target as HTMLElement).tagName;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (pal!.hidden) openPal(); else closePal(); return; }
      if (e.key === "/" && pal!.hidden && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") { e.preventDefault(); openPal(); return; }
      if (pal!.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closePal(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); mark(cur + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(cur - 1); }
      else if (e.key === "Enter") { e.preventDefault(); var v = vis(); if (v[cur]) { if (v[cur]!.getAttribute("data-action")) run(v[cur]!); else { var el = v[cur]!; closePal(); (el as HTMLAnchorElement).click(); } } }
      else if (e.key === "Tab") { e.preventDefault(); inp.focus(); } // foco preso no diálogo
    });
  }

  // ---- índice de capítulos: marca a seção que está na altura dos olhos ----
  var links = Array.prototype.slice.call(d.querySelectorAll("[data-ch]")) as HTMLAnchorElement[];
  if (links.length && "IntersectionObserver" in w) {
    var setCh = function (id: string) { links.forEach(function (a) { if (a.getAttribute("data-ch") === id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); }); };
    var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) setCh(e.target.id); }); }, { rootMargin: "-40% 0px -55% 0px" });
    links.forEach(function (a) { var s = d.getElementById(a.getAttribute("data-ch") || ""); if (s) cio.observe(s); });
    setCh(links[0]!.getAttribute("data-ch") || "");
  }

  // ---- passos fixados na rolagem ----
  var story = d.querySelector("[data-story]") as HTMLElement | null;
  if (story) {
    var steps = Array.prototype.slice.call(story.querySelectorAll("[data-step]")) as HTMLElement[], num = story.querySelector("[data-story-num]") as HTMLElement, bar = story.querySelector("[data-story-bar]") as HTMLElement;
    if (reduce) story.classList.add("static");
    else {
      var tick = 0;
      var upd = function () {
        tick = 0;
        var r = story!.getBoundingClientRect(), span = Math.max(1, r.height - w.innerHeight), p = Math.max(0, Math.min(1, -r.top / span));
        var i = Math.min(steps.length - 1, Math.floor(p * steps.length));
        story!.style.setProperty("--sp", p.toFixed(3));
        steps.forEach(function (s, n) { s.classList.toggle("on", n === i); s.classList.toggle("done", n < i); });
        var t = String(i + 1); if (num.textContent !== "0" + t) num.textContent = "0" + t;
      };
      var onScroll = function () { if (!tick) tick = requestAnimationFrame(upd); };
      w.addEventListener("scroll", onScroll, { passive: true }); w.addEventListener("resize", onScroll, { passive: true }); upd();
    }
  }

  // ---- campo de partículas ambiente (reage ao ponteiro; para fora da tela, em segundo plano e quando pausado) ----
  var cv = d.querySelector("canvas[data-fx]") as HTMLCanvasElement | null;
  if (cfg.fx && cv && cv.getContext) {
    var ctx = cv.getContext("2d")!, P = cfg.fx.preset, host = cv.parentElement as HTMLElement;
    var rgb = [255, 160, 60]; var hx = cfg.fx.color.replace("#", ""); if (hx.length === 6) rgb = [parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16)];
    var col = function (a: number) { return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a.toFixed(3) + ")"; };
    var W = 0, H = 0, dpr = 1, ps: { x: number; y: number; vx: number; vy: number; r: number; l: number; m: number; s: number }[] = [];
    var mx = -9999, my = -9999, raf = 0, seen = false, last = 0, small = false, cell = 30;
    var fine = !!(w.matchMedia && w.matchMedia("(pointer: fine)").matches);
    var spawn = function (init: boolean) {
      var s = Math.random() * 6.283, p = { x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, r: 1, l: 0, m: 1, s: s };
      if (P === "embers") { p.y = init ? Math.random() * H : H + 10; p.vy = -(18 + Math.random() * 46); p.vx = (Math.random() - .5) * 14; p.r = .8 + Math.random() * 2; p.m = 4 + Math.random() * 5; p.l = init ? Math.random() * p.m : 0; }
      else if (P === "sparks") { p.x = Math.random() * W; p.y = H * (.55 + Math.random() * .45); var a = -Math.PI / 2 + (Math.random() - .5) * 1.5, v = 90 + Math.random() * 230; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.r = 1 + Math.random() * 1.2; p.m = .5 + Math.random() * .8; p.l = init ? Math.random() * p.m : 0; }
      else { p.vx = (Math.random() - .5) * 9; p.vy = (Math.random() - .5) * 7; p.r = .7 + Math.random() * 1.6; p.m = 6 + Math.random() * 6; p.l = Math.random() * p.m; }
      return p;
    };
    var size = function () {
      var r = host.getBoundingClientRect(); if (r.width < 40 || r.height < 40) return;
      W = r.width; H = r.height; small = W < 700; dpr = Math.min(w.devicePixelRatio || 1, 1.5); cv!.width = Math.round(W * dpr); cv!.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = P === "ascii" ? 0 : Math.round(Math.min(P === "sparks" ? 46 : 90, W * H / (P === "sparks" ? 26000 : 17000)) * (small ? .55 : 1));
      ps = []; for (var i = 0; i < n; i++) ps.push(spawn(true));
      paint(0);
    };
    var paint = function (dt: number) {
      ctx.clearRect(0, 0, W, H);
      if (P === "ascii") {
        if (small) return; var t = performance.now() / 1000, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
        ctx.font = "500 " + Math.round(cell * .5) + "px ui-monospace,Menlo,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var glyphs = ["·", "·", ":", "+", "×"];
        for (var yy = 0; yy < rows; yy++) for (var xx = 0; xx < cols; xx++) {
          var cx = xx * cell + cell / 2, cy = yy * cell + cell / 2, dx = cx - mx, dy = cy - my, dist = Math.sqrt(dx * dx + dy * dy);
          var wave = .5 + .5 * Math.sin(xx * .35 + yy * .28 + t * (userPaused || reduce ? 0 : .9)), near = Math.max(0, 1 - dist / 170), lvl = Math.min(1, wave * .28 + near * .9);
          ctx.fillStyle = col(.1 + lvl * .5); ctx.fillText(glyphs[Math.min(4, Math.floor(lvl * 5))]!, cx, cy);
        }
        return;
      }
      ctx.globalCompositeOperation = P === "dust" || P === "embers" ? "lighter" : "source-over";
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i]!;
        if (dt) {
          p.l += dt;
          if (P === "sparks") { p.vy += 280 * dt; }
          if (fine && mx > -999) { var ex = p.x - mx, ey = p.y - my, ed = Math.sqrt(ex * ex + ey * ey); if (ed < 120 && ed > 1) { var f = (1 - ed / 120) * (P === "sparks" ? 260 : 60) * dt; p.vx += ex / ed * f; p.vy += ey / ed * f; } }
          if (P !== "sparks") { p.vx *= .985; p.vy = P === "embers" ? p.vy : p.vy * .985; }
          p.x += p.vx * dt + (P === "embers" ? Math.sin(p.l * 1.6 + p.s) * 8 * dt : 0); p.y += p.vy * dt;
          if (p.l > p.m || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 40) { ps[i] = spawn(false); if (P === "dust") { ps[i]!.l = 0; } continue; }
        }
        var k = p.l / p.m, a = Math.sin(Math.min(1, k) * Math.PI);
        if (P === "sparks") { ctx.strokeStyle = col(.9 * (1 - k)); ctx.lineWidth = p.r; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); }
        else { ctx.fillStyle = col((P === "embers" ? .85 : .55) * a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (P === "embers" ? 1 - k * .4 : 1), 0, 6.283); ctx.fill(); }
      }
      ctx.globalCompositeOperation = "source-over";
    };
    var off = function () { return userPaused || reduce; };
    var frame = function (now: number) {
      raf = 0; if (!seen || d.hidden) return;
      if (off() && P !== "ascii") return;
      if (now - last >= (P === "ascii" ? 50 : 33)) { var dt = Math.min(.05, (now - last) / 1000); last = now; paint(off() ? 0 : dt); }
      if (!off() || (P === "ascii" && mx > -999)) raf = requestAnimationFrame(frame);
    };
    var kick = function () { if (!raf) raf = requestAnimationFrame(frame); };
    if (fine) { host.addEventListener("pointermove", function (e) { var r = host.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; kick(); }, { passive: true }); host.addEventListener("pointerleave", function () { mx = -9999; my = -9999; }); }
    w.addEventListener("hx:motion", function () { paint(0); kick(); });
    d.addEventListener("visibilitychange", kick);
    var rt = 0; w.addEventListener("resize", function () { clearTimeout(rt); rt = w.setTimeout(size, 150); }, { passive: true });
    if ("IntersectionObserver" in w) new IntersectionObserver(function (es) { seen = es[0]!.isIntersecting; if (seen) kick(); }).observe(host); else { seen = true; kick(); }
    size();
  }
}
