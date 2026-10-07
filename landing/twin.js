/* ============================================================
   ASTRODOCX — HEALTH TWIN (L2)
   Isolated module for #twin. Does not touch script.js state.

   Timeline (progress p, 0..1):
     0.00–0.20  rings expand, particles assemble into the body
     0.20–0.60  scan line sweeps head → feet; each panel draws its
                leader line and pops in when the scan passes it
     0.60–0.85  readiness gauge counts up, ECG goes live
     0.85–1.00  heart hotspot turns amber + action card appears

   Modes (gsap.matchMedia):
     desktop  (>900px, motion OK)  pinned, scrubbed (+=150%)
     mobile   (≤900px, motion OK)  no pin; plays once on enter
     reduced  (prefers-reduced-motion)  static final state

   Rendering: Canvas 2D particles + SVG only (no extra WebGL
   context). RAF loop runs only while #twin is on screen.
============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const section = document.getElementById('twin');
  if (!section || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  /* ── DOM ─────────────────────────────────────────────── */
  const stage      = document.getElementById('twinStage');
  const figure     = document.getElementById('twinFigure');
  const bodySvg    = document.getElementById('twinBody');
  const canvas     = document.getElementById('twinCanvas');
  const ctx        = canvas.getContext('2d');
  const outline    = document.getElementById('twinOutline');
  const clipPath   = document.getElementById('twinClipPath');
  const rings      = document.getElementById('twinRings');
  const scan       = document.getElementById('twinScan');
  const leadersSvg = document.getElementById('twinLeaders');
  const ecg        = document.getElementById('twinEcg');
  const ecgCtx     = ecg.getContext('2d');
  const hrEl       = document.getElementById('twinHr');
  const hrDelta    = document.getElementById('twinHrDelta');
  const heartPanel = document.getElementById('twinHeartPanel');
  const readyBox   = document.getElementById('twinReadiness');
  const readyRing  = document.getElementById('twinReadyRing');
  const readyVal   = document.getElementById('twinReadyVal');
  const action     = document.getElementById('twinAction');

  const VB_W = 300, VB_H = 660;
  const READY = 87;
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ── 1. Body silhouette (original, generated) ─────────────
     Right-side control points (dx from centre, y). Mirrored and
     smoothed with a closed Catmull-Rom spline → cubic Béziers.
     Same path feeds the SVG outline, the clip and the particle
     sampler, so everything lines up exactly. */
  const RIGHT = [
    [13,88],[15,104],[36,114],[58,122],[70,134],[76,160],[80,200],[85,240],[89,275],[93,315],
    [98,345],[102,362],[100,380],[92,388],[86,374],[84,350],[78,318],[72,282],[66,246],[60,205],
    [55,170],[52,200],[48,245],[50,280],[56,310],[60,350],[58,400],[52,455],[52,500],[48,555],
    [40,600],[48,620],[46,634],[14,634],[16,604],[16,550],[14,480],[12,420],[9,370],[0,345]
  ];
  const CX = 150;
  const pts = RIGHT.map(p => [CX + p[0], p[1]]);
  for (let i = RIGHT.length - 2; i >= 0; i--) pts.push([CX - RIGHT[i][0], RIGHT[i][1]]);

  function catmullRomClosed(P) {
    const n = P.length, f = v => v.toFixed(1);
    let d = 'M' + f(P[0][0]) + ' ' + f(P[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + f(c1x) + ' ' + f(c1y) + ' ' + f(c2x) + ' ' + f(c2y) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + 'Z';
  }
  const HEAD = 'M121 56a29 37 0 1 0 58 0a29 37 0 1 0 -58 0Z';
  const BODY_D = catmullRomClosed(pts) + HEAD;
  outline.setAttribute('d', BODY_D);
  clipPath.setAttribute('d', BODY_D);

  /* ── 2. Particle field ───────────────────────────────────── */
  const isSmall = () => window.innerWidth <= 900;
  const N_FILL = isSmall() ? 650 : 1300;
  const N_EDGE = isSmall() ? 220 : 420;
  const particles = [];
  (function sample() {
    const off = document.createElement('canvas');
    off.width = VB_W; off.height = VB_H;
    const octx = off.getContext('2d');
    const path = new Path2D(BODY_D);
    let guard = 0;
    while (particles.length < N_FILL && guard++ < 40000) {
      const x = 40 + Math.random() * 220, y = 16 + Math.random() * 622;
      if (octx.isPointInPath(path, x, y, 'nonzero')) particles.push(mk(x, y, false));
    }
    const len = outline.getTotalLength ? outline.getTotalLength() : 0;
    if (len) {
      for (let i = 0; i < N_EDGE; i++) {
        const pt = outline.getPointAtLength((i / N_EDGE) * len);
        particles.push(mk(pt.x + (Math.random() - .5) * 2, pt.y + (Math.random() - .5) * 2, true));
      }
    }
    function mk(x, y, edge) {
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 260;
      return {
        tx: x, ty: y, edge: edge,
        sx: CX + Math.cos(a) * r, sy: 640 + Math.sin(a) * r * 0.35 - Math.random() * 120,
        delay: Math.random(),
        size: edge ? 1.1 + Math.random() * .6 : .5 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        speed: .6 + Math.random() * 1.6
      };
    }
  })();

  /* ── 3. Geometry: viewBox → figure px (preserveAspectRatio meet) ── */
  let fig = { w: 1, h: 1, s: 1, ox: 0, oy: 0 }, dpr = 1;
  function measureFigure() {
    const r = { width: figure.offsetWidth, height: figure.offsetHeight };
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    fig.w = Math.max(1, r.width); fig.h = Math.max(1, r.height);
    fig.s = Math.min(fig.w / VB_W, fig.h / VB_H);
    fig.ox = (fig.w - VB_W * fig.s) / 2; fig.oy = (fig.h - VB_H * fig.s) / 2;
    canvas.width = Math.round(fig.w * dpr); canvas.height = Math.round(fig.h * dpr);
    const er = { width: ecg.offsetWidth, height: ecg.offsetHeight };
    ecg.width = Math.max(1, Math.round(er.width * dpr)); ecg.height = Math.max(1, Math.round(er.height * dpr));
  }

  /* ── 4. Hotspots, panels, leader lines ───────────────────── */
  const hotEls = {};
  bodySvg.querySelectorAll('.twin-hot').forEach(g => {
    const m = /translate\(([\d.]+)\s+([\d.]+)\)/.exec(g.getAttribute('transform'));
    hotEls[g.dataset.hot] = { el: g, x: +m[1], y: +m[2] };
  });
  const organs = Array.from(bodySvg.querySelectorAll('.organ')).map(g => {
    const b = g.getBBox();
    return { el: g, y0: b.y, y1: b.y + b.height };
  });
  const panels = Array.from(stage.querySelectorAll('.twin-panel')).map(el => {
    const hot = hotEls[el.dataset.hot];
    const g = document.createElementNS(SVGNS, 'g');
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('class', 'tl-path'); path.setAttribute('pathLength', '1');
    const n1 = document.createElementNS(SVGNS, 'circle'); n1.setAttribute('class', 'tl-node'); n1.setAttribute('r', '2.6');
    const n2 = document.createElementNS(SVGNS, 'circle'); n2.setAttribute('class', 'tl-node'); n2.setAttribute('r', '3.2');
    g.append(path, n1, n2); leadersSvg.appendChild(g);
    /* scan reaches this hotspot at t; panel sequence keyed to it */
    const t = 0.20 + 0.40 * (hot.y / VB_H);
    return { el, side: el.dataset.side, hot, g, path, n1, n2, t };
  });

  /* offset* metrics ignore the panels' entrance transforms, so the
     anchors are where the panels END UP, not where they start. */
  function offsetIn(el) {
    let x = 0, y = 0, n = el;
    while (n && n !== stage) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function layoutLeaders() {
    const sw = stage.offsetWidth, sh = stage.offsetHeight;
    leadersSvg.setAttribute('viewBox', '0 0 ' + sw + ' ' + sh);
    const fo = offsetIn(figure);
    panels.forEach(p => {
      const r = offsetIn(p.el);
      const ax = p.side === 'left' ? r.x + r.w : r.x;
      const ay = r.y + 20;
      const hx = fo.x + fig.ox + p.hot.x * fig.s;
      const hy = fo.y + fig.oy + p.hot.y * fig.s;
      const ex = ax + (p.side === 'left' ? 22 : -22);
      p.path.setAttribute('d', 'M' + ax + ' ' + ay + 'H' + ex + 'L' + hx.toFixed(1) + ' ' + hy.toFixed(1));
      p.n1.setAttribute('cx', ax); p.n1.setAttribute('cy', ay);
      p.n2.setAttribute('cx', hx.toFixed(1)); p.n2.setAttribute('cy', hy.toFixed(1));
    });
  }

  /* ── 5. Render state for a given progress ─────────────────── */
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let P = 0;            // displayed progress
  let scanY = -100;     // viewBox y of the scan line
  let ecgLive = false;
  let watch = false;

  function applyState(p) {
    /* rings + outline */
    const a = easeOut(seg(p, 0, .2));
    rings.style.opacity = a.toFixed(3);
    rings.style.transform = 'scale(' + (.4 + .6 * a).toFixed(3) + ')';
    outline.style.strokeDashoffset = (1 - easeInOut(seg(p, .06, .22))).toFixed(4);
    outline.style.opacity = (.2 + .8 * a).toFixed(3);

    /* scan line */
    const s = seg(p, .2, .6);
    scanY = (p < .2) ? -100 : 14 + s * 630;
    scan.setAttribute('transform', 'translate(0 ' + scanY.toFixed(1) + ')');
    scan.style.opacity = (p > .19 && p < .62) ? Math.min(1, seg(p, .19, .22) * (1 - seg(p, .58, .62))).toFixed(3) : '0';

    /* organs: lit as the scan passes, settle to a dim trace */
    organs.forEach(o => {
      let v = 0;
      if (p >= .2) {
        const mid = (o.y0 + o.y1) / 2, half = (o.y1 - o.y0) / 2 + 14;
        const d = Math.abs(scanY - mid);
        const glow = d < half ? 1 - d / half : 0;
        const passed = scanY > o.y0 ? .32 : 0;
        v = Math.max(passed, glow * .95);
        if (p >= .6) v = .32;
      }
      o.el.style.opacity = v.toFixed(3);
    });

    /* panels + leaders + hotspots */
    panels.forEach(pn => {
      const v = seg(p, pn.t - .02, pn.t + .07);
      const line = easeOut(clamp(v / .6));
      const show = easeOut(clamp((v - .35) / .65));
      pn.path.style.strokeDashoffset = (1 - line).toFixed(4);
      pn.n1.style.opacity = show.toFixed(3);
      pn.n2.style.opacity = line > 0 ? 1 : 0;
      pn.hot.el.style.opacity = line > 0 ? 1 : 0;
      pn.el.style.opacity = show.toFixed(3);
      pn.el.style.transform = 'translateY(' + (10 * (1 - show)).toFixed(2) + 'px) scale(' + (.96 + .04 * show).toFixed(4) + ')';
    });

    /* readiness */
    const r = easeOut(seg(p, .6, .85));
    readyBox.style.opacity = easeOut(seg(p, .56, .64)).toFixed(3);
    readyBox.style.transform = 'translateY(' + (12 * (1 - easeOut(seg(p, .56, .64)))).toFixed(2) + 'px)';
    readyRing.style.strokeDasharray = (READY * r).toFixed(2) + ' 100';
    readyVal.textContent = Math.round(READY * r);
    ecgLive = p >= .6;

    /* alert beat */
    const al = seg(p, .86, .94);
    const w = al > 0;
    if (w !== watch) {
      watch = w;
      heartPanel.classList.toggle('is-watch', w);
      hotEls.heart.el.classList.toggle('is-watch', w);
      const hp = panels.find(x => x.el === heartPanel);
      if (hp) hp.g.classList.toggle('is-watch', w);
      heartPanel.querySelector('.tp-state').textContent = w ? 'WATCH' : 'OK';
      hrEl.textContent = w ? '71' : '62';
      hrDelta.textContent = w ? '↑ 14%' : '';
    }
    action.style.visibility = al > 0 ? 'visible' : 'hidden';
    action.style.opacity = easeOut(al).toFixed(3);
    action.style.transform = 'translateY(' + (12 * (1 - easeOut(al))).toFixed(2) + 'px) scale(' + (.97 + .03 * easeOut(al)).toFixed(4) + ')';
  }

  /* ── 6. Canvas drawing ───────────────────────────────────── */
  function drawParticles(time) {
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * fig.s, 0, 0, dpr * fig.s, dpr * fig.ox, dpr * fig.oy);
    ctx.globalCompositeOperation = 'lighter';
    const a = seg(P, 0, .2);
    const scanning = P > .19 && P < .62;
    for (let i = 0; i < particles.length; i++) {
      const q = particles[i];
      const k = easeOut(clamp(a * 1.6 - q.delay * .6));
      if (k <= 0) continue;
      const x = q.sx + (q.tx - q.sx) * k, y = q.sy + (q.ty - q.sy) * k;
      const tw = REDUCE ? .8 : .65 + .35 * Math.sin(time * .002 * q.speed + q.phase);
      let alpha = (q.edge ? .75 : .42) * tw * k, size = q.size;
      if (scanning) {
        const d = Math.abs(q.ty - scanY);
        if (d < 16) { const g = 1 - d / 16; alpha = Math.min(1, alpha + g * .9); size += g * 1.2; }
      }
      ctx.fillStyle = (q.edge ? 'rgba(165,243,252,' : 'rgba(34,211,238,') + alpha.toFixed(3) + ')';
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* PQRST-ish waveform, one beat per unit phase */
  function ecgWave(t) {
    const g = (m, w, h) => h * Math.exp(-Math.pow((t - m) / w, 2));
    return g(.18, .035, .12) - g(.30, .012, .14) + g(.33, .014, 1) - g(.36, .014, .26) + g(.56, .06, .22);
  }
  function drawEcg(time) {
    const W = ecg.width, H = ecg.height;
    ecgCtx.clearRect(0, 0, W, H);
    ecgCtx.lineWidth = 1.4 * dpr;
    ecgCtx.strokeStyle = watch ? '#F59E0B' : '#EC4899';
    ecgCtx.shadowColor = ecgCtx.strokeStyle; ecgCtx.shadowBlur = 6 * dpr;
    ecgCtx.beginPath();
    const beats = 3.2, bpm = watch ? 71 : 62;
    const shift = (ecgLive && !REDUCE) ? (time / 1000) * (bpm / 60) : 0;
    for (let x = 0; x <= W; x += 2) {
      let ph = (x / W) * beats + shift; ph -= Math.floor(ph);
      const v = ecgLive || REDUCE ? ecgWave(ph) : 0;
      const y = H * .68 - v * H * .58;
      x === 0 ? ecgCtx.moveTo(x, y) : ecgCtx.lineTo(x, y);
    }
    ecgCtx.stroke();
    ecgCtx.shadowBlur = 0;
  }

  /* ── 7. Loop (only while on screen) ──────────────────────── */
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let targetP = 0, onScreen = false, running = false;
  let pinST = null;   // desktop pin; progress read directly each frame

  let lastT = 0;
  function frame(time) {
    if (!onScreen) { running = false; return; }
    requestAnimationFrame(frame);
    if (pinST) targetP = pinST.progress;
    /* frame-rate independent easing toward the scroll position */
    const dt = lastT ? Math.min(100, time - lastT) : 16; lastT = time;
    const d = targetP - P;
    P = Math.abs(d) < .0005 ? targetP : P + d * (1 - Math.exp(-dt / 110));
    applyState(P);
    drawParticles(time);
    drawEcg(time);
  }
  function start() { if (!running && onScreen && !REDUCE) { running = true; lastT = 0; requestAnimationFrame(frame); } }
  function renderOnce() { applyState(P); drawParticles(0); drawEcg(0); }

  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    if (onScreen) { REDUCE ? renderOnce() : start(); }
  }, { rootMargin: '120px 0px' }).observe(section);

  function relayout() { measureFigure(); layoutLeaders(); if (!running) renderOnce(); }
  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(relayout, 120); }, { passive: true });
  ScrollTrigger.addEventListener('refresh', relayout);

  /* ── 8. Modes ─────────────────────────────────────────────── */
  const mm = gsap.matchMedia();

  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    P = targetP = 0;
    const st = pinST = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=150%',
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: self => { targetP = self.progress; }
    });
    /* Pins created after script.js's triggers: re-order so later
       triggers (#education, #contact, nebula segments) account for
       this pin's spacing, then refresh. */
    ScrollTrigger.sort();
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => { st.kill(); pinST = null; };
  });

  mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    P = targetP = 0;
    const st = ScrollTrigger.create({
      trigger: figure,
      start: 'top 75%',
      once: true,
      onEnter: () => {
        const o = { v: 0 };
        gsap.to(o, { v: 1, duration: 4.2, ease: 'none', onUpdate: () => { targetP = o.v; } });
      }
    });
    ScrollTrigger.sort();
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => st.kill();
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    P = targetP = 1;
    renderOnce();
  });

  /* Initial paint (fonts/layout may still shift → also on load) */
  measureFigure(); layoutLeaders(); renderOnce();
  window.addEventListener('load', relayout);
});
