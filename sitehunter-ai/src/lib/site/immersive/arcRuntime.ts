/* eslint-disable */
// @ts-nocheck
// Arco luminoso da abertura (inspirado em heros com "eclipse em chamas"): um anel que queima na borda de
// um disco escuro, atrás do painel da empresa. Roda no navegador do site (serializado com toString).
//  - kind: fire (brasas), gold (brasas douradas lentas), neon (anel nítido), sparks (faíscas),
//    halo (brilho suave que respira), pulse (ondas).
//  - reage ao ponteiro: as chamas crescem perto dele; sem ponteiro (celular) o brilho passeia sozinho.
//  - leve: camadas estáticas pré-desenhadas, chamas por sprite, 30 quadros/s, pausa fora da tela.
//  - sempre há um gradiente estático em CSS por baixo (sem canvas, ou com "reduzir movimento": um quadro só).
export function arcRuntime(cfg) {
  // Reutilizável (sites e interface do Hunter): seletores e posição do arco podem ser informados; devolve a limpeza.
  var cv = document.querySelector(cfg.canvas || "[data-arc]");
  if (!cv) return function () {};
  var ctx = cv.getContext("2d");
  if (!ctx) return function () {};
  var host = cv.parentElement;
  var panel = cfg.panel === null ? null : document.querySelector(cfg.panel || "[data-arc-panel]");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dark = cfg.dark, kind = cfg.kind, C = cfg.c;
  var W = 0, H = 0, cx = 0, cy = 0, R = 0, apex = 0, dpr = 1, small = false;
  var glowL, discL, sprite, spriteS;
  var parts = [], rings = [];
  var mx = 0.5, flare = 0.3, tgt = 0.3, auto = true, visible = true, raf = 0, t0 = performance.now(), last = t0, lastDraw = 0;

  function rgb(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  var c0 = rgb(C[0]), c1 = rgb(C[1]), c2 = rgb(C[2]);
  function col(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function layer() { var c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; var x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x]; }
  function makeSprite(a0) {
    var c = document.createElement("canvas"); c.width = c.height = 64; var x = c.getContext("2d");
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, col(c0, a0)); g.addColorStop(0.35, col(c1, a0 * 0.55)); g.addColorStop(1, col(c2, 0));
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
  }
  function n1(x) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); var a = Math.sin(i * 127.1) * 43758.5453, b = Math.sin((i + 1) * 127.1) * 43758.5453; return (a - Math.floor(a)) * (1 - f) + (b - Math.floor(b)) * f; }
  function point(a) { return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; }

  function size() {
    var r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    small = W < 700;
    dpr = small ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var top = panel ? panel.offsetTop : H * (cfg.apexRatio || 0.5);
    R = Math.min(W * (small ? 1.05 : 0.74), 1400);
    apex = top - (panel ? (small ? 14 : 30) : 0);
    cx = W / 2; cy = apex + R;
    // camada do brilho largo (estática)
    var L = layer(), g = L[1];
    var thick = (kind === "halo" ? 130 : kind === "neon" ? 80 : 100) * (small ? 0.7 : 1);
    var gr = g.createRadialGradient(cx, cy, R - 6, cx, cy, R + thick);
    gr.addColorStop(0, col(c1, dark ? 0.55 : 0.24)); gr.addColorStop(0.2, col(c2, dark ? 0.3 : 0.14)); gr.addColorStop(1, col(c2, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R + thick, Math.PI * 1.0, Math.PI * 2.0); g.arc(cx, cy, R - 6, Math.PI * 2.0, Math.PI * 1.0, true); g.fill();
    glowL = L[0];
    // camada do anel e do disco escuro (estática)
    var D = layer(), d = D[1], lw = kind === "neon" ? 2.4 : kind === "halo" ? 1.2 : 1.7;
    if (dark) { d.fillStyle = cfg.bg; d.beginPath(); d.arc(cx, cy, R - lw / 2, 0, 6.2832); d.fill(); }
    d.lineWidth = lw * 5; d.strokeStyle = col(c1, dark ? 0.18 : 0.1); d.beginPath(); d.arc(cx, cy, R, Math.PI * 1.02, Math.PI * 1.98); d.stroke();
    d.lineWidth = lw; d.strokeStyle = col(c0, dark ? 0.95 : 0.6); d.beginPath(); d.arc(cx, cy, R, Math.PI * 1.02, Math.PI * 1.98); d.stroke();
    discL = D[0];
    sprite = makeSprite(dark ? 0.9 : 0.35);
  }

  function spawn(a, boost) {
    var p = point(a), v = (kind === "sparks" ? 90 + Math.random() * 190 : 14 + Math.random() * 46) * (boost || 1);
    parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * v * 0.6 + (Math.random() - 0.5) * 22, vy: Math.sin(a) * v * (kind === "sparks" ? 1 : 0.55) - Math.random() * 18, life: 0, max: (kind === "sparks" ? 0.7 : 1.3) + Math.random() * 1.5, s: 0.8 + Math.random() * (kind === "sparks" ? 1.6 : 2.0), c: Math.random() < 0.55 ? c0 : c1 });
  }
  function ember() {
    parts.push({ x: Math.random() * W, y: apex - 20 - Math.random() * Math.max(60, apex), vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 12, life: 0, max: 3 + Math.random() * 3, s: 0.7 + Math.random() * 1.3, c: c1, soft: true });
  }

  function frame(now) {
    raf = 0;
    if (now - lastDraw < 30) { if (!reduce && visible) raf = requestAnimationFrame(frame); return; }
    lastDraw = now;
    var dt = Math.min(0.06, (now - last) / 1000); last = now;
    var t = (now - t0) / 1000;
    if (auto && !reduce) { mx = 0.5 + Math.sin(t * 0.45) * 0.32; tgt = 0.35 + Math.sin(t * 0.9) * 0.2; }
    flare += (tgt - flare) * Math.min(1, dt * 4);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    var breathe = kind === "halo" ? 0.82 + Math.sin(t * 1.2) * 0.18 : 1;
    ctx.globalAlpha = breathe; ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    ctx.drawImage(glowL, 0, 0, W, H);
    ctx.globalAlpha = 1;
    // línguas de fogo ao longo da borda (sprites)
    if (kind === "fire" || kind === "gold" || kind === "sparks" || kind === "pulse") {
      var amp = kind === "fire" ? 1 : kind === "gold" ? 0.7 : kind === "sparks" ? 0.4 : 0.55, n = small ? 28 : 56;
      for (var i = 0; i < n; i++) {
        var a = Math.PI * 1.05 + (i / (n - 1)) * Math.PI * 0.9, p = point(a);
        var near = Math.max(0, 1 - Math.abs(p[0] - mx * W) / (W * 0.22)) * flare;
        var h = (14 + n1(i * 0.5 + t * (kind === "gold" ? 1.1 : 2.1)) * 40 + n1(i * 1.7 - t * 3.2) * 18) * amp * (1 + near * 1.8);
        var s = (h + 12) * 2;
        ctx.drawImage(sprite, p[0] - s / 2, p[1] - h * 0.3 - s / 2, s, s);
      }
    }
    // ponto mais brilhante que acompanha o ponteiro
    var pa = Math.PI * 1.5 + (mx - 0.5) * Math.PI * 0.85, sp = point(pa), ss = 260 + flare * 200;
    ctx.globalAlpha = 0.45 + flare * 0.4;
    ctx.drawImage(sprite, sp[0] - ss / 2, sp[1] - ss / 2, ss, ss);
    ctx.globalAlpha = 1;
    // partículas
    if (!reduce) {
      var rate = (kind === "fire" ? 38 : kind === "gold" ? 15 : kind === "sparks" ? 14 : kind === "neon" ? 8 : kind === "pulse" ? 10 : 5) * (small ? 0.5 : 1) * (1 + flare * 2);
      var ns = rate * dt; ns = Math.floor(ns) + (Math.random() < ns % 1 ? 1 : 0);
      for (var q = 0; q < ns; q++) spawn(Math.PI * 1.06 + Math.random() * Math.PI * 0.88, 1 + flare);
      if (kind === "sparks" && flare > 0.3 && Math.random() < 0.6) spawn(pa + (Math.random() - 0.5) * 0.2, 1.6);
      if (Math.random() < dt * (small ? 2 : 4)) ember();
    }
    for (var k = parts.length - 1; k >= 0; k--) {
      var o = parts[k]; o.life += dt;
      if (o.life > o.max || o.y < -20 || o.y > H + 20) { parts.splice(k, 1); continue; }
      if (kind === "sparks" && !o.soft) o.vy += 380 * dt; else o.vy -= 6 * dt;
      o.x += o.vx * dt; o.y += o.vy * dt;
      ctx.fillStyle = col(o.c, (1 - o.life / o.max) * (o.soft ? 0.55 : 0.95) * (dark ? 1 : 0.6));
      ctx.fillRect(o.x - o.s, o.y - o.s, o.s * 2, o.s * 2);
    }
    if (parts.length > 300) parts.splice(0, parts.length - 300);
    // ondas (pulse)
    ctx.globalCompositeOperation = "source-over";
    if (kind === "pulse") {
      if (!rings.length || t - rings[rings.length - 1] > 1.6) rings.push(t);
      rings = rings.filter(function (s0) { return t - s0 < 3.2; });
      rings.forEach(function (s0) { var kk = (t - s0) / 3.2; ctx.strokeStyle = col(c1, (1 - kk) * (dark ? 0.5 : 0.3)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R + kk * 150, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke(); });
    }
    // disco escuro e anel nítido por cima
    ctx.drawImage(discL, 0, 0, W, H);
    if (!reduce && visible) raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !reduce && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  size();
  if (reduce) { frame(performance.now() + 100); }
  else start();
  var rt = 0;
  var onResize = function () { clearTimeout(rt); rt = setTimeout(function () { size(); if (reduce) frame(performance.now() + 100); }, 150); };
  window.addEventListener("resize", onResize, { passive: true });
  var io = null;
  if ("IntersectionObserver" in window) { io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }); io.observe(host); }
  var hero = host.closest(cfg.hero || ".hero") || host;
  var onMove = function (e) {
    if (e.pointerType === "touch") return;
    var r = host.getBoundingClientRect(); auto = false;
    mx = (e.clientX - r.left) / r.width;
    tgt = Math.max(0.15, 1 - Math.abs(e.clientY - r.top - apex) / (r.height * 0.45)); start();
  };
  var onLeave = function () { auto = true; };
  hero.addEventListener("pointermove", onMove, { passive: true });
  hero.addEventListener("pointerleave", onLeave);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(); if (reduce) frame(performance.now() + 100); });
  return function () {
    visible = false; if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(rt);
    window.removeEventListener("resize", onResize); if (io) io.disconnect();
    hero.removeEventListener("pointermove", onMove); hero.removeEventListener("pointerleave", onLeave);
  };
}
