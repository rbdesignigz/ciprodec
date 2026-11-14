/* CIPRODEC – portada: modelo estructural 3D de la Casa Hernandarias girando.
   Usa three.js r128 (cdnjs) y los datos de src/hernandarias-modelo.js.
   Se arma por capas al cargar, gira solo, se puede arrastrar para girar,
   prender/apagar capas, separar por niveles y muestra fichas técnicas reales. */
(function () {
  var host = document.getElementById('modelo3d');
  if (!host) return;
  var D = window.HERNANDARIAS3D, T = window.THREE;
  function sinWebGL() { host.classList.add('sin3d'); }
  if (!D || !T) { sinWebGL(); return; }
  try { var tc = document.createElement('canvas'); if (!(tc.getContext('webgl') || tc.getContext('experimental-webgl'))) { sinWebGL(); return; } } catch (e) { sinWebGL(); return; }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = host.querySelector('canvas');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new T.Scene();
  var cam = new T.PerspectiveCamera(32, 1, 0.5, 400);
  scene.add(new T.HemisphereLight(0xffffff, 0xb9b4ad, 0.95));
  var sun = new T.DirectionalLight(0xffffff, 0.55); sun.position.set(-30, 50, 25); scene.add(sun);

  /* centro del modelo (coordenadas de plano x,y; z = altura) */
  var CX = 9.8, CY = 19.3, CZ = 2.2;
  function V(x, y, z) { return [x - CX, z - CZ, -(y - CY)]; }

  /* colores de capa: identidad CIPRODEC (tinta, rojo, grises de plano) */
  var CAPAS = [
    { k: 'bases', col: 0x9c8f80, op: 1, dz: 0 },
    { k: 'fund', col: 0xb3a797, op: 1, dz: 1.6 },
    { k: 'muros', col: 0xc9c6c0, op: 0.75, dz: 1.6 },
    { k: 'cols', col: 0xE8262B, op: 1, dz: 3.4 },
    { k: 'vigas', col: 0x3a3a3a, op: 1, dz: 5.4 },
    { k: 'losas', col: 0xd9d6d0, op: 0.42, dz: 7.2 },
    { k: 'techo', col: 0x1a1a1a, op: 1, dz: 9.4, lineas: true }
  ];

  var modelo = new T.Group(); scene.add(modelo);
  var grupos = {};

  function cajaVerts(b, pos, nor, edg) {
    var cx = b[0], cy = b[1], cz = b[2], hx = b[3] / 2, hy = b[4] / 2, hz = b[5] / 2, a = b[6] || 0;
    var c = Math.cos(a), s = Math.sin(a);
    function P(ix, iy, iz) { var lx = ix * hx, ly = iy * hy; return V(cx + lx * c - ly * s, cy + lx * s + ly * c, cz + iz * hz); }
    var k = [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)];
    var caras = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
    caras.forEach(function (f) {
      var A = k[f[0]], B = k[f[1]], C = k[f[2]];
      var ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      [f[0], f[1], f[2], f[0], f[2], f[3]].forEach(function (i) { pos.push(k[i][0], k[i][1], k[i][2]); nor.push(nx / l, ny / l, nz / l); });
    });
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) {
      edg.push(k[e[0]][0], k[e[0]][1], k[e[0]][2], k[e[1]][0], k[e[1]][1], k[e[1]][2]);
    });
  }

  CAPAS.forEach(function (cp) {
    var g = new T.Group(); g.userData = cp; grupos[cp.k] = g; modelo.add(g);
    var datos = D.capas[cp.k] || [];
    cp.mats = [];
    if (cp.lineas) {
      var lp = [];
      datos.forEach(function (s) { var a = V(s[0], s[1], s[2]), b = V(s[3], s[4], s[5]); lp.push(a[0], a[1], a[2], b[0], b[1], b[2]); });
      var lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3));
      var lm = new T.LineBasicMaterial({ color: cp.col, transparent: true, opacity: 0 });
      g.add(new T.LineSegments(lg, lm)); cp.mats.push([lm, 0.85]);
      return;
    }
    var pos = [], nor = [], edg = [];
    datos.forEach(function (b) { cajaVerts(b, pos, nor, edg); });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    var m = new T.MeshLambertMaterial({ color: cp.col, transparent: true, opacity: 0, depthWrite: cp.op === 1, side: cp.op < 1 ? T.DoubleSide : T.FrontSide });
    var mesh = new T.Mesh(geo, m); g.add(mesh); cp.mats.push([m, cp.op]);
    var eg = new T.BufferGeometry(); eg.setAttribute('position', new T.Float32BufferAttribute(edg, 3));
    var em = new T.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0 });
    g.add(new T.LineSegments(eg, em)); cp.mats.push([em, cp.op < 1 ? 0.18 : 0.32]);
  });

  /* encuadre */
  var R = 28, ALTO = 18.5;
  function encuadrar() {
    var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    var tv = Math.tan(T.MathUtils.degToRad(cam.fov / 2)), th = tv * cam.aspect;
    var fit = Math.max(R / th, (ALTO + (sep ? 6 : 0)) / tv) * 1.06;
    var d = fit, elev = T.MathUtils.degToRad(24);
    cam.position.set(0, Math.sin(elev) * d + (sep ? 3 : 0), Math.cos(elev) * d);
    cam.lookAt(0, sep ? 2.5 : 0, 0); cam.updateProjectionMatrix();
  }

  /* estado */
  var t0 = performance.now(), ultimo = t0, giro = 0.6, vel = reduce ? 0 : 0.16, arrastre = null, inercia = 0;
  var sep = false, sepK = 0;
  var ARMADO = reduce ? 0 : 0.42, DUR = reduce ? 0.001 : 0.95;

  /* arrastrar para girar (horizontal); el scroll vertical del celular sigue funcionando */
  canvas.addEventListener('pointerdown', function (e) { arrastre = { x: e.clientX, g: giro, t: performance.now() }; host.classList.add('agarrado'); });
  window.addEventListener('pointermove', function (e) { if (!arrastre) return; var nx = giro; giro = arrastre.g + (e.clientX - arrastre.x) * 0.008; inercia = (giro - nx) * 60; });
  window.addEventListener('pointerup', function () { if (arrastre) { arrastre = null; host.classList.remove('agarrado'); } });
  window.addEventListener('pointercancel', function () { arrastre = null; host.classList.remove('agarrado'); });

  /* botones de capas */
  host.querySelectorAll('[data-capa]').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      var ks = b.dataset.capa.split(' ');
      ks.forEach(function (k) { if (grupos[k]) grupos[k].visible = on; });
      pedir();
    });
  });
  var bs = host.querySelector('[data-separar]');
  if (bs) bs.addEventListener('click', function () { sep = !sep; bs.setAttribute('aria-pressed', String(sep)); encuadrar(); pedir(); });

  /* fichas técnicas reales que van rotando */
  var ficha = host.querySelector('.ficha'), punto = host.querySelector('.punto'), fi = 0, fT = 0;
  var lang = function () { return document.documentElement.getAttribute('data-lang') === 'pt' ? 'pt' : 'es'; };
  var capaDeFicha = ['cols', 'vigas', 'bases', 'losas'];
  function pintarFicha() {
    var f = D.fichas[fi], L = f[lang()];
    ficha.innerHTML = '<b>' + L[0] + '</b>' + L.slice(1).map(function (x) { return '<span>' + x + '</span>'; }).join('');
  }
  if (ficha && D.fichas.length) { pintarFicha(); new MutationObserver(pintarFicha).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] }); }
  var vtmp = new T.Vector3();

  /* números del modelo */
  host.querySelectorAll('[data-n]').forEach(function (el) {
    var v = D.n[el.dataset.n]; if (v != null) el.textContent = Number(v).toLocaleString('es');
  });

  var visible = true, pedido = false;
  function pedir() { if (!pedido) { pedido = true; requestAnimationFrame(cuadro); } }
  function ease(x) { x = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - x, 3); }

  function cuadro(now) {
    pedido = false;
    var dt = Math.min(0.05, (now - ultimo) / 1000); ultimo = now;
    var t = (now - t0) / 1000, animando = false;

    if (!arrastre) { if (Math.abs(inercia) > 0.01) { giro += inercia * dt; inercia *= Math.pow(0.04, dt); animando = true; } giro += vel * dt; }
    modelo.rotation.y = giro;

    var objetivo = sep ? 1 : 0;
    if (Math.abs(sepK - objetivo) > 0.001) { sepK += (objetivo - sepK) * Math.min(1, dt * (reduce ? 60 : 5)); animando = true; } else sepK = objetivo;

    CAPAS.forEach(function (cp, i) {
      var k = ease((t - i * ARMADO) / DUR);
      if (k < 1) animando = true;
      grupos[cp.k].position.y = (1 - k) * 9 + sepK * cp.dz;
      cp.mats.forEach(function (mm) { mm[0].opacity = mm[1] * k; });
    });

    /* ficha: cambia cada 4,5 s cuando terminó de armarse */
    if (ficha && D.fichas.length) {
      var listo = t > CAPAS.length * ARMADO + DUR;
      if (listo && (t - fT > 4.5)) { fT = t; fi = (fi + 1) % D.fichas.length; while (!grupos[capaDeFicha[fi]].visible && fi !== 0) fi = (fi + 1) % D.fichas.length; pintarFicha(); }
      var f = D.fichas[fi], p = V(f.p[0], f.p[1], f.p[2]);
      var g = grupos[capaDeFicha[fi]];
      vtmp.set(p[0], p[1] + g.position.y, p[2]).applyAxisAngle(new T.Vector3(0, 1, 0), modelo.rotation.y).project(cam);
      var w = host.clientWidth, h = host.clientHeight, x = (vtmp.x + 1) / 2 * w, y = (1 - vtmp.y) / 2 * h;
      var mostrar = listo && g.visible;
      host.classList.toggle('con-ficha', mostrar);
      punto.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      var fw = ficha.offsetWidth, fh = ficha.offsetHeight, izq = x > w * 0.55;
      var fx = izq ? x - fw - 26 : x + 26, fy = y - fh - 18;
      fx = Math.max(10, Math.min(w - fw - 10, fx)); fy = Math.max(10, Math.min(h - fh - 10, fy));
      ficha.style.transform = 'translate(' + fx + 'px,' + fy + 'px)';
    }

    renderer.render(scene, cam);
    if (visible && (vel || animando || arrastre || !reduce)) pedir();
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { ultimo = performance.now(); pedir(); } }).observe(host);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { ultimo = performance.now(); pedir(); } });
  window.addEventListener('resize', function () { encuadrar(); pedir(); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { encuadrar(); pedir(); }).observe(host);
  encuadrar(); host.classList.add('listo'); pedir();
})();
