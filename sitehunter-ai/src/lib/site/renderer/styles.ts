// Folha de estilo dos sites gerados. As cores derivadas são calculadas no servidor
// (sem color-mix) e o texto sobre cores de destaque sempre usa o par com melhor contraste.
import type { SiteContent } from "../types";
import { icon } from "../icons";
import { contrast, isDark, mix, onColor, readable, rgbStr } from "./color";

function patternSvg(iconName: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><g transform="translate(28 28)" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".5">${icon(iconName).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}")`;
}

export function tokens(c: SiteContent) {
  const th = c.theme;
  const heroBg = isDark(th.primary) ? mix(th.primary, "#05060a", 0.35) : mix(th.primary, "#05060a", 0.6);
  return {
    heroBg,
    // Texto/realce sobre o fundo da página (ex.: rótulos, preços): contraste mínimo 4,5:1
    accentText: readable(contrast(th.accent, th.background) >= 3 ? th.accent : th.primary, th.background, 4.5),
    primaryText: readable(th.primary, th.background, 4.5),
    onAccent: onColor(th.accent),
    onPrimary: onColor(th.primary),
    muted: readable(th.muted, th.background, 4.5),
    mutedOnSurface: readable(th.muted, th.surface, 4.5),
    footerBg: isDark(th.background) ? mix(th.background, "#000000", 0.35) : mix(th.background, "#0b0d12", 0.92),
    ctaBg: mix(th.primary, "#000000", 0.35),
    artDark: mix(th.primary, "#000000", 0.55),
  };
}

export function css(c: SiteContent): string {
  const th = c.theme;
  const t = tokens(c);
  const radius = th.radius === "none" ? "2px" : th.radius === "md" ? "12px" : "22px";
  return `
:root{--p:${th.primary};--p-rgb:${rgbStr(th.primary)};--a:${th.accent};--a-rgb:${rgbStr(th.accent)};--bg:${th.background};--bg-rgb:${rgbStr(th.background)};--sf:${th.surface};--tx:${th.text};--tx-rgb:${rgbStr(th.text)};--mu:${t.muted};--mu-sf:${t.mutedOnSurface};--a-tx:${t.accentText};--p-tx:${t.primaryText};--on-a:${t.onAccent};--on-p:${t.onPrimary};--hero:${t.heroBg};--r:${radius};--hf:'${th.headingFont}',Georgia,'Times New Roman',serif;--bf:'${th.bodyFont}',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;--line:rgba(var(--tx-rgb),.12);--ease:cubic-bezier(.2,.7,.2,1);--fs-h1:clamp(2.5rem,6.8vw,5.4rem);--fs-h2:clamp(1.9rem,4.2vw,3.1rem);--fs-h3:1.22rem;--sp-sec:clamp(72px,10vw,128px);--wrap:1180px}
*,*::before,*::after{box-sizing:border-box}
*{margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-padding-top:84px}
body{font-family:var(--bf);background:var(--bg);color:var(--tx);line-height:1.65;font-size:1.0625rem;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img,svg,iframe{max-width:100%;display:block}
a{color:inherit}
button,input,textarea{font:inherit;color:inherit}
h1,h2,h3,h4{font-family:var(--hf);line-height:1.1;letter-spacing:-.015em;text-wrap:balance;font-weight:700}
ul,ol{list-style:none}
:focus-visible{outline:3px solid var(--a-tx);outline-offset:3px;border-radius:4px}
.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.skip{position:fixed;left:16px;top:-60px;z-index:100;background:var(--a);color:var(--on-a);padding:12px 18px;border-radius:10px;font-weight:700;text-decoration:none;transition:top .2s}
.skip:focus{top:16px}
.wrap{width:min(var(--wrap),100% - 40px);margin-inline:auto}
.narrow{width:min(820px,100% - 40px);margin-inline:auto}
.center{text-align:center}
.fine{font-size:.875rem;color:var(--mu);margin-top:18px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:.78rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--a-tx)}
.ei{width:16px;height:16px;flex:none}
.ic{width:26px;height:26px}
.bi{width:18px;height:18px;flex:none}

/* Cabeçalho */
.topbar{position:fixed;top:0;left:0;right:0;z-index:50;transition:background-color .4s,box-shadow .4s,padding .4s;padding:18px 0}
.topbar.solid{background:rgba(var(--bg-rgb),.94);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 1px 0 var(--line);padding:10px 0}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--hf);font-weight:700;font-size:1.2rem;color:#fff;transition:color .4s;min-width:0}
.brand span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.brand .bm{width:38px;height:38px;flex:none;border-radius:calc(var(--r) * .6);display:grid;place-items:center;background:var(--a);color:var(--on-a)}
.brand .bm svg{width:20px;height:20px}
.topbar.solid .brand{color:var(--tx)}
.nav{display:flex;align-items:center;gap:24px}
.nav a{text-decoration:none;font-size:.95rem;font-weight:500;position:relative}
.nav a:not(.btn){color:rgba(255,255,255,.92);padding:6px 0;transition:color .3s}
.nav a:not(.btn)::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--a);transform:scaleX(0);transform-origin:left;transition:transform .35s var(--ease)}
.nav a:not(.btn):hover::after,.nav a:not(.btn):focus-visible::after{transform:scaleX(1)}
.topbar.solid .nav a:not(.btn){color:var(--tx)}
.burger{display:none}

/* Botões: área de toque mínima de 44px */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:12px 24px;border-radius:var(--r);font-weight:700;font-size:1rem;line-height:1.2;text-decoration:none;border:0;cursor:pointer;transition:transform .3s var(--ease),box-shadow .3s,background-color .3s,color .3s;position:relative;overflow:hidden;isolation:isolate;text-align:center}
.btn-lg{min-height:56px;padding:15px 30px;font-size:1.05rem}
.btn-sm{min-height:44px;padding:10px 18px;font-size:.92rem}
.btn-main{background:var(--a);color:var(--on-a);box-shadow:0 14px 30px -12px rgba(var(--a-rgb),.75)}
.btn-main::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-120%);transition:transform .7s var(--ease);z-index:-1}
.btn-main:hover::before{transform:translateX(120%)}
.btn:hover{transform:translateY(-3px)}
.btn:active{transform:translateY(0)}
.btn-ghost{background:transparent;color:inherit;box-shadow:inset 0 0 0 2px currentColor}
.btn-ghost:hover{background:rgba(127,127,127,.12)}
.btn-light{background:#fff;color:#111;box-shadow:0 14px 30px -12px rgba(0,0,0,.5)}
.btn[aria-busy="true"]{opacity:.7;pointer-events:none}

/* Capa */
.hero{position:relative;min-height:min(100vh,900px);display:flex;align-items:center;padding:140px 0 110px;color:#fff;overflow:hidden;background:var(--hero)}
.hero-bg{position:absolute;inset:0;overflow:hidden}
.hero-photo{position:absolute;inset:-4%;width:108%;height:108%;max-width:none;object-fit:cover;animation:kb 24s ease-in-out infinite alternate}
.hero.has-img .hero-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 50%,rgba(0,0,0,.3) 100%)}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.1) translate(-1%,-1%)}}
.orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.7;animation:float 16s ease-in-out infinite alternate;will-change:transform}
.o1{width:46vw;height:46vw;max-width:620px;max-height:620px;background:var(--p);left:-12%;top:-20%}
.o2{width:36vw;height:36vw;max-width:480px;max-height:480px;background:var(--a);right:-8%;bottom:-25%;opacity:.4;animation-duration:20s}
.o3{width:24vw;height:24vw;max-width:320px;max-height:320px;background:${mix(th.primary, "#ffffff", 0.5)};right:22%;top:8%;opacity:.22;animation-duration:24s}
.hero.has-img .orb{opacity:.25}
@keyframes float{0%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,8%) scale(1.08)}100%{transform:translate(-4%,3%) scale(.96)}}
.pattern{position:absolute;inset:0;background-image:${patternSvg(c.icon, "#ffffff")};opacity:.07;-webkit-mask-image:radial-gradient(ellipse at 70% 40%,#000 0%,transparent 70%);mask-image:radial-gradient(ellipse at 70% 40%,#000 0%,transparent 70%);animation:drift 60s linear infinite}
@keyframes drift{to{background-position:400px 400px}}
.hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:48px;align-items:center}
.hero-inner{min-width:0}
.hero-eyebrow{color:${readable(th.accent, t.heroBg, 4.5)};margin-bottom:22px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);animation:up .9s var(--ease) both}
.hero h1{font-size:var(--fs-h1);max-width:15ch;margin-bottom:22px}
.hero h1 .w{display:inline-block;animation:wup 1s var(--ease) both;animation-delay:calc(.15s + var(--i) * .08s)}
@keyframes wup{from{opacity:0;transform:translateY(40%);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.hero .lead{font-size:clamp(1.08rem,2vw,1.3rem);max-width:56ch;color:rgba(255,255,255,.9);margin-bottom:34px;animation:up 1s .55s var(--ease) both}
.actions{display:flex;flex-wrap:wrap;gap:14px;animation:up 1s .7s var(--ease) both}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:34px;animation:up 1s .85s var(--ease) both}
.chip{display:inline-flex;align-items:center;gap:8px;font-size:.9rem;padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.16)}
.ci{width:15px;height:15px;flex:none;color:${readable(th.accent, t.heroBg, 3)}}
.hero-card{justify-self:end;width:100%;max-width:380px;padding:24px;border-radius:calc(var(--r) * 1.2);background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:0 40px 80px -30px rgba(0,0,0,.6);animation:up 1.1s .6s var(--ease) both,bob 7s 1.8s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-12px)}}
.hc-head{display:flex;gap:14px;align-items:center;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.16)}
.hc-badge{width:46px;height:46px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--a);color:var(--on-a)}
.hc-badge svg{width:22px;height:22px}
.hc-name{font-family:var(--hf);font-size:1.1rem;font-weight:700}
.hc-sub{font-size:.78rem;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.12em}
.hero-card ul{padding:8px 0}
.hero-card li{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px dashed rgba(255,255,255,.16);font-size:.97rem;animation:up .8s var(--ease) both;animation-delay:calc(1s + var(--i) * .12s)}
.hero-card li em{font-style:normal;color:${readable(th.accent, t.heroBg, 4.5)};font-size:.86rem;white-space:nowrap}
.hc-foot{display:flex;gap:10px;align-items:center;font-size:.9rem;color:rgba(255,255,255,.9);padding-top:8px}
.scroll-cue{position:absolute;left:50%;bottom:28px;width:28px;height:46px;border:2px solid rgba(255,255,255,.55);border-radius:20px;transform:translateX(-50%);z-index:2}
.scroll-cue span[aria-hidden]{position:absolute;left:50%;top:8px;width:4px;height:9px;margin-left:-2px;border-radius:2px;background:#fff;animation:cue 1.8s ease-in-out infinite}
@keyframes cue{0%{opacity:0;transform:translateY(0)}40%{opacity:1}100%{opacity:0;transform:translateY(16px)}}
.hero-credit{position:absolute;right:14px;bottom:10px;font-size:.72rem;color:rgba(255,255,255,.75);z-index:2}

.marquee{overflow:hidden;background:var(--a);color:var(--on-a);padding:15px 0}
.mq-track{display:flex;width:max-content;animation:mq 40s linear infinite;align-items:center}
.mq-track span{font-family:var(--hf);font-weight:700;font-size:1.1rem;white-space:nowrap;padding:0 22px;text-transform:uppercase;letter-spacing:.04em}
.mq-track i{display:grid}
.mi{width:20px;height:20px}
@keyframes mq{to{transform:translateX(-50%)}}

/* Seções */
.sec{padding:var(--sp-sec) 0;position:relative}
.sec.alt{background:var(--sf)}
.sec.alt .lede,.sec.alt .fine,.sec.alt .card p{color:var(--mu-sf)}
.sh{margin-bottom:clamp(32px,5vw,56px);max-width:720px}
.center .sh,.narrow .sh{margin-inline:auto;text-align:center}
.sh h2{font-size:var(--fs-h2);margin-top:10px}
.lede{color:var(--mu);font-size:1.1rem;margin-top:14px;max-width:62ch}
.center .lede,.narrow .lede{margin-inline:auto}
.prose p{margin-bottom:16px;font-size:1.08rem;color:rgba(var(--tx-rgb),.88);max-width:65ch}
.split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(36px,6vw,90px);align-items:center}

.hl{padding:clamp(56px,8vw,96px) 0}
.hl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:20px}
.hl-card{padding:28px;border-radius:var(--r);background:var(--sf);border:1px solid var(--line);transition:transform .4s var(--ease),border-color .4s}
.hl-card:hover{transform:translateY(-6px);border-color:rgba(var(--a-rgb),.6)}
.hl-ic{width:56px;height:56px;border-radius:calc(var(--r) * .7);display:grid;place-items:center;background:rgba(var(--p-rgb),.14);color:var(--p-tx);margin-bottom:18px}
.hl-card h3{font-size:var(--fs-h3);margin-bottom:8px}
.hl-card p{color:var(--mu-sf)}

.about-art{position:relative;aspect-ratio:1;max-width:460px;width:100%;justify-self:center;border-radius:calc(var(--r) * 2);background:radial-gradient(circle at 30% 25%,rgba(var(--a-rgb),.55),transparent 55%),linear-gradient(145deg,var(--p),${t.artDark});display:grid;place-items:center;overflow:hidden;box-shadow:0 40px 80px -40px rgba(var(--p-rgb),.8)}
.aa-ring{position:absolute;inset:12%;border-radius:50%;border:1px dashed rgba(255,255,255,.35);animation:spin 40s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.aa-mark{width:38%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);color:#fff;animation:pulse 4s ease-in-out infinite}
.aa-ic{width:46%;height:46%}
@keyframes pulse{50%{transform:scale(1.06)}}
.aa-name{position:absolute;bottom:9%;left:0;right:0;text-align:center;color:#fff;font-family:var(--hf);font-size:1.2rem;font-weight:700;padding:0 20px}
.about-img img{border-radius:calc(var(--r) * 1.5);aspect-ratio:4/5;object-fit:cover;width:100%;box-shadow:0 40px 80px -40px rgba(0,0,0,.6)}
figcaption{font-size:.75rem;color:var(--mu);margin-top:8px}
figcaption a{color:inherit}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:20px}
.card{position:relative;padding:32px 28px;border-radius:var(--r);background:var(--bg);border:1px solid var(--line);transition:transform .45s var(--ease),box-shadow .45s,border-color .45s;overflow:hidden}
.card::after{content:"";position:absolute;right:-40%;bottom:-60%;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(var(--a-rgb),.25),transparent 70%);opacity:0;transition:opacity .5s;pointer-events:none}
.card:hover{transform:translateY(-8px);box-shadow:0 30px 60px -30px rgba(var(--p-rgb),.55);border-color:rgba(var(--p-rgb),.4)}
.card:hover::after{opacity:1}
.card-ic{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:var(--p);color:var(--on-p);margin-bottom:20px;transition:transform .5s var(--ease)}
.card:hover .card-ic{transform:rotate(-8deg) scale(1.08)}
.card h3{font-size:var(--fs-h3);margin-bottom:10px}
.card p{color:var(--mu)}
.prod-art{aspect-ratio:4/3;border-radius:calc(var(--r) * .7);margin:-8px -4px 22px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(var(--p-rgb),.18),rgba(var(--a-rgb),.18));color:var(--p-tx)}
.prod-art svg{width:56px;height:56px}
.card-img img{border-radius:calc(var(--r) * .7);margin-bottom:20px;aspect-ratio:4/3;object-fit:cover;width:100%}

.price-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:4px 48px}
.price-list li{display:flex;gap:18px;padding:22px 0;border-bottom:1px solid var(--line)}
.pl-ic{width:48px;height:48px;flex:none;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(var(--a-rgb),.5);color:var(--a-tx)}
.pl-ic svg{width:22px;height:22px}
.pl-main{flex:1;min-width:0}
.pl-row,.m-row{display:flex;align-items:baseline;gap:12px}
.pl-row h3,.m-row h4{font-size:1.15rem;min-width:0;overflow-wrap:anywhere}
.dots{flex:1;border-bottom:2px dotted rgba(var(--tx-rgb),.3);transform:translateY(-5px);min-width:20px}
.pl-price,.m-price{font-weight:800;color:var(--a-tx);white-space:nowrap}
.sec.alt .pl-price,.sec.alt .m-price{color:${readable(contrast(th.accent, th.surface) >= 3 ? th.accent : th.primary, th.surface, 4.5)}}
.pl-main p{color:var(--mu-sf);margin-top:4px;font-size:.97rem}

.menu-sec{background:var(--sf)}
.menu-sec .lede,.menu-sec .fine,.menu li p{color:var(--mu-sf)}
.menu-sec .m-price{color:${readable(contrast(th.accent, th.surface) >= 3 ? th.accent : th.primary, th.surface, 4.5)}}
.tabs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:36px}
.tab{font-weight:700;min-height:44px;padding:10px 22px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--tx);cursor:pointer;transition:background-color .3s,color .3s,border-color .3s,box-shadow .3s}
.tab:hover{border-color:var(--a)}
.tab.on{background:var(--a);color:var(--on-a);border-color:var(--a);box-shadow:0 10px 24px -10px rgba(var(--a-rgb),.8)}
.mp-title{display:none;font-size:1.5rem;margin:10px 0 18px}
.js .menu-panel{display:none}
.js .menu-panel.on{display:block;animation:up .6s var(--ease) both}
html:not(.js) .mp-title{display:block}
html:not(.js) .tabs{display:none}
.menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:6px 56px}
.menu li{padding:20px 0;border-bottom:1px solid var(--line)}
.menu li p{margin-top:6px;font-size:.97rem}

.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:24px}
.steps li{display:flex;gap:18px;padding:28px;border-radius:var(--r);border:1px solid var(--line);background:var(--sf)}
.st-n{flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-family:var(--hf);font-weight:800;font-size:1.3rem;background:var(--p);color:var(--on-p)}
.steps h3{font-size:var(--fs-h3);margin-bottom:6px}
.steps p{color:var(--mu-sf)}

.hours-card{position:relative;padding:36px clamp(22px,5vw,56px);border-radius:calc(var(--r) * 1.4);background:var(--sf);border:1px solid var(--line);overflow:hidden}
.hc-ic{position:absolute;right:-30px;top:-30px;width:180px;height:180px;color:rgba(var(--p-rgb),.08)}
.hours div{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}
.hours div:last-child{border-bottom:0}
.hours div.today{font-weight:700}
.hours div.today dt::after{content:"hoje";margin-left:10px;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;background:var(--a);color:var(--on-a);padding:2px 8px;border-radius:999px;vertical-align:middle}
.hours dt{font-weight:600}
.hours dd{text-align:right}

.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:14px}
.g-item{overflow:hidden;border-radius:var(--r)}
.g-item img{aspect-ratio:1;object-fit:cover;width:100%;transition:transform .8s var(--ease)}
.g-item:hover img{transform:scale(1.06)}

.faq{display:grid;gap:12px}
.faq details{border:1px solid var(--line);border-radius:var(--r);background:var(--bg);overflow:hidden}
.faq summary{list-style:none;cursor:pointer;padding:20px 24px;min-height:44px;font-weight:700;font-size:1.05rem;display:flex;justify-content:space-between;gap:20px;align-items:center}
.faq summary::-webkit-details-marker{display:none}
.fq-ic{width:22px;height:22px;flex:none;position:relative}
.fq-ic::before,.fq-ic::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:2px;background:var(--a-tx);transform:translate(-50%,-50%);transition:transform .35s var(--ease)}
.fq-ic::after{transform:translate(-50%,-50%) rotate(90deg)}
details[open] .fq-ic::after{transform:translate(-50%,-50%) rotate(0)}
.fq-a{padding:0 24px 22px;color:var(--mu)}
details[open] .fq-a{animation:up .45s var(--ease) both}

.cta{position:relative;padding:clamp(84px,11vw,140px) 0;color:#fff;overflow:hidden;background:linear-gradient(120deg,var(--p),${t.ctaBg})}
.cta-bg{position:absolute;inset:0;background-image:${patternSvg(c.icon, "#ffffff")};opacity:.1}
.shine{position:absolute;inset:-50%;background:conic-gradient(from 0deg,transparent,rgba(var(--a-rgb),.35),transparent 30%);animation:spin 14s linear infinite}
.cta .wrap{position:relative;z-index:1}
.cta h2{font-size:var(--fs-h2);margin-bottom:16px}
.cta p{font-size:1.15rem;color:rgba(255,255,255,.92);margin:0 auto 32px;max-width:56ch}

/* Formulário com validação */
.ticks{display:grid;gap:12px;margin-top:10px}
.ticks li{display:flex;align-items:center;gap:12px;font-weight:600}
.ti{width:22px;height:22px;flex:none;padding:3px;border-radius:50%;background:var(--a);color:var(--on-a)}
.quote{display:grid;gap:16px;padding:clamp(24px,4vw,40px);border-radius:calc(var(--r) * 1.3);background:var(--bg);border:1px solid var(--line);box-shadow:0 40px 80px -50px rgba(var(--p-rgb),.6)}
.fld{display:grid;gap:6px}
.fld label{font-weight:600;font-size:.95rem}
.fld .opt{font-weight:400;color:var(--mu)}
.fld input,.fld textarea{width:100%;min-height:48px;padding:12px 14px;border-radius:calc(var(--r) * .6);border:1px solid rgba(var(--tx-rgb),.25);background:var(--sf);color:var(--tx);transition:border-color .3s,box-shadow .3s}
.fld input:focus,.fld textarea:focus{outline:none;border-color:var(--a-tx);box-shadow:0 0 0 4px rgba(var(--a-rgb),.22)}
.fld [aria-invalid="true"]{border-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.15)}
.err{min-height:1.2em;font-size:.85rem;color:${isDark(th.background) ? "#fca5a5" : "#b91c1c"}}
.form-status{font-size:.95rem;border-radius:calc(var(--r) * .6)}
.form-status:not(:empty){padding:12px 14px}
.form-status.ok{background:rgba(22,163,74,.12);color:${isDark(th.background) ? "#86efac" : "#166534"}}
.form-status.fail{background:rgba(220,38,38,.12);color:${isDark(th.background) ? "#fca5a5" : "#991b1b"}}
.form-status a{font-weight:700}

/* Contato e mapa */
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px;align-content:start}
.contact li{display:flex;gap:16px;padding:22px;border-radius:var(--r);background:var(--sf);border:1px solid var(--line);transition:transform .4s var(--ease),border-color .4s;min-width:0}
.contact li:hover{transform:translateY(-4px);border-color:rgba(var(--a-rgb),.5)}
.contact li>div{min-width:0}
.ct-ic{width:46px;height:46px;flex:none;padding:11px;border-radius:50%;background:rgba(var(--p-rgb),.14);color:var(--p-tx)}
.ct-k{font-size:.76rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mu-sf);margin-bottom:2px}
.contact a{color:var(--tx);font-weight:600;text-decoration-color:rgba(var(--a-rgb),.7);text-underline-offset:4px}
.contact p{overflow-wrap:anywhere}
.contact-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:24px;align-items:start}
.contact-grid .contact{grid-template-columns:1fr}
.map-card{display:grid;gap:14px}
.map-frame{position:relative;border-radius:calc(var(--r) * 1.2);overflow:hidden;border:1px solid var(--line);aspect-ratio:4/3;background:var(--sf) linear-gradient(90deg,var(--sf),rgba(var(--tx-rgb),.06),var(--sf)) 0 0/200% 100%;animation:shimmer 1.6s linear infinite}
.map-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
@keyframes shimmer{to{background-position:-200% 0}}
.map-ph{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:10px;text-align:center;padding:20px;color:var(--mu-sf)}
.mp-ic{width:40px;height:40px;color:var(--p-tx)}
.map-actions{display:flex;flex-wrap:wrap;gap:12px}
.map-card.solo{margin-top:24px}

footer{padding:56px 0 36px;background:${t.footerBg};color:rgba(255,255,255,.82)}
.f-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:28px;align-items:center;padding-bottom:30px;border-bottom:1px solid rgba(255,255,255,.12)}
.f-brand{font-family:var(--hf);font-size:1.5rem;font-weight:700;color:#fff}
.f-nav{display:flex;flex-wrap:wrap;gap:6px 22px}
.f-nav a{text-decoration:none;font-size:.95rem;padding:8px 0}
.f-nav a:hover{color:#fff;text-decoration:underline}
.f-bot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding-top:22px;font-size:.86rem;color:rgba(255,255,255,.7)}

.wa-float{position:fixed;right:max(20px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;background:#25d366;display:grid;place-items:center;box-shadow:0 12px 30px rgba(0,0,0,.3);z-index:60;transition:transform .3s var(--ease)}
.wa-float::before{content:"";position:absolute;inset:0;border-radius:50%;background:#25d366;animation:ring 2.4s ease-out infinite;z-index:-1}
@keyframes ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.7);opacity:0}}
.wa-float:hover{transform:scale(1.08)}
.wa-float svg{width:32px;height:32px;fill:#fff}
.progress{position:fixed;top:0;left:0;height:3px;width:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,var(--p),var(--a));z-index:70}
.mbar{display:none}

/* Entrada ao rolar: visível sem JS; com JS anima ao entrar na tela */
.js .rv{opacity:0;transform:translateY(30px);transition:opacity .8s var(--ease),transform .8s var(--ease);transition-delay:calc(var(--d,0) * 80ms)}
.js .rv.in{opacity:1;transform:none}

/* Estilos por segmento */
.st-elegant h1,.st-elegant h2,.st-elegant h3{font-weight:600;letter-spacing:0}
.st-elegant .sh h2::after,.st-editorial .sh h2::after{content:"";display:block;width:64px;height:2px;background:var(--a);margin-top:20px}
.st-elegant .center .sh h2::after,.st-elegant .narrow .sh h2::after,.st-editorial .narrow .sh h2::after{margin-inline:auto}
.st-elegant .eyebrow::before{content:"✦";font-size:.7rem}
.st-bold h1,.st-bold h2{text-transform:uppercase;letter-spacing:.01em}
.st-bold .hero h1{font-size:clamp(2.8rem,9.5vw,7rem);line-height:.95}
.st-bold .sec.alt{background-image:repeating-linear-gradient(135deg,transparent 0 22px,rgba(var(--tx-rgb),.025) 22px 44px)}
.st-industrial .sec.alt{background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:44px 44px}
.st-industrial .eyebrow{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em}
.st-industrial .card{border-left:4px solid var(--a)}
.st-industrial .hero h1{text-transform:uppercase}
.st-clean .card-ic,.st-corporate .card-ic{background:rgba(var(--p-rgb),.12);color:var(--p-tx)}
.st-editorial h2{font-weight:600;font-style:italic}
.st-corporate .hero{min-height:min(88vh,820px)}

@media (max-width:980px){
  .contact-grid{grid-template-columns:1fr}
}
@media (max-width:860px){
  body{font-size:1rem}
  .burger{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;border:0;cursor:pointer;color:#fff;background:rgba(255,255,255,.12)}
  .topbar.solid .burger{color:var(--tx);background:var(--sf)}
  .burger i,.burger i::before,.burger i::after{display:block;width:20px;height:2px;background:currentColor;position:relative;transition:transform .3s,background-color .3s}
  .burger i::before,.burger i::after{content:"";position:absolute;left:0}
  .burger i::before{top:-6px}.burger i::after{top:6px}
  .nav-open .burger i{background:transparent}
  .nav-open .burger i::before{transform:translateY(6px) rotate(45deg)}
  .nav-open .burger i::after{transform:translateY(-6px) rotate(-45deg)}
  .js .nav{position:fixed;top:72px;left:14px;right:14px;flex-direction:column;align-items:stretch;gap:0;padding:10px;border-radius:18px;background:var(--bg);box-shadow:0 30px 60px rgba(0,0,0,.35);transform:translateY(-12px);opacity:0;visibility:hidden;transition:opacity .3s,transform .3s var(--ease),visibility .3s}
  .js .nav a:not(.btn){color:var(--tx)!important;padding:14px 16px;border-radius:12px}
  .js .nav a:not(.btn)::after{display:none}
  .js .nav .btn{margin-top:6px}
  .nav-open .nav{transform:none;opacity:1;visibility:visible}
  html:not(.js) .burger{display:none}
  html:not(.js) .nav{flex-wrap:wrap;gap:4px 16px}
  .split,.hero-grid{grid-template-columns:1fr}
  .hero{padding:120px 0 90px;min-height:auto}
  .hero-card{justify-self:start;max-width:100%}
  .scroll-cue{display:none}
  .mbar{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;position:fixed;left:0;right:0;bottom:0;z-index:65;background:rgba(var(--bg-rgb),.97);border-top:1px solid var(--line);padding:8px 10px max(8px,env(safe-area-inset-bottom));gap:8px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
  .mbar a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:52px;border-radius:12px;text-decoration:none;font-size:.78rem;font-weight:700;color:var(--tx)}
  .mbar a.mb-main{background:#25d366;color:#08240f}
  .mb-ic{width:20px;height:20px}
  body.has-mbar{padding-bottom:76px}
  body.has-mbar .wa-float{display:none}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  .js .rv{opacity:1;transform:none}
}
@media print{.topbar,.mbar,.wa-float,.progress,.marquee,.scroll-cue{display:none!important}.hero{min-height:auto;padding:40px 0}}
`;
}
