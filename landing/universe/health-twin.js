/* ============================================================
   ASTRODOCX — HEALTH TWIN, made of particles (#twin)
   A body built from ~18k particles: skin shell, skeleton, brain,
   heart, lungs, gut, legs, a transmitter on the right forearm and a
   floor ring. One WebGL canvas, one draw call. Scroll drives it (pure
   function of progress p):

     0.00-0.20  the starfield gathers into the body (feet first)
     0.20-0.30  a scan line sweeps head to feet; each region lights as it passes
     0.30-0.84  six systems, one every 0.09: the region glows, its label and
                leader line appear (Isolation / Environment / Radiation /
                Gravity heart / Distance link / Gravity legs)
     0.86-1.00  crew readiness and the real action card

   Live: the heart beats once a second and sends a ripple through the
   body; the brain pulses amber (the Pilot's ACT alert); the cursor
   pushes particles (desktop). Numbers are the demo mission snapshot.
   Reduced motion / no WebGL: a static section, labels as a grid.
============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  const root = document.getElementById('twin'), canvas = document.getElementById('twinCanvas');
  if (!root || !canvas || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]reduce=1\b/.test(location.search);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const small = () => window.innerWidth <= 900;
  const labels = Array.from(root.querySelectorAll('.tw-label'));
  const final = root.querySelector('.tw-final');
  const linesSvg = document.getElementById('twLines');
  const readyEl = document.getElementById('twReadyVal');
  const READY = 83;                                              // Pilot, demo mission end state

  /* stages: label order = reveal order. reg = particle region to glow, at = body-space anchor of the leader line */
  const STAGES = [
    { reg: 1, at: [0, 1.58, 0.02] },        // brain  - Isolation
    { reg: 3, at: [-0.24, 0.82, 0.08] },    // lungs  - Environment
    { reg: 0, at: [-0.5, 0.25, 0.05] },     // whole body - Radiation
    { reg: 2, at: [0.10, 0.70, 0.14] },     // heart  - Gravity
    { reg: 7, at: [0.80, 0.02, 0.06] },     // forearm transmitter - Distance
    { reg: 5, at: [0.22, -1.25, 0.04] }     // legs   - Gravity
  ];
  const T0 = 0.30, STEP = 0.09, FINAL_AT = 0.86;

  /* ── static / fallback ── */
  function makeStatic() {
    root.classList.add('is-static');
    if (readyEl) readyEl.textContent = READY;
    labels.forEach(l => { l.style.opacity = 1; });
    if (final) final.style.opacity = 1;
  }

  let renderer = null;
  if (!REDUCE) { try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; } }
  if (!renderer) { makeStatic(); return; }
  renderer.setClearColor(0x000000, 0);

  /* ── 1. build the body ── */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const R = rng(20261009);
  const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(6.2831853 * R());

  const N_MAX = 18000;
  const pos = new Float32Array(N_MAX * 3), dust = new Float32Array(N_MAX * 3), reg = new Float32Array(N_MAX), seed = new Float32Array(N_MAX * 4);
  let n = 0;
  function put(x, y, z, r) { if (n >= N_MAX) return; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; reg[n] = r; n++; }
  /* ellipsoid: surface (shell) or volume */
  function ell(cnt, c, rd, r, vol) {
    for (let i = 0; i < cnt; i++) {
      const v = [gauss(), gauss(), gauss()], l = Math.hypot(v[0], v[1], v[2]) || 1, k = vol ? Math.cbrt(R()) / l : 1 / l;
      put(c[0] + v[0] * k * rd[0], c[1] + v[1] * k * rd[1], c[2] + v[2] * k * rd[2], r);
    }
  }
  /* skin shell: head, neck, torso, pelvis, arms; legs are region 5 */
  ell(900, [0, 1.55, 0], [0.30, 0.36, 0.30], 0);
  ell(220, [0, 1.15, 0], [0.12, 0.16, 0.12], 0);
  ell(1700, [0, 0.55, 0], [0.50, 0.76, 0.27], 0);
  ell(700, [0, -0.25, 0], [0.42, 0.30, 0.25], 0);
  ell(500, [-0.66, 0.75, 0], [0.13, 0.42, 0.13], 0);   ell(500, [0.66, 0.75, 0], [0.13, 0.42, 0.13], 0);
  ell(450, [-0.78, 0.05, 0.05], [0.11, 0.42, 0.11], 0);
  ell(520, [0.78, 0.05, 0.05], [0.11, 0.42, 0.11], 7);                                   // forearm: the transmitter
  ell(1100, [-0.2, -0.85, 0], [0.17, 0.55, 0.17], 5);  ell(1100, [0.2, -0.85, 0], [0.17, 0.55, 0.17], 5);
  ell(950, [-0.2, -1.55, 0], [0.13, 0.50, 0.13], 5);   ell(950, [0.2, -1.55, 0], [0.13, 0.50, 0.13], 5);
  /* organs (volume) */
  ell(1300, [0, 1.58, 0.02], [0.20, 0.19, 0.18], 1, true);                                 // brain
  ell(1100, [0.10, 0.70, 0.12], [0.12, 0.14, 0.10], 2, true);                              // heart
  ell(1150, [-0.24, 0.80, 0.05], [0.16, 0.30, 0.14], 3, true); ell(1150, [0.26, 0.80, 0.05], [0.16, 0.30, 0.14], 3, true);   // lungs
  ell(1200, [0, 0.15, 0.08], [0.26, 0.24, 0.14], 4, true);                                 // gut
  /* skeleton: spine, ribs, pelvis ring */
  for (let i = 0; i < 520; i++) { const y = 1.3 - R() * 1.65; put((R() - .5) * 0.04, y, -0.12 + (R() - .5) * 0.04, 6); }
  for (let k = 0; k < 7; k++) for (let i = 0; i < 90; i++) { const a = R() * 6.2832, y = 1.0 - k * 0.09; put(Math.cos(a) * 0.38, y + Math.sin(a) * 0.015, Math.sin(a) * 0.19 - 0.02, 6); }
  for (let i = 0; i < 160; i++) { const a = R() * 6.2832; put(Math.cos(a) * 0.34, -0.28, Math.sin(a) * 0.18, 6); }
  /* floor ring (region 9) */
  while (n < N_MAX) { const a = R() * 6.2832, rr = 0.55 + R() * 0.7; put(Math.cos(a) * rr, -2.12, Math.sin(a) * rr, 9); }
  for (let i = 0; i < N_MAX; i++) {
    const v = [gauss(), gauss(), gauss()], l = Math.hypot(v[0], v[1], v[2]) || 1, k = (2.2 + R() * 4.5) / l;
    dust[i * 3] = v[0] * k * 1.4; dust[i * 3 + 1] = v[1] * k * 0.9; dust[i * 3 + 2] = v[2] * k;
    for (let j = 0; j < 4; j++) seed[i * 4 + j] = R();
  }

  /* shuffle the slots so any prefix of the draw range is a uniform sample of the body (low-end draws fewer) */
  for (let i = N_MAX - 1; i > 0; i--) {
    const q = Math.floor(R() * (i + 1));
    for (let c = 0; c < 3; c++) { let t = pos[i * 3 + c]; pos[i * 3 + c] = pos[q * 3 + c]; pos[q * 3 + c] = t; t = dust[i * 3 + c]; dust[i * 3 + c] = dust[q * 3 + c]; dust[q * 3 + c] = t; }
    for (let c = 0; c < 4; c++) { const t = seed[i * 4 + c]; seed[i * 4 + c] = seed[q * 4 + c]; seed[q * 4 + c] = t; }
    const tr = reg[i]; reg[i] = reg[q]; reg[q] = tr;
  }

  /* ── 2. shaders ── */
  const VS = [
    'attribute vec3 aDust; attribute vec4 aSeed; attribute float aReg;',
    'uniform float uMorph,uTime,uPR,uScan,uBeatR,uBeatAmp,uAlert,uSway,uRep,uSize,uBright; uniform vec3 uHeart,uMouse; uniform float uLit[10]; uniform float uFocus[10];',
    'varying vec3 vC; varying float vA;',
    'vec3 rotY(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z); }',
    'vec3 curl(vec3 p){ vec3 n=vec3(sin(p.y*1.7+uTime*.31)+sin(p.z*2.3-uTime*.17), sin(p.z*1.9+uTime*.26)+sin(p.x*2.1+uTime*.13), sin(p.x*1.6+uTime*.35)+sin(p.y*2.4-uTime*.21)); return vec3(n.y-n.z,n.z-n.x,n.x-n.y)*.5; }',
    'void main(){',
    ' int ri=int(aReg+.5);',
    ' float st=aSeed.w*.45+(1.-clamp((position.y+2.2)/4.,0.,1.))*.4;',                 // feet first
    ' float t=clamp((uMorph-st*.5)/.5,0.,1.); float e=t*t*(3.-2.*t);',
    ' vec3 p=mix(aDust,position,e);',
    ' p+=curl(p*.7+aSeed.xyz*3.)*1.1*sin(3.14159*t);',
    ' p+=curl(p*1.3+aSeed.xyz*5.)*.012;',
    ' if(ri==3) p.y+=.025*sin(uTime*1.1+p.x*2.)*e;',                                   // lungs breathe
    ' float dc=length(p-uHeart); float bw=uBeatAmp*exp(-pow((dc-uBeatR)*4.,2.))*e;',   // heartbeat ripple
    ' p+=normalize(p-uHeart+vec3(1e-4))*bw*.09;',
    ' if(ri==2) p=uHeart+(p-uHeart)*(1.+uBeatAmp*.2*e);',
    ' p=rotY(p,uSway);',
    ' if(uRep>0.){ vec3 dm=p-uMouse; float md=length(dm); p+=normalize(dm+vec3(1e-4))*(1.-smoothstep(0.,uRep,md))*.35*e; }',
    ' vec4 mv=modelViewMatrix*vec4(p,1.);',
    ' vec3 col=vec3(.35,.75,1.); float a=.5; float sz=.8;',
    ' if(ri==1){ col=mix(vec3(.45,.9,1.),vec3(1.,.66,.2),uAlert); a=.95; sz=1.1; }',
    ' else if(ri==2){ col=vec3(1.,.45,.58); a=1.; sz=1.2; }',
    ' else if(ri==3){ col=vec3(.5,.86,1.); a=.8; sz=.95; }',
    ' else if(ri==4){ col=vec3(.4,.7,1.); a=.7; }',
    ' else if(ri==5){ col=vec3(.4,.82,1.); a=.65; }',
    ' else if(ri==6){ col=vec3(.9,.96,1.); a=.85; sz=.9; }',
    ' else if(ri==7){ col=vec3(.98,.84,.5); a=.85; sz=1.; }',
    ' else if(ri==9){ col=vec3(.25,.82,.95); a=.8; }',
    ' float lit=uLit[ri], foc=uFocus[ri];',
    ' float scanB=1.+2.4*exp(-pow((position.y-uScan)/.09,2.));',
    ' a*=(.28+.72*lit)*(1.+foc*1.7)*(1.+bw*5.)*scanB;',
    ' if(ri==1) a*=1.+uAlert*.35*sin(uTime*3.2);',
    ' vC=col; vA=a*(.55+aSeed.z*.45)*smoothstep(0.,.25,e+.15);',
    ' gl_PointSize=clamp((.9+aSeed.z*1.5)*sz*(1.+foc*.5)*uSize*uPR*(8./-mv.z),1.,9.);',
    ' gl_Position=projectionMatrix*mv; }'
  ].join('\n');
  const FS = 'precision mediump float; uniform float uBright; varying vec3 vC; varying float vA;' +
    'void main(){ vec2 d=gl_PointCoord-.5; float r2=dot(d,d)*4.; float a=exp(-r2*6.)+.13*exp(-r2*1.5); gl_FragColor=vec4(vC*a*vA*uBright,a*vA); }';

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDust', new THREE.BufferAttribute(dust, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aReg', new THREE.BufferAttribute(reg, 1));
  const U = {
    uMorph: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 }, uScan: { value: 3 }, uBeatR: { value: 9 }, uBeatAmp: { value: 0 }, uAlert: { value: 0 },
    uSway: { value: 0 }, uRep: { value: 0 }, uSize: { value: 1.5 }, uBright: { value: 1.6 },
    uHeart: { value: new THREE.Vector3(0.10, 0.70, 0.12) }, uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uLit: { value: new Float32Array(10) }, uFocus: { value: new Float32Array(10) }
  };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(points);
  const stars = window.ADX_STARS ? ADX_STARS.create(scene, { tier: (small() || ((navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4))) ? 'low' : 'high' }) : null;; if (stars) stars.setBright(0.5);   // the same sky as the intro, a little brighter (the camera sits nearer, fewer stars in view)
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const drawN = (small() || lowEnd) ? 11000 : N_MAX;
  geo.setDrawRange(0, drawN);                                         // slots are shuffled, so a prefix is a uniform sample

  /* ── 3. size, camera, mouse ── */
  let k = 1;
  function resize() {
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, drawN < N_MAX ? 1.25 : 1.75);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    U.uPR.value = dpr; if (stars) stars.setPR(dpr);
    k = small() ? 1.3 : 1;                                          // the body is tall and narrow, so portrait needs no pull-back
    camera.position.set(0, 0.1, 7.5 * k); camera.lookAt(0, small() ? -0.35 : 0.1, 0);
    camera.updateMatrixWorld();
  }
  let mx = 0, my = 0, mouseSeen = false;
  const repelOn = !small() && window.matchMedia('(pointer: fine)').matches;
  if (repelOn) window.addEventListener('mousemove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; mouseSeen = true; }, { passive: true });
  const rayV = new THREE.Vector3(), mouseW = new THREE.Vector3(), tmp = new THREE.Vector3();

  /* ── 4. progress -> state (pure function of p and time) ── */
  const centers = { 0: 9, 1: 1.58, 2: 0.70, 3: 0.80, 4: 0.15, 5: -1.2, 6: 0.5, 7: 0.05, 8: 0, 9: -9 };
  let stageIdx = -1;
  function apply(p, time) {
    const morph = clamp(p / 0.20, 0, 1);
    const scan = p < 0.20 ? 3 : p > 0.31 ? -3 : 2.3 - (p - 0.20) / 0.11 * 4.6;               // sweeps 2.3 -> -2.3
    if (stars) stars.setTime(time);
    U.uMorph.value = morph; U.uTime.value = time; U.uScan.value = scan;
    const lit = U.uLit.value, foc = U.uFocus.value;
    for (let r = 0; r < 10; r++) lit[r] = r === 0 || r === 9 ? clamp(morph * 1.6 - 0.2, 0, 1) : clamp((centers[r] - scan) / 0.5 + 0.5, 0, 1) * (p > 0.20 ? 1 : 0);
    let cur = -1;
    for (let i = 0; i < STAGES.length; i++) if (p >= T0 + i * STEP) cur = i;
    stageIdx = cur;
    for (let r = 0; r < 10; r++) foc[r] = 0;
    if (cur >= 0 && p < FINAL_AT) foc[STAGES[cur].reg] = 1;
    U.uAlert.value = lit[1];
    U.uSway.value = 0.32 * Math.sin(time * 0.22);
    /* heartbeat: lub, then a softer dub; ripple radius grows from the heart */
    const ph = time % 1, dub = (time + 0.72) % 1;
    U.uBeatR.value = ph * 1.7;
    U.uBeatAmp.value = (Math.max(0, 1 - ph * 1.6) * 0.9 + (dub < 0.33 ? Math.max(0, 1 - dub * 3) * 0.25 : 0)) * morph;
    /* labels: fade in at their stage; phones show only the current one */
    labels.forEach((el, i) => {
      const v = clamp((p - (T0 + i * STEP)) / 0.04, 0, 1);
      const fv = clamp((p - FINAL_AT) / 0.05, 0, 1);                                   // the readiness card takes over: dim the six labels
      el.style.opacity = (small() ? (i === cur && p < FINAL_AT ? v : 0) : v * (1 - 0.7 * fv)).toFixed(3);
      el.classList.toggle('is-current', i === cur && p < FINAL_AT);
      el.style.translate = '0 ' + ((1 - v) * 16).toFixed(1) + 'px';
    });
    if (final) {
      const v = clamp((p - FINAL_AT) / 0.05, 0, 1);
      final.style.opacity = v.toFixed(3); final.style.translate = '0 ' + ((1 - v) * 16).toFixed(1) + 'px';
      if (readyEl) readyEl.textContent = Math.round(READY * clamp((p - FINAL_AT) / 0.1, 0, 1));
    }
    return cur;
  }

  /* leader lines: from each label's inner edge to its organ's projected screen position */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const lines = labels.map(() => { const l = document.createElementNS(SVGNS, 'polyline'); l.setAttribute('class', 'tw-line'); linesSvg.appendChild(l); return l; });
  const dots = labels.map(() => { const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', 3.2); c.setAttribute('class', 'tw-dot'); linesSvg.appendChild(c); return c; });
  function drawLines(p, time) {
    const box = root.getBoundingClientRect(), W = box.width, H = box.height;
    const sway = U.uSway.value, c = Math.cos(sway), s = Math.sin(sway);
    labels.forEach((el, i) => {
      const v = parseFloat(el.style.opacity) || 0, ln = lines[i], dt = dots[i];
      if (small() || v < 0.02) { ln.style.opacity = 0; dt.style.opacity = 0; return; }
      const a = STAGES[i].at;
      tmp.set(c * a[0] + s * a[2], a[1], -s * a[0] + c * a[2]).project(camera);
      const ax = (tmp.x * 0.5 + 0.5) * W, ay = (-tmp.y * 0.5 + 0.5) * H;
      const r = el.getBoundingClientRect(), left = el.dataset.side === 'left';
      const sx = (left ? r.right : r.left) - box.left + (left ? 10 : -10), sy = r.top - box.top + 18;
      ln.setAttribute('points', sx + ',' + sy + ' ' + (sx + (ax - sx) * 0.45) + ',' + ay + ' ' + ax + ',' + ay);
      dt.setAttribute('cx', ax); dt.setAttribute('cy', ay);
      ln.style.opacity = (v * 0.9).toFixed(2); dt.style.opacity = v.toFixed(2);
      ln.classList.toggle('is-act', el.dataset.state === 'act'); dt.classList.toggle('is-act', el.dataset.state === 'act');
    });
  }

  let P = 0, onScreen = false, running = false;
  function render(time) {
    apply(P, time);
    if (repelOn && mouseSeen) {
      rayV.set(mx * 2, -my * 2, 0.5).unproject(camera).sub(camera.position).normalize();
      mouseW.copy(camera.position).addScaledVector(rayV, -camera.position.z / rayV.z);
      U.uMouse.value.copy(mouseW); U.uRep.value = 0.55;
    } else U.uRep.value = 0;
    renderer.render(scene, camera);
    drawLines(P, time);
  }
  function frame(now) { if (!onScreen || document.hidden) { running = false; return; } requestAnimationFrame(frame); render(now * 0.001); }
  function start() { if (!running && onScreen && !document.hidden) { running = true; requestAnimationFrame(frame); } }
  function once() { render(2.4); }

  new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) start(); }, { rootMargin: '80px 0px' }).observe(root);
  document.addEventListener('visibilitychange', start);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; });
  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { resize(); if (!running) once(); }, 120); }, { passive: true });

  root.classList.add('is-particle');
  resize();
  const st = ScrollTrigger.create({
    trigger: root, start: 'top top', end: '+=' + (small() ? 420 : 480) + '%',
    pin: true, pinSpacing: true, anticipatePin: 1, scrub: 0.8, refreshPriority: 0,
    onUpdate: self => { P = self.progress; if (!running) once(); }
  });
  once();
  ScrollTrigger.sort();
  requestAnimationFrame(() => ScrollTrigger.refresh());
  start();

  window.ADX_TWIN = { yAt: p => st.start + (st.end - st.start) * clamp(p, 0, 1), stages: STAGES.length };
});
