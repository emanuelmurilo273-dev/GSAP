// @ts-nocheck
/* eslint-disable */
// Runtime 3D da Vitrine (roda no navegador do visitante). Esta função é serializada com
// toString() e embutida no HTML do site, então NÃO pode usar imports nem variáveis de fora.
// Depende apenas de window.THREE (three.js r128, MIT), servido junto com o app.
//
// O que faz: monta um objeto 3D procedural do negócio (tesoura, dente, xícara, roda...), com
// materiais PBR e um "estúdio" de luz próprio (reflexos reais em metal e cerâmica), e liga a
// pose do objeto à rolagem: cada capítulo tem posição, ângulo e escala; objetos secundários
// entram em cena vindos do fundo; partículas/anéis/grade reforçam a profundidade.
// Movimento reduzido: poses fixas por capítulo, sem giro contínuo. Sem WebGL: mostra a arte estática.

export function immersiveRuntime(cfg) {
  var d = document, w = window, root = d.documentElement;
  var reduce = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var chapters = [].slice.call(d.querySelectorAll("[data-ch]"));
  var cards = [].slice.call(d.querySelectorAll("[data-depth]"));

  // ---------- revelação dos textos (vale mesmo sem 3D) ----------
  var io = "IntersectionObserver" in w ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); countUp(e.target); } });
  }, { threshold: 0.18 }) : null;
  chapters.forEach(function (c) { io ? io.observe(c) : c.classList.add("in"); });
  function countUp(el) {
    [].slice.call(el.querySelectorAll("[data-count]")).forEach(function (n) {
      if (n.dataset.done) return; n.dataset.done = "1";
      var to = parseFloat(String(n.dataset.count).replace(",", ".")), dec = (String(n.dataset.count).split(/[.,]/)[1] || "").length;
      if (reduce || !isFinite(to)) return;
      var t0 = performance.now();
      (function step(t) { var k = Math.min(1, (t - t0) / 1100); n.textContent = (to * (1 - Math.pow(1 - k, 3))).toFixed(dec).replace(".", ","); if (k < 1) requestAnimationFrame(step); })(t0);
    });
  }

  var T = w.THREE;
  if (!T) { root.classList.add("no3d"); return; }
  var canvas = d.getElementById("stage3d");
  var renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { root.classList.add("no3d"); return; }
  var mobile = w.innerWidth < 760;
  renderer.setPixelRatio(Math.min(w.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  root.classList.add("has3d");

  // three r128 trata cores hex como lineares: converte de sRGB para não "lavar" as cores com a saída sRGB.
  function C(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  var P = cfg.pal, accent = C(P.accent), accent2 = C(P.accent2);
  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(32, 1, 0.1, 120);
  camera.position.set(0, 0, 11);

  // ---------- estúdio de luz (mapa de ambiente gerado na hora) ----------
  (function () {
    var pm = new T.PMREMGenerator(renderer), env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x0c0c0e, side: T.BackSide })));
    function panel(wd, ht, color, k, x, y, z) {
      var m = new T.Mesh(new T.PlaneGeometry(wd, ht), new T.MeshBasicMaterial({ color: C(color).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(10, 3, "#ffffff", 7, 0, 8, 5);
    panel(3, 10, "#ffffff", 3.2, -9, 1, 3);
    panel(3, 9, P.accent, 3.5, 9, 0, -2);
    panel(12, 2, "#ffffff", 1.2, 0, -8, 0);
    panel(4, 4, "#ffffff", 2, 4, 3, 8);
    scene.environment = pm.fromScene(env, 0.035).texture;
    pm.dispose();
  })();
  var key = new T.DirectionalLight(0xffffff, 1.1); key.position.set(4, 6, 5); scene.add(key);
  var rim = new T.PointLight(accent, 26, 22, 2); rim.position.set(-4, -1, -3.5); scene.add(rim);
  var fill = new T.PointLight(0xffffff, 6, 18, 2); fill.position.set(3, -3, 6); scene.add(fill);

  // ---------- materiais ----------
  function M(o) { return new T.MeshPhysicalMaterial(o); }
  var MAT = {
    chrome: function () { return M({ color: C(0xeeeef2), metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }); },
    gold: function () { return M({ color: C(0xe6b866), metalness: 1, roughness: 0.2, clearcoat: 0.6 }); },
    copper: function () { return M({ color: C(0xd08a5c), metalness: 1, roughness: 0.26 }); },
    ceramic: function () { return M({ color: C(0xe9e4da), metalness: 0, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.7 }); },
    matte: function () { return M({ color: C(0x1c1c21), metalness: 0.35, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 }); },
    pearl: function () { return M({ color: C(0xebe3e7), metalness: 0.15, roughness: 0.32, clearcoat: 1, envMapIntensity: 0.75 }); },
    glass: function () { return M({ color: C(0xffffff), metalness: 0, roughness: 0.04, transmission: 0.92, transparent: true, opacity: 0.55, clearcoat: 1 }); },
  };
  function main() { return (MAT[cfg.material] || MAT.chrome)(); }
  function solid(hex, rough, metal, extra) { var o = { color: C(hex), roughness: rough == null ? 0.5 : rough, metalness: metal || 0, envMapIntensity: metal ? 1 : 0.55 }; if (extra) for (var k in extra) o[k] = extra[k]; return M(o); }
  function glow(c, o) { return new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o == null ? 1 : o }); }
  var ACC = function () { return solid(P.accent, 0.35, 0.3, { clearcoat: 0.6 }); };

  // ---------- geometria ----------
  function mesh(g, m, x, y, z, rx, ry, rz, s) { var o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); if (s) o.scale.setScalar(s); return o; }
  function lathe(pts, seg) { return new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || 72); }
  function extrude(shape, depth, bevel) { var g = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: bevel == null ? 0.03 : bevel, bevelSize: bevel == null ? 0.03 : bevel, bevelSegments: 4, curveSegments: 28 }); g.center(); return g; }
  function shape(pts) { var s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
  function tube(pts, r, closed) { return new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2] || 0); }), !!closed), 160, r, 14, !!closed); }
  function rnd(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function stripes(c1, c2, c3) {
    var cv = d.createElement("canvas"); cv.width = 256; cv.height = 256; var x = cv.getContext("2d");
    x.fillStyle = c2; x.fillRect(0, 0, 256, 256);
    for (var i = -4; i < 8; i++) { x.fillStyle = i % 2 ? c1 : c3; x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + 128, 256); x.lineTo(i * 64 + 128, 256); x.fill(); }
    var t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, 2); t.encoding = T.sRGBEncoding; return t;
  }

  var B = {
    scissors: function () {
      var g = new T.Group(), m = main();
      var blade = new T.Shape(); blade.moveTo(-0.16, 0); blade.quadraticCurveTo(-0.1, 1.8, 0.04, 3.4); blade.lineTo(0.1, 3.38); blade.quadraticCurveTo(0.34, 1.7, 0.2, 0); blade.closePath();
      var bg = new T.ExtrudeGeometry(blade, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 3, curveSegments: 40 });
      [-1, 1].forEach(function (sd) {
        var arm = new T.Group();
        arm.add(mesh(bg, m, 0, 0, sd * 0.04));
        arm.add(mesh(new T.TorusGeometry(0.46, 0.085, 24, 80), m, sd * 0.42, -1.05, sd * 0.04, 0, 0, 0));
        arm.add(mesh(tube([[0.02, 0.05, 0], [sd * 0.18, -0.35, 0], [sd * 0.36, -0.6, 0]], 0.075), m, 0, 0, sd * 0.04));
        arm.rotation.z = sd * 0.16; g.add(arm);
      });
      g.add(mesh(new T.CylinderGeometry(0.11, 0.11, 0.26, 32), MAT.gold(), 0.02, 0.15, 0, Math.PI / 2));
      return g;
    },
    razor: function () {
      // Navalha meio aberta: cabo e lâmina partem do mesmo pino.
      var g = new T.Group();
      var hd = new T.Shape(); hd.moveTo(0, -0.2); hd.lineTo(3.0, -0.12); hd.quadraticCurveTo(3.35, 0, 3.0, 0.14); hd.lineTo(0, 0.22); hd.quadraticCurveTo(-0.25, 0, 0, -0.2);
      var hg = new T.ExtrudeGeometry(hd, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 5, curveSegments: 30 });
      var handle = new T.Group(); handle.add(mesh(hg, solid(P.accent2, 0.3, 0.15, { clearcoat: 1 }), 0, 0, -0.1)); handle.rotation.z = -0.32; g.add(handle);
      var bl = new T.Shape(); bl.moveTo(0, -0.12); bl.lineTo(2.3, -0.3); bl.quadraticCurveTo(2.85, -0.28, 2.9, 0.12); bl.quadraticCurveTo(2.8, 0.42, 2.4, 0.42); bl.lineTo(0.2, 0.18); bl.quadraticCurveTo(-0.05, 0.1, 0, -0.12);
      var bg = new T.ExtrudeGeometry(bl, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 30 });
      var blade = new T.Group(); blade.add(mesh(bg, main(), 0, 0, 0.12)); blade.rotation.z = 0.42; g.add(blade);
      g.add(mesh(new T.CylinderGeometry(0.1, 0.1, 0.52, 24), MAT.gold(), 0, 0, 0.04, Math.PI / 2));
      return g;
    },
    pole: function () {
      var g = new T.Group();
      var t = stripes(P.accent, "#f5f5f5", P.accent2);
      var core = mesh(new T.CylinderGeometry(0.42, 0.42, 2.6, 48), M({ map: t, roughness: 0.35, clearcoat: 1 }));
      core.userData.spin = t; g.add(core);
      g.add(mesh(new T.CylinderGeometry(0.52, 0.52, 2.7, 48, 1, true), MAT.glass()));
      [1, -1].forEach(function (sd) { g.add(mesh(new T.CylinderGeometry(0.6, 0.6, 0.22, 48), MAT.chrome(), 0, sd * 1.45)); g.add(mesh(new T.SphereGeometry(0.34, 32, 16), MAT.chrome(), 0, sd * 1.7)); });
      return g;
    },
    comb: function () {
      var pts = [[-1.7, 0.3], [1.7, 0.3], [1.75, 0.0]];
      for (var i = 0; i < 26; i++) { var x = 1.65 - i * 0.13; pts.push([x, 0], [x, -0.75 + (i % 2 ? 0.08 : 0)], [x - 0.07, -0.75], [x - 0.07, 0]); }
      pts.push([-1.75, 0]);
      return mesh(extrude(shape(pts), 0.07, 0.02), main());
    },
    hairdryer: function () {
      var g = new T.Group(), m = main(), a = ACC();
      g.add(mesh(lathe([[0, -1.1], [0.5, -1.05], [0.62, -0.7], [0.62, 0.6], [0.5, 0.9], [0.34, 1.3], [0.36, 1.5], [0, 1.5]]), m, 0, 0.6, 0, 0, 0, -Math.PI / 2));
      g.add(mesh(new T.TorusGeometry(0.5, 0.04, 16, 64), a, -0.85 + 0.6, 0.6, 0, 0, Math.PI / 2));
      g.add(mesh(new T.CylinderGeometry(0.26, 0.22, 1.6, 32), m, -0.05, -0.55, 0, 0, 0, 0.18));
      g.add(mesh(new T.CylinderGeometry(0.06, 0.06, 0.3, 16), a, 0.12, -0.35, 0.22, Math.PI / 2));
      return g;
    },
    bottle: function () {
      var g = new T.Group();
      g.add(mesh(lathe([[0, 0], [0.62, 0], [0.7, 0.1], [0.7, 1.5], [0.5, 1.85], [0.24, 1.95], [0.24, 2.2], [0, 2.2]]), MAT.glass(), 0, -1.1));
      g.add(mesh(lathe([[0, 0.05], [0.6, 0.05], [0.62, 0.15], [0.62, 1.1], [0, 1.1]]), solid(P.accent, 0.2, 0, { transparent: true, opacity: 0.85 }), 0, -1.1));
      g.add(mesh(new T.CylinderGeometry(0.3, 0.3, 0.55, 40), MAT.gold(), 0, 1.35));
      return g;
    },
    polish: function () {
      var g = new T.Group();
      g.add(mesh(new T.BoxGeometry(1.1, 1.1, 1.1), MAT.glass(), 0, -0.55));
      g.add(mesh(new T.BoxGeometry(0.95, 0.85, 0.95), solid(P.accent, 0.15, 0, { clearcoat: 1 }), 0, -0.65));
      g.add(mesh(new T.CylinderGeometry(0.3, 0.34, 1.5, 40), MAT.matte(), 0, 0.75));
      return g;
    },
    tooth: function () {
      // Molar: coroa torneada com quatro cúspides baixas e duas raízes arredondadas levemente curvas.
      var g = new T.Group(), m = main();
      var crown = mesh(lathe([[0, -0.15], [0.55, -0.12], [0.86, 0.05], [0.98, 0.45], [0.96, 0.85], [0.84, 1.08], [0.55, 1.2], [0, 1.16]], 96), m); crown.scale.set(1, 1, 0.86); g.add(crown);
      [[-0.4, 0.32], [0.4, 0.32], [-0.38, -0.3], [0.38, -0.3]].forEach(function (p) { var c = mesh(new T.SphereGeometry(0.42, 40, 24), m, p[0], 1.08, p[1]); c.scale.set(1, 0.42, 0.9); g.add(c); });
      [-1, 1].forEach(function (sd) {
        var r = mesh(lathe([[0, -1.75], [0.12, -1.7], [0.24, -1.3], [0.33, -0.6], [0.38, 0], [0, 0]], 48), m, sd * 0.36, 0, 0, 0, 0, sd * -0.1);
        r.scale.set(1, 1, 0.8); g.add(r);
      });
      return g;
    },
    implant: function () {
      var g = new T.Group(), m = MAT.chrome();
      g.add(mesh(new T.CylinderGeometry(0.3, 0.22, 2.3, 40), m, 0, -0.5));
      var pts = []; for (var i = 0; i <= 140; i++) { var a = i / 140 * Math.PI * 2 * 8; pts.push([Math.cos(a) * (0.36 - i / 140 * 0.1), -1.6 + i / 140 * 2.1, Math.sin(a) * (0.36 - i / 140 * 0.1)]); }
      g.add(mesh(tube(pts, 0.05), m));
      g.add(mesh(new T.CylinderGeometry(0.22, 0.34, 0.5, 32), MAT.gold(), 0, 0.95));
      g.add(mesh(lathe([[0, 1.95], [0.4, 1.95], [0.62, 1.7], [0.6, 1.3], [0.42, 1.15], [0, 1.15]]), MAT.ceramic()));
      return g;
    },
    cup: function () {
      var g = new T.Group(), m = main();
      g.add(mesh(lathe([[0, 0], [0.55, 0], [0.62, 0.08], [0.95, 1.2], [1.0, 1.3], [0.93, 1.3], [0.88, 1.2], [0.56, 0.12], [0, 0.12]]), m, 0, -0.7));
      g.add(mesh(new T.CircleGeometry(0.86, 64), solid("#3b2014", 0.25, 0, { clearcoat: 1 }), 0, 0.42, 0, -Math.PI / 2));
      g.add(mesh(new T.RingGeometry(0.55, 0.86, 64), solid("#b07a4c", 0.5), 0, 0.425, 0, -Math.PI / 2));
      g.add(mesh(new T.TorusGeometry(0.36, 0.08, 20, 60, Math.PI * 1.25), m, 1.02, -0.05, 0, 0, 0, -Math.PI * 0.62));
      g.add(mesh(lathe([[0, 0], [1.4, 0], [1.55, 0.12], [1.5, 0.16], [0.6, 0.06], [0, 0.06]]), m, 0, -0.82));
      return g;
    },
    bean: function () {
      var g = new T.Group(), r = rnd(cfg.seed);
      for (var i = 0; i < 3; i++) {
        var b = new T.Group();
        b.add(mesh(new T.SphereGeometry(0.6, 40, 24), solid("#5a3420", 0.38, 0, { clearcoat: 0.8 }), 0, 0, 0, 0, 0, 0)); b.children[0].scale.set(1, 0.72, 0.56);
        b.add(mesh(new T.TorusGeometry(0.5, 0.035, 10, 60, Math.PI), solid("#2a160c", 0.6), 0, 0, 0.3, 0, 0, Math.PI / 2)); b.children[1].scale.set(1, 0.8, 1);
        b.position.set((i - 1) * 1.1, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6); b.rotation.set(r() * 3, r() * 3, r() * 3); g.add(b);
      }
      return g;
    },
    loaf: function () {
      var g = new T.Group(), geo = new T.SphereGeometry(1, 96, 48), p = geo.attributes.position, r = rnd(cfg.seed), v = new T.Vector3();
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); var n = 1 + (Math.sin(v.x * 9 + v.z * 5) * 0.02) + (r() - 0.5) * 0.015; if (v.y < -0.2) v.y = -0.2 - (v.y + 0.2) * 0.25; p.setXYZ(i, v.x * n * 1.7, v.y * n * 0.85, v.z * n * 0.95); }
      geo.computeVertexNormals();
      g.add(mesh(geo, solid("#a35f26", 0.72, 0, { clearcoat: 0.2 })));
      [-0.8, 0, 0.8].forEach(function (x) { g.add(mesh(tube([[x - 0.35, 0.72, -0.5], [x, 0.86, 0], [x + 0.35, 0.72, 0.5]], 0.07), solid("#ecc993", 0.85), 0, 0, 0)); });
      return g;
    },
    croissant: function () {
      var g = new T.Group(), m = solid("#c47a2c", 0.55, 0, { clearcoat: 0.5 });
      for (var i = 0; i <= 8; i++) {
        var t = i / 8, a = Math.PI * (0.15 + t * 0.7), R = 1.6, rad = 0.25 + Math.sin(t * Math.PI) * 0.45;
        var s = mesh(new T.SphereGeometry(1, 40, 24), m, Math.cos(a) * R, Math.sin(a) * R - 1.2, 0); s.scale.set(rad * 0.9, rad, rad); s.rotation.z = a; g.add(s);
      }
      return g;
    },
    cake: function () {
      var g = new T.Group();
      g.add(mesh(new T.CylinderGeometry(1.3, 1.3, 0.9, 72), solid("#f3e6d6", 0.6), 0, -0.6));
      g.add(mesh(new T.CylinderGeometry(0.9, 0.9, 0.75, 72), solid("#f3e6d6", 0.6), 0, 0.2));
      g.add(mesh(new T.TorusGeometry(1.3, 0.09, 16, 90), solid(P.accent, 0.3, 0, { clearcoat: 1 }), 0, -0.15, 0, Math.PI / 2));
      g.add(mesh(new T.TorusGeometry(0.9, 0.08, 16, 90), solid(P.accent, 0.3, 0, { clearcoat: 1 }), 0, 0.57, 0, Math.PI / 2));
      for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; g.add(mesh(new T.SphereGeometry(0.13, 20, 12), solid("#b3122a", 0.2, 0, { clearcoat: 1 }), Math.cos(a) * 0.55, 0.68, Math.sin(a) * 0.55)); }
      g.add(mesh(lathe([[0, 0], [1.7, 0], [1.8, 0.06], [0, 0.06]]), MAT.ceramic(), 0, -1.08));
      return g;
    },
    plate: function () {
      var g = new T.Group();
      g.add(mesh(lathe([[0, 0], [1.1, 0], [1.25, 0.06], [1.9, 0.3], [1.95, 0.34], [1.85, 0.34], [1.2, 0.12], [0, 0.12]]), MAT.ceramic()));
      g.add(mesh(new T.SphereGeometry(0.75, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), solid("#6e2f17", 0.45, 0, { clearcoat: 0.8 }), 0, 0.12)); g.children[1].scale.set(1, 0.5, 1);
      return g;
    },
    cloche: function () {
      var g = new T.Group(), m = main();
      g.add(mesh(lathe([[0, 0], [1.6, 0], [1.75, 0.08], [2.1, 0.2], [0, 0.2]]), MAT.ceramic(), 0, -0.9));
      g.add(mesh(new T.SphereGeometry(1.55, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -0.7));
      g.add(mesh(new T.TorusGeometry(1.55, 0.05, 16, 100), m, 0, -0.7, 0, Math.PI / 2));
      g.add(mesh(new T.SphereGeometry(0.2, 32, 16), MAT.gold(), 0, 0.98));
      g.add(mesh(new T.CylinderGeometry(0.06, 0.1, 0.18, 24), MAT.gold(), 0, 0.84));
      return g;
    },
    cutlery: function () {
      var g = new T.Group(), m = main();
      var k = shape([[-0.12, -1.8], [0.12, -1.8], [0.12, 0], [0.16, 0.2], [0.18, 1.6], [0.05, 1.85], [-0.14, 1.6], [-0.14, 0], [-0.12, 0]]);
      g.add(mesh(extrude(k, 0.05, 0.02), m, 0.5, 0, 0, 0, 0, -0.08));
      var f = [[-0.1, -1.8], [0.1, -1.8], [0.1, 0.3], [0.32, 0.8], [0.32, 1.7], [0.24, 1.7], [0.24, 0.95], [0.12, 0.95], [0.12, 1.75], [0.04, 1.75], [0.04, 0.95], [-0.04, 0.95], [-0.04, 1.75], [-0.12, 1.75], [-0.12, 0.95], [-0.24, 0.95], [-0.24, 1.7], [-0.32, 1.7], [-0.32, 0.8], [-0.1, 0.3]];
      g.add(mesh(extrude(shape(f), 0.05, 0.015), m, -0.5, 0, 0, 0, 0, 0.08));
      return g;
    },
    pizza: function () {
      var g = new T.Group(), r = rnd(cfg.seed), base = Math.PI / 4;
      g.add(mesh(new T.CylinderGeometry(1.7, 1.75, 0.16, 80, 1, false, base, Math.PI * 2 - base), solid("#d09a55", 0.8)));
      g.add(mesh(new T.CylinderGeometry(1.52, 1.52, 0.04, 80, 1, false, base, Math.PI * 2 - base), solid("#b8321e", 0.5), 0, 0.09));
      var sl = new T.Group();
      sl.add(mesh(new T.CylinderGeometry(1.7, 1.75, 0.16, 20, 1, false, 0, base), solid("#d09a55", 0.8)));
      sl.add(mesh(new T.CylinderGeometry(1.52, 1.52, 0.04, 20, 1, false, 0, base), solid("#b8321e", 0.5), 0, 0.09));
      sl.position.set(0.55, 0.35, 0.25); sl.rotation.set(0.25, 0, -0.12); g.add(sl);
      for (var i = 0; i < 14; i++) { var a = base + r() * (Math.PI * 2 - base), rr = 0.3 + r() * 1.05; g.add(mesh(new T.CylinderGeometry(0.17, 0.17, 0.05, 24), solid("#7d1a10", 0.35, 0, { clearcoat: 0.8 }), Math.sin(a) * rr, 0.13, Math.cos(a) * rr)); }
      for (var j = 0; j < 22; j++) { var b = base + r() * (Math.PI * 2 - base), q = r() * 1.35; var c = mesh(new T.SphereGeometry(0.16, 16, 8), solid("#f2d27a", 0.45), Math.sin(b) * q, 0.11, Math.cos(b) * q); c.scale.set(1, 0.25, 1); g.add(c); }
      return g;
    },
    burger: function () {
      var g = new T.Group(), r = rnd(cfg.seed);
      g.add(mesh(lathe([[0, 0], [1.25, 0], [1.35, 0.15], [1.3, 0.35], [0, 0.35]]), solid("#c98a3d", 0.6), 0, -1));
      g.add(mesh(new T.CylinderGeometry(1.35, 1.35, 0.35, 64), solid("#4a2516", 0.75), 0, -0.45));
      var ch = mesh(new T.BoxGeometry(2.3, 0.06, 2.3), solid("#f2b632", 0.4), 0, -0.25, 0, 0, Math.PI / 4); g.add(ch);
      g.add(mesh(new T.CylinderGeometry(1.25, 1.25, 0.12, 64), solid("#d23b2a", 0.35, 0, { clearcoat: 1 }), 0, -0.13));
      g.add(mesh(new T.TorusGeometry(1.25, 0.12, 12, 60), solid("#5fa83b", 0.5), 0, -0.05, 0, Math.PI / 2));
      g.add(mesh(lathe([[0, 0], [1.35, 0], [1.4, 0.2], [1.25, 0.6], [0.8, 0.95], [0, 1.05]]), solid("#c98a3d", 0.55, 0, { clearcoat: 0.4 }), 0, 0.02));
      for (var i = 0; i < 26; i++) { var a = r() * Math.PI * 2, rr = 0.2 + r() * 0.9, yy = 0.02 + 1.03 * Math.cos(Math.min(1, rr / 1.3) * 1.2) ; var s = mesh(new T.SphereGeometry(0.05, 10, 6), solid("#f6ecd2", 0.5), Math.cos(a) * rr, yy, Math.sin(a) * rr); s.scale.set(1.6, 0.6, 1); s.rotation.y = r() * 3; g.add(s); }
      return g;
    },
    dumbbell: function () {
      var g = new T.Group(), m = main(), c = MAT.chrome();
      g.add(mesh(new T.CylinderGeometry(0.13, 0.13, 3.4, 32), c, 0, 0, 0, 0, 0, Math.PI / 2));
      [-1, 1].forEach(function (sd) {
        g.add(mesh(new T.CylinderGeometry(0.95, 0.95, 0.32, 8), m, sd * 1.05, 0, 0, 0, 0, Math.PI / 2));
        g.add(mesh(new T.CylinderGeometry(0.8, 0.8, 0.28, 8), m, sd * 1.38, 0, 0, 0, 0, Math.PI / 2));
        g.add(mesh(new T.TorusGeometry(0.95, 0.03, 8, 8), glow(accent, 0.9), sd * 0.88, 0, 0, 0, Math.PI / 2, Math.PI / 8));
        g.add(mesh(new T.CylinderGeometry(0.22, 0.22, 0.2, 32), c, sd * 0.8, 0, 0, 0, 0, Math.PI / 2));
      });
      return g;
    },
    kettlebell: function () {
      var g = new T.Group(), m = main();
      var s = mesh(new T.SphereGeometry(1.1, 64, 32), m, 0, -0.35); s.scale.set(1, 0.92, 1); g.add(s);
      g.add(mesh(new T.TorusGeometry(0.62, 0.16, 24, 64, Math.PI), m, 0, 0.55, 0));
      [-0.62, 0.62].forEach(function (x) { g.add(mesh(new T.CylinderGeometry(0.16, 0.2, 0.5, 24), m, x, 0.4)); });
      g.add(mesh(new T.TorusGeometry(1.1, 0.03, 10, 90), glow(accent, 0.95), 0, -0.3, 0, Math.PI / 2));
      return g;
    },
    wheel: function () {
      var g = new T.Group(), m = main(), rub = solid("#08080a", 0.96, 0, { envMapIntensity: 0.35 });
      g.add(mesh(new T.TorusGeometry(1.35, 0.5, 40, 120), rub)); g.children[0].scale.set(1, 1, 0.82);
      for (var i = 0; i < 40; i++) { var a = i / 40 * Math.PI * 2; g.add(mesh(new T.BoxGeometry(0.09, 0.1, 0.66), rub, Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0, 0, 0, a)); }
      g.add(mesh(new T.CylinderGeometry(1.0, 1.0, 0.18, 72), m, 0, 0, 0, Math.PI / 2));
      for (var j = 0; j < 5; j++) { var b = j / 5 * Math.PI * 2; g.add(mesh(new T.BoxGeometry(0.2, 0.95, 0.12), m, Math.cos(b) * 0.5, Math.sin(b) * 0.5, 0.14, 0, 0, b - Math.PI / 2)); }
      g.add(mesh(new T.CylinderGeometry(0.26, 0.3, 0.3, 32), MAT.matte(), 0, 0, 0.18, Math.PI / 2));
      g.add(mesh(new T.CylinderGeometry(0.85, 0.85, 0.06, 64), solid("#6b6b70", 0.35, 0.9), 0, 0, -0.18, Math.PI / 2));
      g.add(mesh(new T.BoxGeometry(0.5, 0.75, 0.3), ACC(), 0.55, 0.45, -0.12, 0, 0, -0.6));
      return g;
    },
    wrench: function () {
      var s = new T.Shape(); s.absarc(0, 1.6, 0.62, Math.PI * 0.72, Math.PI * 2.28, false); s.lineTo(0.2, 1.25); s.lineTo(0.22, -1.6); s.absarc(0, -1.75, 0.36, 0, Math.PI, true); s.lineTo(-0.22, 1.25); s.closePath();
      var h = new T.Path(); h.moveTo(-0.2, 1.9); h.lineTo(0.2, 1.9); h.lineTo(0.2, 2.4); h.lineTo(-0.2, 2.4); s.holes.push(h);
      return mesh(extrude(s, 0.14, 0.04), main());
    },
    gear: function () {
      var s = new T.Shape(), n = 14;
      for (var i = 0; i < n * 4; i++) { var a = i / (n * 4) * Math.PI * 2, r = i % 4 < 2 ? 1.6 : 1.3; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      var h = new T.Path(); h.absarc(0, 0, 0.5, 0, Math.PI * 2, true); s.holes.push(h);
      var g = new T.Group(); g.add(mesh(extrude(s, 0.36, 0.05), main()));
      g.add(mesh(new T.TorusGeometry(0.95, 0.04, 10, 90), glow(accent, 0.9), 0, 0, 0.24));
      return g;
    },
    hanger: function () {
      var g = new T.Group(), m = main();
      g.add(mesh(tube([[0, 0.8, 0], [0, 1.3, 0], [0.12, 1.75, 0], [0.42, 1.8, 0], [0.5, 1.5, 0]], 0.055), m));
      g.add(mesh(tube([[0, 0.8, 0], [-1.9, -0.45, 0], [-1.95, -0.62, 0], [1.95, -0.62, 0], [1.9, -0.45, 0], [0, 0.8, 0]], 0.07, true), m));
      return g;
    },
    tshirt: function () {
      var s = shape([[-0.55, 1.5], [-1.65, 1.05], [-2.05, 0.15], [-1.4, -0.12], [-1.15, 0.45], [-1.15, -1.7], [1.15, -1.7], [1.15, 0.45], [1.4, -0.12], [2.05, 0.15], [1.65, 1.05], [0.55, 1.5], [0.3, 1.2], [0, 1.1], [-0.3, 1.2]]);
      var g = new T.Group(); g.add(mesh(extrude(s, 0.28, 0.12), solid(P.accent, 0.92, 0)));
      g.add(mesh(new T.TorusGeometry(0.42, 0.05, 12, 40, Math.PI), solid(P.accent2, 0.8), 0, 1.35, 0.2, 0, 0, Math.PI));
      return g;
    },
    bone: function () {
      var g = new T.Group(), m = solid("#efe6d2", 0.45, 0, { clearcoat: 0.6 });
      g.add(mesh(new T.CylinderGeometry(0.34, 0.34, 2.6, 40), m, 0, 0, 0, 0, 0, Math.PI / 2));
      [[-1.35, 0.32], [-1.35, -0.32], [1.35, 0.32], [1.35, -0.32]].forEach(function (p) { g.add(mesh(new T.SphereGeometry(0.52, 40, 24), m, p[0], p[1], 0)); });
      return g;
    },
    paw: function () {
      var g = new T.Group(), m = solid(P.accent, 0.4, 0, { clearcoat: 1 });
      var pad = mesh(new T.SphereGeometry(1, 48, 32), m, 0, -0.5); pad.scale.set(1.15, 0.9, 0.5); g.add(pad);
      [[-1.05, 0.55], [-0.38, 1.05], [0.38, 1.05], [1.05, 0.55]].forEach(function (p) { var t = mesh(new T.SphereGeometry(0.42, 32, 20), m, p[0], p[1]); t.scale.set(0.9, 1.1, 0.55); g.add(t); });
      return g;
    },
    key: function () {
      var g = new T.Group(), m = main();
      g.add(mesh(new T.TorusGeometry(0.62, 0.17, 24, 72), m, -1.6, 0));
      g.add(mesh(new T.CylinderGeometry(0.13, 0.13, 2.6, 24), m, 0.1, 0, 0, 0, 0, Math.PI / 2));
      [[0.9, 0.3], [1.25, 0.22], [1.55, 0.36]].forEach(function (p) { g.add(mesh(new T.BoxGeometry(0.16, p[1] * 2, 0.16), m, p[0], -p[1])); });
      return g;
    },
    house: function () {
      var g = new T.Group();
      var body = mesh(extrude(shape([[-1.2, -1], [1.2, -1], [1.2, 0.4], [-1.2, 0.4]]), 1.8, 0.04), MAT.ceramic(), 0, -0.3); g.add(body);
      var roof = mesh(extrude(shape([[-1.5, 0], [1.5, 0], [0, 1.25]]), 2.1, 0.04), solid(P.accent2, 0.5, 0.2), 0, 0.98); g.add(roof);
      [[-0.6, -0.05], [0.6, -0.05]].forEach(function (p) { g.add(mesh(new T.PlaneGeometry(0.5, 0.5), glow(C(P.accent).lerp(C("#fff3c4"), 0.6)), p[0], p[1], 0.95)); });
      g.add(mesh(new T.PlaneGeometry(0.5, 0.85), glow(C("#ffd27a"), 0.95), 0, -0.88, 0.95));
      return g;
    },
    pill: function () {
      var g = new T.Group();
      var a = solid(P.accent, 0.25, 0, { clearcoat: 1 }), b = MAT.pearl();
      g.add(mesh(new T.CylinderGeometry(0.5, 0.5, 1.1, 48, 1, true), a, 0, 0.55)); g.add(mesh(new T.SphereGeometry(0.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), a, 0, 1.1));
      g.add(mesh(new T.CylinderGeometry(0.5, 0.5, 1.1, 48, 1, true), b, 0, -0.55)); g.add(mesh(new T.SphereGeometry(0.5, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), b, 0, -1.1));
      g.rotation.z = -0.7;
      return g;
    },
    glasses: function () {
      var g = new T.Group(), m = main();
      [-0.95, 0.95].forEach(function (x) {
        var r = mesh(new T.TorusGeometry(0.7, 0.08, 20, 80), m, x, 0); r.scale.set(1.15, 0.9, 1); g.add(r);
        var l = mesh(new T.CircleGeometry(0.7, 60), MAT.glass(), x, 0, 0); l.scale.set(1.15, 0.9, 1); g.add(l);
        g.add(mesh(new T.CylinderGeometry(0.05, 0.05, 2.2, 16), m, x * 1.85, 0.2, -1.1, Math.PI / 2));
      });
      g.add(mesh(tube([[-0.25, 0.25, 0], [0, 0.4, 0], [0.25, 0.25, 0]], 0.05), m));
      return g;
    },
  };

  // Objetos achatados ganham inclinação para mostrar o topo.
  var BASE = { pizza: [0.95, 0, 0], plate: [0.75, 0, 0], cake: [0.18, 0, 0], cloche: [0.12, 0, 0], burger: [0.15, 0, 0], cup: [0.3, 0, 0], tshirt: [0, 0, 0.06] };
  function build(kind, size) {
    var g = (B[kind] || B.gear)();
    if (BASE[kind]) g.rotation.set(BASE[kind][0], BASE[kind][1], BASE[kind][2]);
    var box = new T.Box3().setFromObject(g), c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3());
    g.position.sub(c);
    var wrap = new T.Group(); wrap.add(g);
    var holder = new T.Group(); holder.add(wrap);
    wrap.scale.setScalar(size / Math.max(s.x, s.y, s.z));
    return holder;
  }

  // ---------- cena ----------
  var hero = build(cfg.model, mobile ? 3.0 : 3.1);
  scene.add(hero);
  var floor = (function () {
    var cv = d.createElement("canvas"); cv.width = cv.height = 256; var x = cv.getContext("2d");
    var gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, P.accent); gr.addColorStop(0.35, P.accent2); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.globalAlpha = 0.85; x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    var t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding;
    var m = new T.Mesh(new T.PlaneGeometry(7, 7), new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = -2.3; scene.add(m); return m;
  })();

  var secs = (cfg.secondary || []).map(function (k, j) {
    var o = build(k, mobile ? 1.4 : 1.7);
    o.userData = { k: 1 + j * Math.max(1, Math.floor((chapters.length - 2) / Math.max(1, cfg.secondary.length))), j: j };
    o.visible = false; scene.add(o); return o;
  });

  var motif = new T.Group(); scene.add(motif);
  var rr = rnd(cfg.seed + 7);
  if (cfg.motif === "particles") {
    var n = mobile ? 260 : 700, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { pos[i * 3] = (rr() - 0.5) * 18; pos[i * 3 + 1] = (rr() - 0.5) * 14; pos[i * 3 + 2] = (rr() - 0.5) * 12 - 3; }
    var pg = new T.BufferGeometry(); pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    motif.add(new T.Points(pg, new T.PointsMaterial({ color: accent, size: mobile ? 0.05 : 0.04, transparent: true, opacity: 0.75, depthWrite: false, blending: T.AdditiveBlending })));
  } else if (cfg.motif === "rings") {
    [2.6, 3.1].forEach(function (r, i) { var t = mesh(new T.TorusGeometry(r, 0.006, 6, 200), glow(i === 1 ? accent2 : accent, 0.28), 0, 0, 0, Math.PI / 2 + i * 0.3, i * 0.6); motif.add(t); });
  } else if (cfg.motif === "grid") {
    var gh = new T.GridHelper(60, 60, accent, accent2); gh.material.transparent = true; gh.material.opacity = 0.22; gh.position.y = -2.35; motif.add(gh);
  } else {
    for (var q = 0; q < 3; q++) { var pts = []; for (var k = 0; k < 6; k++) pts.push([(k - 2.5) * 3.2, (rr() - 0.5) * 6, (rr() - 0.5) * 6 - 2]); motif.add(mesh(tube(pts, 0.018), glow(q ? accent : accent2, 0.6))); }
  }

  // ---------- poses por capítulo ----------
  var N = chapters.length;
  function side(i) { var s = chapters[i] && chapters[i].dataset.side; return s === "left" ? 1 : s === "right" ? -1 : 0; } // objeto do lado oposto ao texto
  var poses = chapters.map(function (_, i) {
    var sd = side(i), last = i === N - 1, t = i / Math.max(1, N - 1);
    var p = { x: sd * 2.35, y: Math.sin(i * 1.7) * 0.22, z: 0, rx: 0.2, ry: -0.5 + i * 1.15, rz: 0.12, s: 1 };
    if (cfg.choreo === "drift") { p.rz = -0.5 + i * 0.55; p.rx = 0.45 - t * 0.6; p.y += 0.25 - t * 0.4; p.s = 1.12 - t * 0.2; }
    if (cfg.choreo === "dive") { p.s = i % 3 === 1 ? 1.22 : i % 3 === 2 ? 0.85 : 1.02; p.z = i % 3 === 1 ? 0.6 : 0; p.rx = i % 2 ? 0.85 : 0.15; }
    if (i === 0) { p.s *= cfg.choreo === "drift" ? 1.2 : 1.1; p.ry = -0.55; p.rz = 0.18; }
    if (sd === 0) { p.x = 0; p.y = -2.0; p.s *= 0.66; p.z = 0; } // texto centralizado no alto, objeto abaixo dele
    if (last) { p.ry = Math.PI * 2 + 0.4 + i * 0.2; p.rx = 0.25; p.s *= 0.95; }
    // Capítulos de foto ampla: o objeto sai de cena (e volta no capítulo seguinte, entrando de baixo).
    if (chapters[i] && chapters[i].dataset.hide) { p.s = 0.001; p.y = -4.5; p.z = -2; }
    if (mobile) { p.x *= 0.1; p.y = (sd === 0 ? 0 : p.y * 0.4) + 1.15; p.s *= 0.74; p.z = Math.min(p.z, 0.4); }
    return p;
  });
  var cur = Object.assign({}, poses[0]), keys = ["x", "y", "z", "rx", "ry", "rz", "s"];
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  var f = 0;
  function measure() {
    var mid = w.innerHeight * 0.55; f = 0;
    for (var i = 0; i < N; i++) { var r = chapters[i].getBoundingClientRect(); if (r.top <= mid) f = i + Math.min(0.999, Math.max(0, (mid - r.top) / Math.max(1, r.height))); }
    cards.forEach(function (c) { var r = c.getBoundingClientRect(), k = 1 - (r.top + r.height / 2) / w.innerHeight; c.style.setProperty("--p", (Math.max(-0.5, Math.min(1.5, k))).toFixed(3)); });
  }
  function target() {
    var i = Math.floor(f), t = reduce ? 0 : smooth(0.45, 1, f - i), a = poses[Math.min(i, N - 1)], b = poses[Math.min(i + 1, N - 1)], o = {};
    keys.forEach(function (k) { o[k] = a[k] + (b[k] - a[k]) * t; });
    return o;
  }

  function resize() {
    mobile = w.innerWidth < 760;
    var W = w.innerWidth, H = w.innerHeight;
    renderer.setSize(W, H, false); camera.aspect = W / H;
    camera.fov = W / H < 0.8 ? 44 : 32; camera.updateProjectionMatrix();
  }
  w.addEventListener("resize", resize); resize();
  var mx = 0, my = 0;
  if (!reduce && !mobile) w.addEventListener("pointermove", function (e) { mx = e.clientX / w.innerWidth - 0.5; my = e.clientY / w.innerHeight - 0.5; }, { passive: true });

  var last = performance.now(), clock = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (d.hidden) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    measure();
    var tg = target(), k = reduce ? 1 : 1 - Math.pow(0.002, dt);
    keys.forEach(function (q) { cur[q] += (tg[q] - cur[q]) * k; });
    var idle = reduce ? 0 : clock * 0.18;
    hero.position.set(cur.x, cur.y + (reduce ? 0 : Math.sin(clock * 0.9) * 0.06), cur.z);
    hero.rotation.set(cur.rx + my * 0.18, cur.ry + idle + mx * 0.35, cur.rz);
    hero.scale.setScalar(cur.s);
    floor.position.x = cur.x; floor.position.z = cur.z; floor.scale.setScalar(Math.max(0.001, cur.s));
    hero.visible = cur.s > 0.02;
    floor.material.opacity = (0.35 + 0.2 * Math.sin(clock * 1.3) * (reduce ? 0 : 1) + 0.15) * Math.min(1, cur.s);

    secs.forEach(function (o) {
      var ud = o.userData, a = reduce ? (f >= ud.k ? 1 : 0) : smooth(ud.k - 0.7, ud.k, f);
      o.visible = a > 0.01; if (!o.visible) return;
      // Secundários ficam bem ao fundo, nos cantos do lado do objeto (nunca em cima do texto nem do objeto principal).
      var sdNow = side(Math.min(N - 1, Math.round(f))) || (ud.j % 2 ? -1 : 1);
      var sx = mobile ? (ud.j % 2 ? -1.4 : 1.4) : sdNow * (6.9 + ud.j * 0.5);
      var sy = mobile ? 3.4 : (ud.j % 2 ? -2.9 : 2.7), sz = mobile ? -4.5 : -6.5;
      o.position.set(sx, sy - (f - ud.k) * 0.4, sz - (1 - a) * 16);
      o.scale.setScalar(Math.max(0.001, a));
      o.rotation.set(0.4 + clock * 0.2 * (reduce ? 0 : 1), f * 0.9 + ud.j + clock * 0.25 * (reduce ? 0 : 1), 0.2);
    });
    motif.rotation.y = f * 0.35 + (reduce ? 0 : clock * 0.02);
    motif.position.y = -f * 0.25;
    if (cfg.motif === "rings") { motif.position.set(cur.x, cur.y, cur.z); motif.children.forEach(function (r, i) { r.rotation.x = Math.PI / 2 + i * 0.3 + f * 0.4; r.rotation.y = i * 0.6 + f * 0.25 + (reduce ? 0 : clock * 0.08 * (i + 1)); }); }
    if (cfg.motif === "grid") motif.children[0].position.z = (f * 2.5) % 1;
    hero.traverse(function (o) { if (o.userData && o.userData.spin && !reduce) o.userData.spin.offset.y -= dt * 0.25; });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
