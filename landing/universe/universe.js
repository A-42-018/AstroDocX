/* ============================================================
   ASTRODOCX — UNIVERSE INTRO · P0 skeleton (plan §12)
   Isolated module for #universe. Does not touch script.js state.

   One master value p (0..1, scroll-scrubbed) drives everything:
   scene text, progress rail, camera. P0 renders the starfield
   only; the particle shapes arrive in P1 (shader morph).

   Modes (gsap.matchMedia):
     desktop  pinned, +=800%, scrub 0.8
     mobile   (<=900px) pinned, +=600%, low tier
     reduced  (prefers-reduced-motion)  no pin, scenes stack as text

   Rendering: one WebGL context (three r128). The RAF loop runs
   only while #universe is on screen and the tab is visible.
============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const root = document.getElementById('universe');
  const SCENES = window.ADX_SCENES;
  if (!root || !SCENES || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const canvas  = document.getElementById('uniCanvas');
  const textBox = root.querySelector('.uni-text');
  const rail    = root.querySelector('.uni-rail');
  const skip    = root.querySelector('.uni-skip');
  const hint    = root.querySelector('.uni-hint');
  const navbar  = document.getElementById('navbar');
  const REDUCE  = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]reduce=1\b/.test(location.search);   // ?reduce=1 forces the static path for QA
  const clamp   = (v, a, b) => v < a ? a : v > b ? b : v;
  const END_P   = SCENES[SCENES.length - 1].hold[0];          // the last scene (Earth) starts here; the nav comes back
  const mid     = s => (s.hold[0] + s.hold[1]) / 2;

  /* A reload with the browser's restored scroll makes ScrollTrigger measure the pin while already scrolled
     (start went negative and every scene was off). The intro restarts at the top instead; deep links keep their hash. */
  if (!REDUCE && !location.hash) {
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    if (window.scrollY > 0) window.scrollTo(0, 0);
  }

  /* ── 1. DOM: scene text (real <h2>/<p>, so SEO + screen readers get the story) ── */
  const sceneEls = SCENES.map((s, i) => {
    const el = document.createElement('article');
    el.className = 'uni-scene';
    el.dataset.pos = s.pos;
    el.setAttribute('aria-labelledby', 'uniH' + i);
    el.innerHTML =
      '<span class="uni-no">' + String(i + 1).padStart(2, '0') + ' / ' + String(SCENES.length).padStart(2, '0') + '</span>' +
      '<h2 id="uniH' + i + '">' + s.head.map(l => '<span>' + l + '</span>').join('') + '</h2>' +
      '<p>' + s.sub + '</p>';
    textBox.appendChild(el);
    return el;
  });

  /* progress rail: 7 ticks, scene name on hover, click = jump to that hold */
  const ticks = SCENES.map((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'uni-tick';
    b.setAttribute('aria-label', 'Go to scene ' + (i + 1) + ': ' + s.name);
    b.innerHTML = '<i></i><b>' + s.name + '</b>';
    b.addEventListener('click', () => scrollToP(mid(s)));
    li.appendChild(b); rail.appendChild(li);
    return b;
  });

  /* ── 2. Scene state for progress p (pure function: scroll jumps / reversal are safe) ── */
  const FADE = 0.025;
  let current = -1, wasEnd = false;
  function applyText(p) {
    let best = 0, bi = 0;
    SCENES.forEach((s, i) => {
      const a = s.hold[0], b = s.hold[1];
      const prev = SCENES[i - 1], next = SCENES[i + 1];
      /* fade inside the morph window; scenes that abut (no gap) fade inside their own hold so two never overlap */
      const inStart  = prev && a - prev.hold[1] < FADE * 2 ? a : a - FADE;
      const outEnd   = next && next.hold[0] - b < FADE * 2 ? b : b + FADE;
      const vIn  = i === 0 ? 1 : clamp((p - inStart) / FADE, 0, 1);            // first scene is visible at p = 0
      const vOut = i === SCENES.length - 1 ? 1 : clamp((outEnd - p) / FADE, 0, 1);
      const v = Math.min(vIn, vOut), el = sceneEls[i];
      el.style.opacity = v.toFixed(3);
      el.style.setProperty('--ls', (0.12 + (1 - v) * 0.28).toFixed(3) + 'em');          // letter-spacing eases 0.4em -> 0.12em on enter
      el.style.visibility = v > 0.01 ? 'visible' : 'hidden';
      el.classList.toggle('is-on', v > 0.5);
      const slide = i === 0 ? 0 : 1;
      el.style.filter = v < 1 ? 'blur(' + ((1 - v) * 8).toFixed(1) + 'px)' : 'none';
      const k = (p < (a + b) / 2 ? 1 : -1) * 40 * (1 - v) * slide;           // enter from below, exit upward
      el.style.translate = '0 ' + k.toFixed(1) + 'px';
      if (v > best) { best = v; bi = i; }
    });
    if (bi !== current) {
      current = bi;
      ticks.forEach((t, i) => { t.classList.toggle('is-current', i === bi); if (i === bi) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
    }
    if (navbar) navbar.classList.toggle('nav-hidden', !REDUCE && !!st && st.isActive && p < END_P - 0.03);   // nav appears with the last scene
    const inEnd = p >= END_P - 0.005;
    if (inEnd !== wasEnd) { wasEnd = inEnd; if (inEnd && navbar) gsap.to(navbar, { yPercent: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' }); }   // template hides the nav on scroll-down; the last scene shows it
    skip.classList.toggle('is-hidden', inEnd);
    hint.classList.toggle('is-hidden', p > 0.02);
  }

  /* ── 3. WebGL: renderer + 3-layer starfield (plan §12.4) ── */
  const small = () => window.innerWidth <= 900;
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  let tier = (small() || lowEnd) ? 'low' : 'high';
  const TIERS = { high: { dpr: 1.75, stars: [3000, 1500, 600] }, mid: { dpr: 1.5, stars: [2200, 1100, 450] }, low: { dpr: 1.25, stars: [1500, 750, 300] } };
  const NEXT_TIER = { high: 'mid', mid: 'low' };

  let staticMode = false, posterT = 0;
  let renderer = null, scene, camera, starLayers = [], webgl = false, engine = null, fx = null;
  const U = { uTime: { value: 0 }, uPR: { value: 1 }, uBright: { value: 0.35 } };   // stars <= 35% of main brightness
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    webgl = true;
  } catch (e) { webgl = false; }

  const STAR_VS =
    'attribute vec4 aSeed; uniform float uTime, uPR, uLayer; varying float vA; varying vec3 vC;' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);' +
    ' float tw = .7 + .3 * sin(uTime * (.4 + aSeed.x * 1.6) + aSeed.y * 6.2831);' +
    ' gl_PointSize = clamp((1.1 + aSeed.z * 2.2) * uPR * (320.0 / -mv.z) * (.6 + uLayer * .25), 1.0, 7.0);' +
    ' vA = tw * (.35 + aSeed.z * .65);' +
    ' vC = aSeed.w < .7 ? vec3(.92,.95,1.) : (aSeed.w < .92 ? vec3(.5,.66,1.) : vec3(.96,.79,.48));' +
    ' gl_Position = projectionMatrix * mv; }';
  const STAR_FS =
    'precision mediump float; uniform float uBright; varying float vA; varying vec3 vC;' +
    'void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d,d) * 4.0;' +
    ' float a = exp(-r2 * 5.0) + .15 * exp(-r2 * 1.6);' +
    ' gl_FragColor = vec4(vC * a * vA * uBright * 2.4, a * vA); }';

  function buildStars() {
    starLayers.forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
    starLayers = [];
    const radii = [[28, 60], [18, 40], [10, 26]];                             // far, mid, near shells
    TIERS.high.stars.forEach((n, li) => {                                    // built at the top count; lower tiers just draw a prefix
      const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        const r = radii[li][0] + Math.random() * (radii[li][1] - radii[li][0]);
        pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u * 0.7; pos[i * 3 + 2] = r * s * Math.sin(th) - 8;
        seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
      const m = new THREE.ShaderMaterial({
        uniforms: Object.assign({ uLayer: { value: li } }, U),
        vertexShader: STAR_VS, fragmentShader: STAR_FS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      scene.add(pts); starLayers.push(pts);
    });
    setStarRange();
  }
  function setStarRange() { starLayers.forEach((l, li) => l.geometry.setDrawRange(0, TIERS[tier].stars[li])); }
  function setTier(t) {
    tier = t; setStarRange();
    if (engine) engine.setTier(t);
    resize();
  }

  if (webgl) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 14);
    renderer.setClearColor(0x02030a, 1);
    buildStars();
    engine = ADX_ENGINE.create(scene, { tier: tier });
    engine.onChange = () => { if (staticMode) schedulePosters(); else if (!running) renderOnce(); };
    fx = ADX_FX.create(scene, engine);
  } else {
    root.classList.add('no-webgl');      // P5: static poster fallback; P0 keeps the text-only pin
  }

  function resize() {
    if (!webgl) return;
    const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    U.uPR.value = dpr;
    if (engine) { engine.uniforms.uPR.value = dpr; fx.setPR(dpr); }
  }

  /* ── 4. Camera + loop (render only while on screen and visible) ── */
  let P = 0, targetP = 0, onScreen = false, running = false, lastT = 0, frames = 0, dtAvg = 16, slowMs = 0;
  let mx = 0, my = 0, mouseSeen = false;
  const repelOn = !REDUCE && !small() && window.matchMedia('(pointer: fine)').matches;
  if (!REDUCE && !small()) {
    window.addEventListener('mousemove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; mouseSeen = true; }, { passive: true });
  }

  const mouseW = new THREE.Vector3(), rayV = new THREE.Vector3();
  function applyCamera(p, time) {
    /* P3: Catmull-Rom path, one key per scene (camera.js). Mouse adds <= 1.5 deg of parallax on desktop. */
    const c = ADX_CAMERA.at(p);
    const k = camera.aspect < 1.2 ? Math.min(2.4, 1.2 / camera.aspect) : 1;       // portrait: pull back so every shape and the wordmark fit
    camera.position.copy(c.pos).sub(c.look).multiplyScalar(k).add(c.look);
    camera.position.x += mx * 0.35; camera.position.y += -my * 0.25;
    camera.lookAt(c.look);
    camera.rotation.y += -mx * 0.026; camera.rotation.x += -my * 0.026;
    if (Math.abs(camera.fov - c.fov) > 0.01) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    /* mouse repel: ray through the cursor hits the z = 0 plane (desktop only) */
    if (repelOn && mouseSeen) {
      rayV.set(mx * 2, -my * 2, 0.5).unproject(camera).sub(camera.position).normalize();
      const d = -camera.position.z / rayV.z;
      mouseW.copy(camera.position).addScaledVector(rayV, d);
      engine.uniforms.uMouse.value.copy(mouseW); engine.uniforms.uRep.value = 0.6;
    } else if (engine) engine.uniforms.uRep.value = 0;
  }

  function frame(time) {
    if (!onScreen || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    const dt = lastT ? Math.min(100, time - lastT) : 16; lastT = time;
    /* adaptive tier: frame time above 22 ms (smoothed) for 2 s drops one tier (high -> mid -> low), never back up */
    if (++frames > 45 && NEXT_TIER[tier]) {
      slowMs = (dtAvg = dtAvg * 0.9 + dt * 0.1) > 22 ? slowMs + dt : 0;
      if (slowMs > 2000) { slowMs = 0; setTier(NEXT_TIER[tier]); }
    }
    P += (targetP - P) * (1 - Math.exp(-dt / 90));
    if (Math.abs(targetP - P) < 0.0003) P = targetP;
    U.uTime.value = time * 0.001;
    applyCamera(P, time);
    engine.setProgress(P, time * 0.001); fx.update(time * 0.001);
    renderer.render(scene, camera);
  }
  function start() { if (webgl && !running && onScreen && !document.hidden && !REDUCE) { running = true; lastT = 0; requestAnimationFrame(frame); } }
  function renderOnce() { if (webgl) { applyCamera(P, 0); engine.setProgress(P, 3); fx.update(3); renderer.render(scene, camera); } }

  new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; window.ADX_NEBULA_PAUSED = onScreen; if (onScreen) start(); }, { rootMargin: '80px 0px' }).observe(root);
  document.addEventListener('visibilitychange', start);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; webgl = false; root.classList.add('no-webgl'); });

  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { resize(); if (!running) renderOnce(); }, 120); }, { passive: true });

  /* ── cursor: reuse the site cursor, add an EXPLORE / LAUNCH label over [data-cursor] elements ── */
  const ring = document.getElementById('cursor-ring');
  skip.dataset.cursor = 'SKIP';
  if (ring) root.querySelectorAll('[data-cursor]').forEach(el => {
    el.addEventListener('mouseenter', () => { ring.dataset.label = el.dataset.cursor; ring.classList.add('has-label'); });
    el.addEventListener('mouseleave', () => ring.classList.remove('has-label'));
  });

  /* ── 5. Scroll: pin + master progress ── */
  let st = null;
  function scrollToP(p) {
    if (!st) { root.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' }); return; }
    const y = st.start + (st.end - st.start) * clamp(p, 0, 1);
    window.scrollTo({ top: y, behavior: REDUCE ? 'auto' : 'smooth' });
  }
  /* Skip intro = on to the Health Twin (the pin's end is where #twin starts) */
  function skipToTwin() {
    const tw = document.getElementById('twin');
    if (st) window.scrollTo({ top: st.end, behavior: REDUCE ? 'auto' : 'smooth' });
    else if (tw) tw.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
  }
  skip.addEventListener('click', e => { e.preventDefault(); skipToTwin(); });

  /* ── static mode (reduced motion, or no WebGL): no pin, scenes stack; with WebGL each scene gets a poster
        rendered once from the real engine (shape fully formed) as its background ── */
  function drawPosters() {
    if (!webgl || !engine) return;
    const W = 1280, H = 720;
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    U.uPR.value = 1; engine.uniforms.uPR.value = 1; fx.setPR(1);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    mx = my = 0;
    SCENES.forEach((s, i) => {
      const p = mid(s);
      applyCamera(p, 0); engine.setProgress(p, 3); fx.update(3);
      renderer.render(scene, camera);
      try { sceneEls[i].style.setProperty('--poster', 'url(' + canvas.toDataURL('image/jpeg', 0.82) + ')'); sceneEls[i].classList.add('has-poster'); } catch (e) {}
    });
  }
  function schedulePosters() { clearTimeout(posterT); posterT = setTimeout(drawPosters, 250); }
  function enterStatic() {
    staticMode = true;
    root.classList.add('is-static');
    sceneEls.forEach(el => { el.style.cssText = ''; });
    if (webgl) { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(schedulePosters); }
    return () => { staticMode = false; root.classList.remove('is-static'); sceneEls.forEach(el => el.classList.remove('has-poster')); };
  }

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    if (REDUCE || !webgl) return enterStatic();                 // forced reduce (?reduce=1) or no WebGL: stacked scenes
    root.classList.remove('is-static');
    resize();
    const len = small() ? ADX_PIN.mobile : ADX_PIN.desktop;
    st = ScrollTrigger.create({
      trigger: root, start: 'top top', end: '+=' + len + '%',
      pin: true, pinSpacing: true, anticipatePin: 1, scrub: 0.8, refreshPriority: 1,
      onUpdate: self => { targetP = self.progress; applyText(self.progress); if (!running) { P = targetP; renderOnce(); } }
    });
    applyText(targetP);
    ScrollTrigger.sort();
    requestAnimationFrame(() => ScrollTrigger.refresh());
    start();
    return () => { st.kill(); st = null; };
  });
  mm.add('(prefers-reduced-motion: reduce)', enterStatic);

  /* ?skip=1 -> straight to the Health Twin */
  if (/[?&]skip=1\b/.test(location.search) && !REDUCE) {
    window.addEventListener('load', () => setTimeout(skipToTwin, 60), { once: true });
  }

  window.ADX_UNIVERSE = {
    /* for tour.js: pixel position of progress p, and the stops (scene holds) with how long to dwell */
    yAt: p => st ? st.start + (st.end - st.start) * clamp(p, 0, 1) : 0,
    stops: () => SCENES.map(s => ({ p: mid(s), hold: s.tour || 3 })),
    get tier() { return tier; }, setTier: setTier,
    scrollToP: scrollToP, get progress() { return targetP; }, scenes: SCENES };
});
