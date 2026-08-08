'use strict';

/* ============================================================
   THREE.JS: интерактивная 3D-сцена в hero
   — «созвездие-тор»: wireframe-тор + ядро + кольца + орбиты
   — «комета»: яркие точки, летящие по кольцу — вращение видно сразу
   — частицы по фону мерцают
   — реакция на мышь: доворот объекта + параллакс камеры
   — reduced-motion → медленный «фоновый» режим (движение остаётся)
============================================================ */
(function () {
  if (typeof THREE === 'undefined') {
    console.warn('[3D] three.js не загрузился с CDN — анимация hero отключена');
    return;
  }

  const container = document.querySelector('.hero__3d');
  if (!container) return;

  const isMobile = window.innerWidth < 720;
  const isSmall = window.innerWidth < 1024;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('[3D] WebGL недоступен — анимация hero отключена');
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = reduceMotion ? 0.4 : 1; // reduced-motion: медленно, но видно
  const PALETTE = ['#FF9A3D', '#FFC866', '#7C6BFF', '#EAF1FB'].map(function (c) { return new THREE.Color(c); });

  /* ============ ГЕНЕРАТОРЫ ТЕКСТУР ЧАСТИЦ ============ */
  const makeGlowTexture = () => {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  };

  const makeSparkleTexture = () => {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const r = s / 2;
    ctx.save();
    ctx.translate(r, r);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.14, -r * 0.14, r, 0);
    ctx.quadraticCurveTo(r * 0.14, r * 0.14, 0, r);
    ctx.quadraticCurveTo(-r * 0.14, r * 0.14, -r, 0);
    ctx.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fill();
    const mask = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    mask.addColorStop(0, 'rgba(255,255,255,1)');
    mask.addColorStop(0.55, 'rgba(255,255,255,1)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = mask;
    ctx.fillRect(-r, -r, s, s);
    ctx.restore();
    return new THREE.CanvasTexture(c);
  };

  const makeSnowflakeTexture = () => {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const r = s * 0.44;
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      ctx.save();
      ctx.rotate(k * Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r);
      ctx.moveTo(0, -r * 0.6);
      ctx.lineTo(r * 0.22, -r * 0.45);
      ctx.moveTo(0, -r * 0.6);
      ctx.lineTo(-r * 0.22, -r * 0.45);
      ctx.moveTo(0, -r * 0.88);
      ctx.lineTo(r * 0.15, -r * 0.75);
      ctx.moveTo(0, -r * 0.88);
      ctx.lineTo(-r * 0.15, -r * 0.75);
      ctx.stroke();
      ctx.restore();
    }
    const mask = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    mask.addColorStop(0, 'rgba(255,255,255,1)');
    mask.addColorStop(0.7, 'rgba(255,255,255,.85)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = mask;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    return new THREE.CanvasTexture(c);
  };

  /* ============ 1. ГЛУБИНА — МЯГКОЕ СВЕЧЕНИЕ ============ */
  const glowCount = isMobile ? 500 : 1200;
  const glowPos = new Float32Array(glowCount * 3);
  const glowCol = new Float32Array(glowCount * 3);
  for (let i = 0; i < glowCount; i++) {
    glowPos[i * 3]     = (Math.random() - 0.5) * 14;
    glowPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    glowPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    const c = PALETTE[(Math.random() * PALETTE.length) | 0];
    glowCol[i * 3] = c.r; glowCol[i * 3 + 1] = c.g; glowCol[i * 3 + 2] = c.b;
  }
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  const glowMat = new THREE.PointsMaterial({
    size: isMobile ? 0.12 : 0.14,
    map: makeGlowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const glowPoints = new THREE.Points(glowGeo, glowMat);
  scene.add(glowPoints);

  /* ============ 2. СРЕДНИЙ ПЛАН — ИСКРЫ-ЗВЁЗДЫ ============ */
  const sparkCount = isMobile ? 60 : 120;
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    sparkPos[i * 3]     = (Math.random() - 0.5) * 12;
    sparkPos[i * 3 + 1] = (Math.random() - 0.5) * 7;
    sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: isMobile ? 0.28 : 0.34,
    map: makeSparkleTexture(),
    color: 0xFFE9C2,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  scene.add(sparkPoints);

  /* ============ 3. ПЕРЕДНИЙ ПЛАН — СНЕЖИНКИ ============ */
  const snowCount = isMobile ? 40 : 90;
  const snowBase = new Float32Array(snowCount * 3);
  const snowSpeed = new Float32Array(snowCount);
  const snowSeed = new Float32Array(snowCount);
  for (let i = 0; i < snowCount; i++) {
    snowBase[i * 3]     = (Math.random() - 0.5) * 24;
    snowBase[i * 3 + 1] = (Math.random() - 0.5) * 18;
    snowBase[i * 3 + 2] = 1 + Math.random() * 2;
    snowSpeed[i] = 0.6 + Math.random() * 0.9;
    snowSeed[i] = Math.random() * Math.PI * 2;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowBase, 3));
  const snowMat = new THREE.PointsMaterial({
    size: isMobile ? 0.24 : 0.3,
    map: makeSnowflakeTexture(),
    color: 0xEAF4FF,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  scene.add(snowPoints);

  // падение снежинок: позиции обновляются по кадру
  const snowFall = (t, dt) => {
    const arr = snowGeo.attributes.position.array;
    for (let i = 0; i < snowCount; i++) {
      arr[i * 3 + 1] -= snowSpeed[i] * dt * 0.45;
      arr[i * 3] += Math.sin(t * 0.6 + snowSeed[i]) * 0.005;
      if (arr[i * 3 + 1] < -9) {
        arr[i * 3 + 1] = 9;
        arr[i * 3] = (Math.random() - 0.5) * 24;
      }
    }
    snowGeo.attributes.position.needsUpdate = true;
  };

  /* ============ 2. ГРУППА «СОЗВЕЗДИЕ-ТОР» ============ */
  const group = new THREE.Group();
  scene.add(group);

  const knotMat = new THREE.MeshBasicMaterial({ color: 0xFF9A3D, wireframe: true, transparent: true, opacity: 0.85 });
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.0, 0.3, 220, 32), knotMat);
  group.add(knot);

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xFFC866, wireframe: true, transparent: true, opacity: 0.55 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), coreMat);
  group.add(core);

  // «созвездие» — точки на сфере-оболочке
  const shellCount = 220;
  const sPos = new Float32Array(shellCount * 3);
  for (let i = 0; i < shellCount; i++) {
    const r = 1.9 + Math.random() * 0.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    sPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    sPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    sPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const shellAMat = new THREE.PointsMaterial({ size: 0.07, color: 0x7C6BFF, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const shellBMat = new THREE.PointsMaterial({ size: 0.06, color: 0x9BB8FF, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const shellA = new THREE.Points(sGeo, shellAMat);
  const shellB = new THREE.Points(sGeo, shellBMat);
  group.add(shellA);
  group.add(shellB);

  // кольца
  const ringGeo = new THREE.RingGeometry(1.75, 2.25, 96);
  const ring1Mat = new THREE.MeshBasicMaterial({ color: 0xFF9A3D, side: THREE.DoubleSide, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring1 = new THREE.Mesh(ringGeo, ring1Mat);
  ring1.rotation.set(Math.PI / 2.6, 0.3, 0);
  const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x7C6BFF, side: THREE.DoubleSide, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring2 = new THREE.Mesh(ringGeo, ring2Mat);
  ring2.rotation.set(Math.PI / 1.8, -0.5, 0.4);
  group.add(ring1);
  group.add(ring2);

  // «комета» — яркие точки, летящие по кольцу (движение видно мгновенно)
  const cometCount = 16;
  const cPos = new Float32Array(cometCount * 3);
  for (let i = 0; i < cometCount; i++) {
    const a = (i / cometCount) * Math.PI * 2;
    cPos[i * 3]     = Math.cos(a) * 2.0;
    cPos[i * 3 + 1] = Math.sin(a) * 2.0;
    cPos[i * 3 + 2] = 0;
  }
  const cometGeo = new THREE.BufferGeometry();
  cometGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  const cometMat = new THREE.PointsMaterial({ size: 0.16, color: 0xFFD9A0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const cometSpin = new THREE.Group();
  cometSpin.add(new THREE.Points(cometGeo, cometMat));
  ring1.add(cometSpin);

  // на планшетах и телефонах объект приглушаем, чтобы не мешал тексту
  if (isSmall) {
    [knotMat, coreMat].forEach(m => m.opacity *= 0.55);
    [shellAMat, shellBMat].forEach(m => m.opacity *= 0.5);
    ring1Mat.opacity *= 0.65;
    ring2Mat.opacity *= 0.65;
  }

  const pos = { x: 0, y: 0, z: -1.5, scale: 1 };
  const placeObject = () => {
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z + 1.5) * camera.aspect;
    if (window.innerWidth >= 1024) {
      // пустая правая колонка (hero — двухколоночная сетка)
      pos.x = 0.55 * halfW; pos.y = 0; pos.scale = 1;
    } else if (window.innerWidth >= 720) {
      // планшет: объект за заголовком, справа от центра
      pos.x = 0.18 * halfW; pos.y = 1.7; pos.scale = 0.6;
    } else {
      // телефон: маленький объект позади шапки-заголовка
      pos.x = 0; pos.y = 1.9; pos.scale = 0.45;
    }
    group.position.set(pos.x, pos.y, pos.z);
    group.scale.setScalar(pos.scale);
  };

  /* ============ 3. РЕСАЙЗ ============ */
  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeObject();
  };
  window.addEventListener('resize', onResize);
  onResize();


  /* ============ 4. МЫШЬ ============ */
  const pointer = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  if (!reduceMotion && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  /* ============ 5. ЦИКЛ АНИМАЦИИ ============ */
  const clock = new THREE.Clock();
  let last = performance.now();
  let rafId = null;
  let running = false;

  const render = () => {
    const t = clock.getElapsedTime();
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // глубина: свечение мерцает и дрейфует
    glowMat.opacity = 0.7 + Math.sin(t * 0.8) * 0.25;
    glowPoints.rotation.y = Math.sin(t * 0.05) * 0.15;
    glowPoints.rotation.x = Math.cos(t * 0.04) * 0.08;

    // искры: сверкание (пульс размера и прозрачности) + медленный поворот
    sparkMat.opacity = 0.6 + Math.sin(t * 1.2) * 0.4;
    sparkMat.size = (isMobile ? 0.28 : 0.34) * (1 + Math.sin(t * 1.8) * 0.2);
    sparkPoints.rotation.y += 0.0015 * SPEED;

    // снежинки: падение вниз с покачиванием
    snowFall(t, dt);

    // объект: доворот за мышью + «дыхание»
    smooth.x += (pointer.x - smooth.x) * 0.06;
    smooth.y += (pointer.y - smooth.y) * 0.06;
    group.rotation.y += (0.005 + smooth.x * 0.08) * SPEED;
    group.rotation.x = 0.35 + smooth.y * 0.35;
    group.position.y = pos.y + Math.sin(t * 0.8) * 0.15;

    // тор-узел крутится по всем осям — это видно сразу
    knot.rotation.x += 0.007 * SPEED;
    knot.rotation.y += 0.016 * SPEED;
    knot.rotation.z += 0.005 * SPEED;

    // ядро пульсирует
    core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.22);

    // орбиты «созвездия» в противоход
    shellA.rotation.y += 0.014 * SPEED;
    shellB.rotation.y -= 0.017 * SPEED;
    shellA.rotation.x = Math.sin(t * 0.2) * 0.2;
    shellB.rotation.x = Math.cos(t * 0.23) * 0.2;

    // кольца в противоход + быстрая «комета»
    ring1.rotation.z += 0.009 * SPEED;
    ring2.rotation.z -= 0.012 * SPEED;
    cometSpin.rotation.z += 0.3 * SPEED;

    // параллакс камеры
    camera.position.x = smooth.x * 0.7;
    camera.position.y = smooth.y * 0.45;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(render);
  };

  const start = () => { if (!running) { running = true; render(); } };
  const stop = () => { if (running) { running = false; cancelAnimationFrame(rafId); } };

  start(); // даже при reduced-motion — медленный «фоновый» режим
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  // экономия ресурсов: когда hero ушёл со экрана, цикл останавливается
  const sceneIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) start();
      else stop();
    });
  }, { threshold: 0.01 });
  sceneIO.observe(container);

  console.info('[3D] сцена hero: OK, свечение ' + glowCount + ' / искры ' + sparkCount + ' / снежинки ' + snowCount + ', ширина ' + window.innerWidth + 'px');
})();

