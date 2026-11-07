/* eslint-disable */
// @ts-nocheck
// Palco 3D realista: roda no navegador do site gerado (serializado com toString, sem dependências do app).
// Só carrega modelos escaneados de objetos reais (glTF do Poly Haven, CC0). Realismo vem de:
//  - iluminação por mapa de ambiente HDR de estúdio (reflexos e luz difusa físicos, PMREM);
//  - luz principal com sombra suave projetada num chão invisível (sombra de contato);
//  - materiais PBR do próprio escaneamento (cor, rugosidade, metal, oclusão, normal);
//  - câmera com lente longa (pouca distorção), objeto apoiado no chão e escala ajustada ao quadro.
// Se o WebGL ou o modelo falharem, a foto de reserva continua no lugar (nada quebra).
export function realRuntime(cfg) {
  var stage = document.querySelector("[data-stage3d]");
  var T = window.THREE;
  if (!stage || !T || !T.GLTFLoader) return;
  var canvas = stage.querySelector("canvas");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  var renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.exposure || 1.0;
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(24, 1, 0.05, 100);
  var pivot = new T.Group();
  scene.add(pivot);

  // Luz principal (janela de estúdio) + preenchimento suave; o HDR faz o resto.
  var key = new T.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.5, 4.5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  var rim = new T.DirectionalLight(0xffffff, 0.8);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  // Chão invisível que só recebe sombra (o objeto parece apoiado sobre a superfície da página).
  var floor = new T.Mesh(new T.PlaneGeometry(20, 20), new T.ShadowMaterial({ opacity: cfg.dark ? 0.6 : 0.38 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  var pmrem = new T.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  var envReady = new Promise(function (res) {
    if (!cfg.hdrUrl || !T.RGBELoader) return res();
    new T.RGBELoader().setDataType(T.UnsignedByteType).load(cfg.hdrUrl, function (tex) {
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      res();
    }, undefined, function () { res(); });
  });

  var model = null, size = 1;
  new T.GLTFLoader().load(cfg.gltfUrl, function (g) {
    model = g.scene;
    model.traverse(function (o) {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) { o.material.envMapIntensity = 1.0; o.material.needsUpdate = true; }
      }
    });
    // Centraliza, apoia no chão (y = 0) e normaliza o tamanho para o enquadramento.
    var box = new T.Box3().setFromObject(model);
    var s = box.getSize(new T.Vector3());
    var c = box.getCenter(new T.Vector3());
    var maxDim = Math.max(s.x, s.y, s.z) || 1;
    var k = 1 / maxDim;
    model.scale.setScalar(k);
    model.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    size = 1;
    pivot.add(model);
    // Sombra de contato: mancha suave exatamente sob o objeto (aterra o modelo na superfície).
    var cv = document.createElement("canvas"); cv.width = cv.height = 256;
    var cx = cv.getContext("2d"), gr = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(0,0,0,0.62)"); gr.addColorStop(0.45, "rgba(0,0,0,0.32)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256);
    var blob = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: cfg.dark ? 0.95 : 0.7 }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.002;
    blob.scale.set(s.x * k * 1.5, s.z * k * 1.5, 1);
    pivot.add(blob);
    var h = s.y * k;
    // Câmera um pouco acima, olhando o centro do objeto; distância garante margem no quadro.
    camera.userData.target = new T.Vector3(0, h * 0.42, 0);
    camera.userData.dist = 2.8 + (h > 0.7 ? 0.35 : 0);
    camera.userData.elev = cfg.elevation || (h > 0.6 ? 0.2 : 0.34);
    key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2; key.shadow.camera.top = 1.2; key.shadow.camera.bottom = -1.2;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 12;
    envReady.then(function () {
      resize();
      stage.classList.add("is-ready");
      frame();
    });
  }, undefined, function () { stage.classList.add("is-failed"); });

  function resize() {
    var r = stage.getBoundingClientRect();
    var w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Em quadros estreitos (celular) o objeto recua um pouco para não encostar nas bordas.
    camera.userData.fit = camera.aspect < 1 ? 1 / camera.aspect : 1;
    camera.updateProjectionMatrix();
    if (model) frame();
  }
  window.addEventListener("resize", resize, { passive: true });

  var visible = true, px = 0, py = 0, tx = 0, ty = 0, t0 = performance.now();
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) frame(); }).observe(stage);
  if (!reduce) stage.addEventListener("pointermove", function (e) {
    var r = stage.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }, { passive: true });

  var raf = 0;
  function frame() {
    if (raf || !model) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var t = (performance.now() - t0) / 1000;
      var r = stage.getBoundingClientRect();
      var scroll = Math.max(-1, Math.min(1, -r.top / Math.max(1, r.height)));
      px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      // Giro lento de vitrine + rolagem da página + leve inclinação pelo mouse.
      pivot.rotation.y = (reduce ? 0.6 : t * 0.18 + 0.6) + scroll * 1.1 + px * 0.25;
      var d = camera.userData.dist * camera.userData.fit, el = camera.userData.elev + py * 0.05;
      var tg = camera.userData.target;
      camera.position.set(Math.sin(0.35) * d * Math.cos(el), tg.y + d * Math.sin(el), Math.cos(0.35) * d * Math.cos(el));
      camera.lookAt(tg);
      renderer.render(scene, camera);
      if (visible && !reduce) frame();
    });
  }
}
