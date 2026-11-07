// Cenas 3D do Spline (https://spline.design) nos sites gerados, via Spline Viewer (web component).
//
// O Spline é um editor 3D: as cenas são CRIADAS lá (conta no Spline) e publicadas com "Export → Viewer",
// que devolve um endereço terminado em .splinecode. O Hunter não cria cenas: ele recebe esse endereço
// (variável SPLINE_SCENES por ramo, ou campo no editor de cada site) e o integra com segurança:
//  - só aceita endereços https://prod.spline.design/.../scene.splinecode (lista fechada);
//  - o viewer é carregado do CDN oficial (unpkg), numa versão fixa, só quando a cena aparece na tela;
//  - em celular, com "reduzir movimento" ou economia de dados, a página usa a foto em profundidade
//    (mais rápida e legível), e a cena nunca é obrigatória: se falhar, a foto continua no lugar.

/** Versão fixa do viewer (testada). Atualizar só depois de testar. */
export const SPLINE_VIEWER_VERSION = "1.9.82";
export const SPLINE_VIEWER_SRC = `https://unpkg.com/@splinetool/viewer@${SPLINE_VIEWER_VERSION}/build/spline-viewer.js`;
export const SPLINE_SCENE_HOST = "https://prod.spline.design";

const SCENE_RE = /^https:\/\/prod\.spline\.design\/[A-Za-z0-9_-]{8,40}\/[A-Za-z0-9_.-]{1,80}\.splinecode$/;

export function isSplineUrl(url: string | undefined | null): url is string {
  return !!url && url.length <= 200 && SCENE_RE.test(url.trim());
}

/** SPLINE_SCENES='{"barbearia":"https://prod.spline.design/…/scene.splinecode","pizzaria":"…"}' → só entradas válidas. */
export function parseSplineScenes(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).filter(([k, v]) => /^[a-z]+$/.test(k) && typeof v === "string" && isSplineUrl(v)).map(([k, v]) => [k, (v as string).trim()]));
  } catch {
    return {};
  }
}

/**
 * Decide se a cena deve carregar neste aparelho (roda no navegador, serializado no site).
 * Retorna o motivo de não carregar, ou null para carregar. Texto em português para o rodapé de diagnóstico.
 */
export function splineSkipReason(env: { reduce: boolean; saveData: boolean; effectiveType: string; width: number; memory: number }): string | null {
  if (env.reduce) return "movimento reduzido";
  if (env.saveData || /(^|-)2g|3g/.test(env.effectiveType)) return "economia de dados";
  if (env.width < 700) return "tela pequena";
  if (env.memory && env.memory < 4) return "pouca memória";
  return null;
}

/**
 * Carregador da cena (serializado no site com toString, sem dependências).
 * Foto de reserva sempre presente; a cena entra por cima quando termina de carregar.
 */
export function splineRuntime(cfg: { src: string; url: string; skip: string }) {
  var host = document.querySelector("[data-spline]") as HTMLElement | null;
  if (!host) return;
  var nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  var why = cfg.skip ? cfg.skip : null;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var conn = nav.connection || {};
  var skipNow = function () {
    if (reduce) return "movimento reduzido";
    if (conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || "")) return "economia de dados";
    if (window.innerWidth < 700) return "tela pequena";
    if (nav.deviceMemory && nav.deviceMemory < 4) return "pouca memória";
    return null;
  };
  why = skipNow();
  host.setAttribute("data-spline-state", why ? "skipped:" + why : "waiting");
  if (why) return;
  var started = false;
  function start() {
    if (started) return;
    started = true;
    host!.setAttribute("data-spline-state", "loading");
    var done = false;
    function fail(reason: string) { if (!done) { done = true; host!.setAttribute("data-spline-state", "failed:" + reason); } }
    var timer = setTimeout(function () { fail("tempo esgotado"); }, 20000);
    var s = document.createElement("script");
    s.type = "module"; s.src = cfg.src; s.crossOrigin = "anonymous";
    s.onerror = function () { clearTimeout(timer); fail("viewer indisponível"); };
    s.onload = function () {
      customElements.whenDefined("spline-viewer").then(function () {
        var v = document.createElement("spline-viewer");
        v.setAttribute("url", cfg.url);
        v.setAttribute("loading-anim-type", "none");
        v.setAttribute("events-target", "global"); // o mouse age em qualquer lugar da página
        v.setAttribute("aria-hidden", "true");
        v.addEventListener("load-complete", function () {
          if (done) return;
          done = true; clearTimeout(timer);
          host!.setAttribute("data-spline-state", "live");
        });
        host!.appendChild(v);
      });
    };
    document.head.appendChild(s);
  }
  // Só carrega quando a cena aparece na tela e o navegador está ocioso (não disputa o carregamento inicial).
  var go = function () { if ((window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback) (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(start); else setTimeout(start, 600); };
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (e) { if (e[0]!.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: "200px" });
    io.observe(host);
  } else go();
  // Rolagem: a cena acompanha a página com uma leve rotação (só transform; pausa fora da tela).
  var raf = 0;
  window.addEventListener("scroll", function () {
    if (raf || host!.getAttribute("data-spline-state") !== "live") return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var r = host!.getBoundingClientRect(), p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight));
      host!.style.setProperty("--sp", p.toFixed(3));
    });
  }, { passive: true });
}
