/* ============================================================
   ASTRODOCX — #astrodocx particle reveal
   After the Health Twin: a short pinned section where the starfield
   gathers into the ASTRODOCX wordmark (same particle engine as the
   intro, reveal mode: dust -> wordmark), the wordmark rises and
   shrinks, and the pitch, typewriter, steps and buttons fade in below.

   Progress p (0..1, scroll-scrubbed) -> everything, as a pure function:
     0.00-0.40  particles gather into the wordmark (centred, large)
     0.40-0.50  hold
     0.50-0.75  wordmark rises and shrinks
     0.55-0.80  content fades in
     0.80-1.00  hold
   Reduced motion / no WebGL: no pin, the section is a normal page
   section with a CSS wordmark (the same <h1>) and a plain fade-in.
============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  const root = document.getElementById('astrodocx'), canvas = document.getElementById('adxCanvas');
  if (!root || !canvas || !window.ADX_ENGINE || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]reduce=1\b/.test(location.search);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const items = Array.from(root.querySelectorAll('.adx-reveal')).filter(el => !el.classList.contains('adx-wordmark'));
  const small = () => window.innerWidth <= 900;

  /* plain fade-in (fallback path) */
  function plain() {
    if (REDUCE) { gsap.set(root.querySelectorAll('.adx-reveal'), { opacity: 1 }); return; }
    gsap.fromTo(root.querySelectorAll('.adx-reveal'), { opacity: 0, y: 28 }, {
      scrollTrigger: { trigger: root, start: 'top 70%' }, opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out'
    });
  }

  let renderer = null;
  if (!REDUCE) {
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  }
  if (!renderer) { plain(); return; }

  root.classList.add('is-particle');
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const tier = (small() || lowEnd) ? 'low' : 'high';
  const engine = ADX_ENGINE.create(scene, { tier: tier, reveal: true });

  let k = 1;
  function resize() {
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, tier === 'low' ? 1.25 : 1.75);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    engine.uniforms.uPR.value = dpr;
    k = camera.aspect < 1.2 ? Math.min(2.4, 1.2 / camera.aspect) : 1;      // portrait: pull back so the wordmark fits
    camera.position.set(0, 0.2, 9 * k); camera.lookAt(0, 0.2, 0);
  }

  let P = 0, onScreen = false, running = false;
  function apply(p, time) {
    const morph = sm(clamp(p / 0.40, 0, 1)), rise = sm(clamp((p - 0.50) / 0.25, 0, 1)), show = clamp((p - 0.55) / 0.25, 0, 1);
    engine.setPair(0, 6, morph, time, { sc: lerp(3.2, 2.1, rise), off: [0, lerp(0, small() ? 2.4 : 2.1, rise), 0] });
    items.forEach((el, i) => {
      const v = clamp((show - i * 0.09) / 0.5, 0, 1);
      el.style.opacity = v.toFixed(3);
      el.style.translate = '0 ' + ((1 - v) * 24).toFixed(1) + 'px';
      el.style.pointerEvents = v > 0.6 ? 'auto' : 'none';
    });
  }
  function frame(now) {
    if (!onScreen || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    apply(P, now * 0.001);
    renderer.render(scene, camera);
  }
  function start() { if (!running && onScreen && !document.hidden) { running = true; requestAnimationFrame(frame); } }
  function once() { apply(P, 2); renderer.render(scene, camera); }

  new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) start(); }, { rootMargin: '80px 0px' }).observe(root);
  document.addEventListener('visibilitychange', start);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; });
  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { resize(); if (!running) once(); }, 120); }, { passive: true });

  resize();
  const st = ScrollTrigger.create({
    trigger: root, start: 'top top', end: '+=' + (small() ? 240 : 300) + '%',
    pin: true, pinSpacing: true, anticipatePin: 1, scrub: 0.8, refreshPriority: -1,
    onUpdate: self => { P = self.progress; if (!running) once(); }
  });
  once();
  ScrollTrigger.sort();
  requestAnimationFrame(() => ScrollTrigger.refresh());
  start();

  window.ADX_REVEAL = { yAt: p => st.start + (st.end - st.start) * clamp(p, 0, 1) };
});
