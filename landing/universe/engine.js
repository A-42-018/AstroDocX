/* ============================================================
   ASTRODOCX — the one particle system of the landing page
   One THREE.Points system, one draw call, 24k particles for the
   whole page. Eight target shapes live on the GPU as vertex
   attributes aP0..aP7; the vertex shader mixes shape a -> b from
   uniforms (uSeg, uSegB, uT), so a particle's position is a pure
   function of scroll: fast scrolling, reversing and jumping can
   never break it.

     0 dust  1 planet  2 astronaut  3 Orion  4 relay  5 Earth   (intro)
     6 body  (Health Twin: regions in aReg light up per system)
     7 ASTRODOCX wordmark  (the reveal)

   The same particles are born as stardust and end as the wordmark.
   Astronaut, Orion, TDRS and Earth load baked NASA-model bins.
============================================================ */
(function () {
  'use strict';

  const N_MAX = 24000;
  const TIER_N = { high: 24000, mid: 14000, low: 8000 };

  /* per-shape placement / look. off = world offset (keeps the form clear of the text side),
     sc = scale, rot = idle spin (rad/s), tint = colour multiplier, dis = dissolve strength of the morph INTO this shape */
  const SHAPES = [
    { id: 'dust',      sc: 4.2, off: [0, 0, 0],       rot: 0.02, tint: [1, 1, 1],          dis: 0.0 },
    { id: 'planet',    sc: 2.5, off: [2.6, 0, 0],     rot: 0.10, tint: [1.0, 0.86, 0.62],  dis: 1.6 },
    { id: 'astronaut', sc: 2.1, off: [-2.5, 0.4, 0],    rot: 0.12, tint: [1, 1, 1],          dis: 1.6 },
    { id: 'orion',     sc: 2.7, off: [2.0, 0.2, 0],     rot: 0.0, tint: [0.95, 0.97, 1.0],  dis: 1.6 },
    { id: 'relay',     sc: 2.0, off: [-2.0, -0.2, 0],    rot: 0.02, tint: [1, 1, 1],          dis: 1.6 },
    { id: 'earth',     sc: 2.5, off: [0, -1.7, 0],    rot: 0.08, tint: [0.62, 0.82, 1.15], dis: 1.6 }
  ];

  /* ── deterministic PRNG so every load builds the same shapes ── */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2831853 * r()); }
  function noise3(x, y, z) {                                  // cheap smooth-ish value noise, enough for land / craters
    return (Math.sin(x * 1.7 + Math.sin(y * 2.3) + z) + Math.sin(y * 1.9 + Math.sin(z * 2.1) + x * .7) + Math.sin(z * 2.2 + Math.sin(x * 1.3) + y * .9)) / 3;
  }
  function fib(i, n) {                                        // Fibonacci sphere point i of n
    const y = 1 - (i + 0.5) / n * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963229728653;
    return [Math.cos(th) * rr, y, Math.sin(th) * rr];
  }

  /* ── Morton (Z-order) sort: particle i lands in the same region of every shape -> clean morphs ── */
  function spread(v) { v &= 0x3ff; v = (v | (v << 16)) & 0x030000ff; v = (v | (v << 8)) & 0x0300f00f; v = (v | (v << 4)) & 0x030c30c3; return (v | (v << 2)) & 0x09249249; }
  function mortonSort(a, n, extra) {
    let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = a[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
    const keys = new Float64Array(n), idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const q = [0, 1, 2].map(k => Math.min(1023, Math.max(0, Math.floor((a[i * 3 + k] - min[k]) / ((max[k] - min[k]) || 1) * 1023))));
      keys[i] = spread(q[0]) + spread(q[1]) * 2 + spread(q[2]) * 4; idx[i] = i;
    }
    const order = Array.from(idx).sort((x, y) => keys[x] - keys[y]);
    const out = new Float32Array(n * 3);
    order.forEach((o, i) => { out[i * 3] = a[o * 3]; out[i * 3 + 1] = a[o * 3 + 1]; out[i * 3 + 2] = a[o * 3 + 2]; });
    if (extra) { const ex = extra.slice(); order.forEach((o, i) => { extra[i] = ex[o]; }); }   // a per-point value (body region) follows its point
    return out;
  }

  /* ── procedural shape generators: n points, extent about [-1, 1] ── */
  function genDust(n, r) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {                              // thick shell, denser toward the middle
      const v = [gauss(r), gauss(r), gauss(r)], l = Math.hypot(v[0], v[1], v[2]) || 1, k = (0.35 + Math.pow(r(), 0.7) * 0.65) / l * 1.15;
      a[i * 3] = v[0] * k * 1.25; a[i * 3 + 1] = v[1] * k * 0.8; a[i * 3 + 2] = v[2] * k;
    }
    return a;
  }
  function genPlanet(n, r) {
    const a = new Float32Array(n * 3), ringN = Math.floor(n * 0.08), tilt = 0.42;
    for (let i = 0; i < n - ringN; i++) {
      const p = fib(i, n - ringN), h = 1 + noise3(p[0] * 5, p[1] * 5, p[2] * 5) * 0.035;
      a[i * 3] = p[0] * h * 0.72; a[i * 3 + 1] = p[1] * h * 0.72; a[i * 3 + 2] = p[2] * h * 0.72;
    }
    for (let j = 0; j < ringN; j++) {                          // orbit ring, tilted
      const i = n - ringN + j, th = r() * 6.2832, rad = 0.95 + r() * 0.22, x = Math.cos(th) * rad, z = Math.sin(th) * rad, y = (r() - .5) * 0.015;
      a[i * 3] = x; a[i * 3 + 1] = y * Math.cos(tilt) + z * Math.sin(tilt) * 0.35; a[i * 3 + 2] = z * Math.cos(tilt) - y * Math.sin(tilt);
    }
    return a;
  }
  function ellipsoids(n, r, parts) {                           // surface points on a list of ellipsoids [cx,cy,cz,rx,ry,rz,weight]
    const a = new Float32Array(n * 3), tot = parts.reduce((s, p) => s + p[6], 0);
    for (let i = 0; i < n; i++) {
      let w = r() * tot, p = parts[0];
      for (let k = 0; k < parts.length; k++) { w -= parts[k][6]; if (w <= 0) { p = parts[k]; break; } }
      const v = [gauss(r), gauss(r), gauss(r)], l = Math.hypot(v[0], v[1], v[2]) || 1;
      a[i * 3] = p[0] + v[0] / l * p[3]; a[i * 3 + 1] = p[1] + v[1] / l * p[4]; a[i * 3 + 2] = p[2] + v[2] / l * p[5];
    }
    return a;
  }
  function genAstronaut(n, r) {
    return ellipsoids(n, r, [
      [0, 0.80, 0.02, 0.26, 0.28, 0.27, 5],      // helmet
      [0, 0.82, 0.20, 0.15, 0.13, 0.08, 1.2],    // visor
      [0, 0.26, 0, 0.36, 0.50, 0.24, 8],         // torso
      [0, 0.30, -0.28, 0.30, 0.40, 0.14, 4],     // life-support pack
      [-0.52, 0.28, 0.06, 0.12, 0.42, 0.12, 3],  // left arm
      [0.52, 0.28, 0.06, 0.12, 0.42, 0.12, 3],   // right arm
      [-0.17, -0.58, 0, 0.14, 0.50, 0.14, 3.5],  // left leg
      [0.17, -0.58, 0, 0.14, 0.50, 0.14, 3.5]    // right leg
    ]);
  }
  function rect(a, i, r, c, u, v) {                            // point on a parallelogram centre c, half-axes u, v
    const s = r() * 2 - 1, t = r() * 2 - 1;
    a[i * 3] = c[0] + u[0] * s + v[0] * t; a[i * 3 + 1] = c[1] + u[1] * s + v[1] * t; a[i * 3 + 2] = c[2] + u[2] * s + v[2] * t;
  }
  function genOrion(n, r) {                                    // crew module cone + service module cylinder + 4 solar wings, axis along +x
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const w = r();
      if (w < 0.26) {                                          // cone
        const x = r(), rad = 0.42 * (1 - x) + 0.13 * x, th = r() * 6.2832;
        a[i * 3] = 0.15 + x * 0.55; a[i * 3 + 1] = Math.cos(th) * rad; a[i * 3 + 2] = Math.sin(th) * rad;
      } else if (w < 0.48) {                                   // service module
        const x = r(), th = r() * 6.2832;
        a[i * 3] = -0.55 + x * 0.70; a[i * 3 + 1] = Math.cos(th) * 0.42; a[i * 3 + 2] = Math.sin(th) * 0.42;
      } else if (w < 0.54) {                                   // engine bell
        const x = r(), th = r() * 6.2832, rad = 0.12 + x * 0.16;
        a[i * 3] = -0.55 - x * 0.28; a[i * 3 + 1] = Math.cos(th) * rad; a[i * 3 + 2] = Math.sin(th) * rad;
      } else {                                                 // 4 wings, 2 panels each side of the module
        const side = (i & 1) ? 1 : -1, up = (i & 2) ? 1 : 0;
        rect(a, i, r, up ? [-0.28, 0, side * 0.82] : [-0.28, side * 0.82, 0], [0.16, 0, 0], up ? [0, 0, side * 0.34] : [0, side * 0.34, 0]);
      }
    }
    return a;
  }
  function genRelay(n, r) {                                    // TDRS-like: bus box, two big panels, dish
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const w = r();
      if (w < 0.18) {                                          // bus
        const f = Math.floor(r() * 6), u = r() * 2 - 1, v = r() * 2 - 1, ax = f >> 1, sg = (f & 1) ? 1 : -1, d = [.2, .2, .2];
        const p = [0, 0, 0]; p[ax] = sg * d[ax]; p[(ax + 1) % 3] = u * d[(ax + 1) % 3]; p[(ax + 2) % 3] = v * d[(ax + 2) % 3];
        a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2];
      } else if (w < 0.80) {                                   // panels (denser sampling so they read as panels)
        const side = (i & 1) ? 1 : -1, s = r() * 2 - 1, t = r() * 2 - 1;
        a[i * 3] = side * (0.34 + (s * .5 + .5) * 0.62); a[i * 3 + 1] = t * 0.3; a[i * 3 + 2] = (r() - .5) * 0.01;
      } else if (w < 0.92) {                                   // dish
        const th = r() * 6.2832, rr = Math.sqrt(r()) * 0.34;
        a[i * 3] = Math.cos(th) * rr; a[i * 3 + 1] = 0.25 + rr * rr * 1.2; a[i * 3 + 2] = Math.sin(th) * rr + 0.2;
      } else {                                                 // boom
        const t = r(); a[i * 3] = 0; a[i * 3 + 1] = 0.2 + t * 0.15; a[i * 3 + 2] = 0.1 + t * 0.1;
      }
    }
    return a;
  }
  function genEarth(n, r) {
    const a = new Float32Array(n * 3), cloudN = Math.floor(n * 0.04);
    let k = 0, guard = 0;
    while (k < n - cloudN && guard++ < n * 8) {
      const p = fib(Math.floor(r() * 200000), 200000), land = noise3(p[0] * 2.6 + 1, p[1] * 2.6, p[2] * 2.6) + noise3(p[0] * 6, p[1] * 6, p[2] * 6) * 0.25 > 0.12;
      if (land || r() < 0.22) { a[k * 3] = p[0] * 0.8; a[k * 3 + 1] = p[1] * 0.8; a[k * 3 + 2] = p[2] * 0.8; k++; }
    }
    for (; k < n; k++) { const p = fib(Math.floor(r() * 5000), 5000); a[k * 3] = p[0] * 0.85; a[k * 3 + 1] = p[1] * 0.85; a[k * 3 + 2] = p[2] * 0.85; }
    return a;
  }
  function genWordmark(n, r, fam) {                            // "ASTRODOCX" drawn to a canvas, lit pixels sampled 
    const W = 1400, H = 260, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 190px ' + fam; if (c.letterSpacing !== undefined) c.letterSpacing = '14px';
    c.fillText('ASTRODOCX', W / 2, H / 2 + 8);
    const d = c.getImageData(0, 0, W, H).data, px = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4] > 128) px.push(x, y);
    const a = new Float32Array(n * 3), m = px.length / 2;
    for (let i = 0; i < n; i++) {
      const q = Math.floor(r() * m) * 2;
      a[i * 3] = (px[q] + r() * 2 - W / 2) / (W / 2) * 1.55;               // x in about [-1.55, 1.55] at scale 1
      a[i * 3 + 1] = -(px[q + 1] + r() * 2 - H / 2) / (W / 2) * 1.55;
      a[i * 3 + 2] = (r() - .5) * 0.12;
    }
    return a;
  }
  /* Health Twin body: skin shell, organs, skeleton, a transmitter on the right forearm and a floor ring.
     Extent about y -2.1..1.9 at scale 1. reg (per point): 0 skin, 1 brain, 2 heart, 3 lungs, 4 gut,
     5 legs, 6 skeleton, 7 forearm transmitter, 9 floor ring. Counts are tuned for 18k and scaled to n. */
  function genBody(n, r) {
    const a = new Float32Array(n * 3), reg = new Float32Array(n), f = n / 18000;
    let k = 0;
    const put = (x, y, z, g) => { if (k >= n) return; a[k * 3] = x; a[k * 3 + 1] = y; a[k * 3 + 2] = z; reg[k] = g; k++; };
    function ell(cnt, c, rd, g, vol) {
      cnt = Math.round(cnt * f);
      for (let i = 0; i < cnt; i++) {
        const v = [gauss(r), gauss(r), gauss(r)], l = Math.hypot(v[0], v[1], v[2]) || 1, q = vol ? Math.cbrt(r()) / l : 1 / l;
        put(c[0] + v[0] * q * rd[0], c[1] + v[1] * q * rd[1], c[2] + v[2] * q * rd[2], g);
      }
    }
    ell(900, [0, 1.55, 0], [0.30, 0.36, 0.30], 0);
    ell(220, [0, 1.15, 0], [0.12, 0.16, 0.12], 0);
    ell(1700, [0, 0.55, 0], [0.50, 0.76, 0.27], 0);
    ell(700, [0, -0.25, 0], [0.42, 0.30, 0.25], 0);
    ell(500, [-0.66, 0.75, 0], [0.13, 0.42, 0.13], 0);   ell(500, [0.66, 0.75, 0], [0.13, 0.42, 0.13], 0);
    ell(450, [-0.78, 0.05, 0.05], [0.11, 0.42, 0.11], 0);
    ell(520, [0.78, 0.05, 0.05], [0.11, 0.42, 0.11], 7);
    ell(1100, [-0.2, -0.85, 0], [0.17, 0.55, 0.17], 5);  ell(1100, [0.2, -0.85, 0], [0.17, 0.55, 0.17], 5);
    ell(950, [-0.2, -1.55, 0], [0.13, 0.50, 0.13], 5);   ell(950, [0.2, -1.55, 0], [0.13, 0.50, 0.13], 5);
    ell(1300, [0, 1.58, 0.02], [0.20, 0.19, 0.18], 1, true);                                   // brain
    ell(1100, [0.10, 0.70, 0.12], [0.12, 0.14, 0.10], 2, true);                                // heart
    ell(1150, [-0.24, 0.80, 0.05], [0.16, 0.30, 0.14], 3, true); ell(1150, [0.26, 0.80, 0.05], [0.16, 0.30, 0.14], 3, true);
    ell(1200, [0, 0.15, 0.08], [0.26, 0.24, 0.14], 4, true);                                   // gut
    for (let i = 0, m = Math.round(520 * f); i < m; i++) put((r() - .5) * 0.04, 1.3 - r() * 1.65, -0.12 + (r() - .5) * 0.04, 6);    // spine
    for (let j = 0; j < 7; j++) for (let i = 0, m = Math.round(90 * f); i < m; i++) { const t = r() * 6.2832, y = 1.0 - j * 0.09; put(Math.cos(t) * 0.38, y + Math.sin(t) * 0.015, Math.sin(t) * 0.19 - 0.02, 6); }
    for (let i = 0, m = Math.round(160 * f); i < m; i++) { const t = r() * 6.2832; put(Math.cos(t) * 0.34, -0.28, Math.sin(t) * 0.18, 6); }
    while (k < n) { const t = r() * 6.2832, rr = 0.55 + r() * 0.7; put(Math.cos(t) * rr, -2.12, Math.sin(t) * rr, 9); }
    return { pos: a, reg: reg };
  }

  /* body and wordmark sit after the six intro shapes; sway = idle turn (rad) instead of a spin */
  const BODY = { id: 'body', sc: 1, off: [0, 0, 0], rot: 0, sway: 0.32, tint: [1, 1, 1], dis: 1.3 };
  const WORD = { id: 'wordmark', sc: 3.2, off: [0, 0, 0], rot: 0, tint: [1, 1, 1], dis: 2.4 };
  const ALL = SHAPES.concat([BODY, WORD]);
  const HEART = [0.10, 0.70, 0.12], CHEST = [-2.5, 0.95, 0];
  const angle = (S, time) => S.sway ? S.sway * Math.sin(time * 0.22) : time * S.rot;

  /* ── shaders ── */
  const VS = [
    'attribute vec3 aP0,aP1,aP2,aP3,aP4,aP5,aP6,aP7; attribute vec4 aSeed; attribute float aReg;',
    'uniform float uSeg,uSegB,uT,uTime,uPR,uDis,uScA,uScB,uAngA,uAngB,uSize;',
    'uniform vec3 uOffA,uOffB,uTintA,uTintB,uChest,uMouse,uPlanetC,uLight;',
    'uniform float uBeatR,uBeatAmp,uWAstro,uWPlanet,uRep,uBodyA,uBodyB,uScan,uAlert;',
    'uniform float uLit[10]; uniform float uFocus[10];',
    'varying vec3 vC; varying float vA;',
    'vec3 pick(float i){ if(i<.5) return aP0; if(i<1.5) return aP1; if(i<2.5) return aP2; if(i<3.5) return aP3; if(i<4.5) return aP4; if(i<5.5) return aP5; if(i<6.5) return aP6; return aP7; }',
    'vec3 rotY(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z); }',
    'vec3 curl(vec3 p){ vec3 n=vec3(sin(p.y*1.7+uTime*.31)+sin(p.z*2.3-uTime*.17), sin(p.z*1.9+uTime*.26)+sin(p.x*2.1+uTime*.13), sin(p.x*1.6+uTime*.35)+sin(p.y*2.4-uTime*.21)); return vec3(n.y-n.z,n.z-n.x,n.x-n.y)*.5; }',
    'void main(){',
    ' vec3 pa=pick(uSeg), pb=pick(uSegB);',
    ' vec3 a=rotY(pa*uScA,uAngA)+uOffA, b=rotY(pb*uScB,uAngB)+uOffB;',
    ' float st=aSeed.w*.55+clamp(pa.y*.5+.5,0.,1.)*.30;',                          // stagger: random + height
    ' float t=clamp((uT-st*.4)/.6,0.,1.); float e=t*t*(3.-2.*t);',
    ' float wb=uBodyA*(1.-e)+uBodyB*e; int ri=int(aReg+.5);',                       // wb: how much this particle is "body" right now
    ' vec3 pos=mix(a,b,e);',
    ' pos+=curl(pos*.7+aSeed.xyz*3.)*uDis*sin(3.14159*t);',                         // dissolve peaks mid-morph
    ' pos+=curl(pos*1.3+aSeed.xyz*5.)*mix(.025,.012,wb);',                          // idle breathing
    ' if(ri==3) pos.y+=.025*sin(uTime*1.1+pos.x*2.)*wb;',                           // lungs breathe
    ' float dc=length(pos-uChest); float bw=uBeatAmp*max(uWAstro,wb)*exp(-pow((dc-uBeatR)*mix(3.5,4.,wb),2.));',   // heartbeat ripple from the chest / heart
    ' pos+=normalize(pos-uChest+vec3(1e-4))*bw*mix(.16,.09,wb);',
    ' if(ri==2) pos=uChest+(pos-uChest)*(1.+uBeatAmp*.2*wb);',                      // the heart itself pumps
    ' if(uRep>0.){ vec3 dm=pos-uMouse; float md=length(dm); pos+=normalize(dm+vec3(1e-4))*(1.-smoothstep(0.,uRep,md))*.5; }',   // mouse repel (desktop)
    ' vec4 mv=modelViewMatrix*vec4(pos,1.);',
    /* star look (intro shapes, wordmark) */
    ' vec3 base=aSeed.y<.70?vec3(.92,.95,1.):(aSeed.y<.90?vec3(.50,.66,1.):vec3(.96,.79,.48));',
    ' vec3 cI=base*mix(uTintA,uTintB,e);',
    ' float aI=(.55+aSeed.z*.45)*(1.+sin(3.14159*t)*.35)*(1.+bw*5.);',
    ' float lit=smoothstep(-.25,.65,dot(normalize(pos-uPlanetC),uLight)); aI*=mix(1.,.3+1.0*lit,uWPlanet);',   // planet terminator
    /* body look: colour per region, the scan line and the focused system glow */
    ' vec3 col=vec3(.35,.75,1.); float ab=.5; float sz=.8;',
    ' if(ri==1){ col=mix(vec3(.45,.9,1.),vec3(1.,.66,.2),uAlert); ab=.95; sz=1.1; }',
    ' else if(ri==2){ col=vec3(1.,.45,.58); ab=1.; sz=1.2; }',
    ' else if(ri==3){ col=vec3(.5,.86,1.); ab=.8; sz=.95; }',
    ' else if(ri==4){ col=vec3(.4,.7,1.); ab=.7; }',
    ' else if(ri==5){ col=vec3(.4,.82,1.); ab=.65; }',
    ' else if(ri==6){ col=vec3(.9,.96,1.); ab=.85; sz=.9; }',
    ' else if(ri==7){ col=vec3(.98,.84,.5); ab=.85; sz=1.; }',
    ' else if(ri==9){ col=vec3(.25,.82,.95); ab=.8; }',
    ' float by=uBodyA>.5?pa.y:pb.y, li=uLit[ri], fo=uFocus[ri];',
    ' ab*=(.28+.72*li)*(1.+fo*1.7)*(1.+bw*5.)*(1.+2.4*exp(-pow((by-uScan)/.09,2.)));',
    ' if(ri==1) ab*=1.+uAlert*.35*sin(uTime*3.2);',
    ' ab*=(.55+aSeed.z*.45)*.78;',
    ' vC=mix(cI,col,wb); vA=mix(aI,ab,wb);',
    ' gl_PointSize=clamp((.9+aSeed.z*1.7)*mix(1.,sz*(1.+fo*.5)*.72,wb)*uSize*uPR*(9./-mv.z),1.,10.);',
    ' gl_Position=projectionMatrix*mv; }'
  ].join('\n');
  const FS = [
    'precision mediump float; uniform float uBright; varying vec3 vC; varying float vA;',
    'void main(){ vec2 d=gl_PointCoord-.5; float r2=dot(d,d)*4.;',
    ' float a=exp(-r2*6.)+.12*exp(-r2*1.5);',                                        // soft gaussian core + faint halo
    ' gl_FragColor=vec4(vC*a*vA*uBright,a*vA); }'
  ].join('\n');

  /* ── public: create(scene, {tier, family}) -> engine ── */
  function create(scene, opts) {
    const tier = (opts && opts.tier) || 'high';
    const r = rng(20261008), n = N_MAX;
    const gens = [genDust, genPlanet, genAstronaut, genOrion, genRelay, genEarth];
    const shapes = gens.map(g => mortonSort(g(n, r), n));
    const body = genBody(n, rng(20261009)), bodyReg = body.reg;
    shapes.push(mortonSort(body.pos, n, bodyReg));
    const wordOf = fam => mortonSort(genWordmark(n, rng(99), fam), n);
    shapes.push(wordOf((opts && opts.family) || 'Pulchella, sans-serif'));

    /* Slot j holds sorted particle perm[j] (seeded shuffle). The Morton order is kept per shape, and any prefix
       of the slots is a uniform subsample of every shape, so drawRange(0, k) lowers the tier without rebuilding. */
    const count = n, perm = new Uint32Array(n), rp = rng(4242);
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rp() * (i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    const geo = new THREE.BufferGeometry(), attrs = [];
    function fill(arr, src) { for (let i = 0; i < count; i++) { const o = perm[i] * 3; arr[i * 3] = src[o]; arr[i * 3 + 1] = src[o + 1]; arr[i * 3 + 2] = src[o + 2]; } }
    for (let s = 0; s < 8; s++) {
      const arr = new Float32Array(count * 3); fill(arr, shapes[s]);
      const at = new THREE.BufferAttribute(arr, 3); geo.setAttribute('aP' + s, at); attrs.push(at);
    }
    const reg = new Float32Array(count);
    for (let i = 0; i < count; i++) reg[i] = bodyReg[perm[i]];
    geo.setAttribute('aReg', new THREE.BufferAttribute(reg, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));   // required by three; unused
    const seed = new Float32Array(count * 4), rs = rng(7);
    for (let i = 0; i < count * 4; i++) seed[i] = rs();
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));

    const U = {
      uSeg: { value: 0 }, uSegB: { value: 1 }, uT: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 }, uDis: { value: 0 }, uSize: { value: 1.9 }, uBright: { value: 1.7 },
      uScA: { value: 1 }, uScB: { value: 1 }, uAngA: { value: 0 }, uAngB: { value: 0 },
      uOffA: { value: new THREE.Vector3() }, uOffB: { value: new THREE.Vector3() },
      uChest: { value: new THREE.Vector3(CHEST[0], CHEST[1], CHEST[2]) }, uMouse: { value: new THREE.Vector3(99, 99, 0) }, uRep: { value: 0 },
      uPlanetC: { value: new THREE.Vector3(2.6, 0, 0) }, uLight: { value: new THREE.Vector3(-0.7, 0.4, 0.6).normalize() },
      uBeatR: { value: 9 }, uBeatAmp: { value: 0 }, uWAstro: { value: 0 }, uWPlanet: { value: 0 },
      uBodyA: { value: 0 }, uBodyB: { value: 0 }, uScan: { value: 9 }, uAlert: { value: 0 },
      uLit: { value: new Float32Array(10) }, uFocus: { value: new Float32Array(10) },
      uTintA: { value: new THREE.Vector3(1, 1, 1) }, uTintB: { value: new THREE.Vector3(1, 1, 1) }
    };
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    /* baked targets (tools/bake-particles.mjs): Int16 x,y,z, 24k points, Morton-sorted. A missing or
       malformed bin is ignored and the procedural stand-in stays, so the page never breaks. */
    const BAKED = { 2: 'astronaut', 3: 'orion', 4: 'relay', 5: 'earth' };
    Object.keys(BAKED).forEach(function (k) {
      fetch('universe/targets/' + BAKED[k] + '.bin').then(function (res) { return res.ok ? res.arrayBuffer() : Promise.reject(); }).then(function (buf) {
        if (buf.byteLength !== n * 6) return;                                          // wrong point count: keep the fallback
        const src = new Int16Array(buf), arr = attrs[k].array;
        for (let i = 0; i < count; i++) { const o = perm[i] * 3; arr[i * 3] = src[o] / 32767; arr[i * 3 + 1] = src[o + 1] / 32767; arr[i * 3 + 2] = src[o + 2] / 32767; }
        attrs[k].needsUpdate = true;
        if (api.onChange) api.onChange();
      }).catch(function () {});
    });

    /* intro morph windows from the scene config: into scene i = [end of hold i-1, start of hold i] */
    const S = window.ADX_SCENES;
    function windowInto(i) { return [S[i - 1].hold[1], S[i].hold[0]]; }
    function locate(p) {
      for (let i = S.length - 1; i >= 1; i--) {
        const w = windowInto(i);
        if (p > w[0]) return { seg: i - 1, t: Math.min(1, (p - w[0]) / Math.max(1e-4, w[1] - w[0])) };
      }
      return { seg: 0, t: 0 };
    }

    const heartW = new THREE.Vector3();
    const api = {
      points: points, uniforms: U, count: count, onChange: null, weights: [0, 0, 0, 0, 0, 0, 0, 0], drawn: n,
      BODY: 6, WORD: 7,
      /* lower / raise the particle count without rebuilding; dimmer-per-point is compensated a little */
      setTier: function (t) {
        const k = Math.min(TIER_N[t] || n, n);
        geo.setDrawRange(0, k);
        U.uBright.value = 1.7 * Math.pow(n / k, 0.3); U.uSize.value = 1.9 * Math.pow(n / k, 0.15);
        api.drawn = k;
      },
      /* morph shape a -> b by t (0..1). overA / overB override a shape's scale / offset (the wordmark rises and shrinks) */
      set: function (a, b, t, time, overA, overB) {
        const A = overA ? Object.assign({}, ALL[a], overA) : ALL[a], B = overB ? Object.assign({}, ALL[b], overB) : ALL[b];
        U.uSeg.value = a; U.uSegB.value = b; U.uT.value = t; U.uTime.value = time;
        U.uScA.value = A.sc; U.uScB.value = B.sc; U.uAngA.value = angle(A, time); U.uAngB.value = angle(B, time);
        U.uOffA.value.set(A.off[0], A.off[1], A.off[2]); U.uOffB.value.set(B.off[0], B.off[1], B.off[2]);
        U.uTintA.value.set(A.tint[0], A.tint[1], A.tint[2]); U.uTintB.value.set(B.tint[0], B.tint[1], B.tint[2]);
        U.uDis.value = a === b ? 0 : B.dis;
        /* shape weights 0..1 (how much of each shape is on screen), shared with fx.js */
        const e = t * t * (3 - 2 * t), w = api.weights;
        for (let k = 0; k < 8; k++) w[k] = (k === a ? 1 - e : 0) + (k === b ? e : 0);
        U.uWAstro.value = w[2]; U.uWPlanet.value = w[1];
        U.uBodyA.value = a === 6 ? 1 : 0; U.uBodyB.value = b === 6 ? 1 : 0;
        /* heartbeat: one pulse a second (lub, then a softer dub), ripple radius grows from the chest / heart */
        const ph = time % 1, dub = (time + 0.72) % 1, isBody = a === 6 || b === 6;
        if (isBody) { const g = angle(BODY, time), c = Math.cos(g), s = Math.sin(g); U.uChest.value.copy(heartW.set(c * HEART[0] + s * HEART[2], HEART[1], -s * HEART[0] + c * HEART[2])); }
        else U.uChest.value.set(CHEST[0], CHEST[1], CHEST[2]);
        U.uBeatR.value = ph * (isBody ? 1.7 : 2.4);
        U.uBeatAmp.value = Math.max(0, 1 - ph * 1.6) * 0.9 + Math.max(0, 1 - dub * 3) * 0.25 * (dub < 0.33 ? 1 : 0);
      },
      /* the intro: p (0..1) -> intro shape pair + t, a pure function of p */
      setProgress: function (p, time) { const L = locate(p); api.set(L.seg, L.seg + 1, L.t, time); },
      /* body turn at `time` (the Health Twin leader lines follow it) */
      bodyAngle: time => angle(BODY, time),
      /* the wordmark is sampled from a canvas: redraw it once the display font has loaded */
      setWordFont: function (fam) { fill(attrs[7].array, wordOf(fam)); attrs[7].needsUpdate = true; if (api.onChange) api.onChange(); },
      dispose: function () { scene.remove(points); geo.dispose(); mat.dispose(); }
    };
    api.setTier(tier);
    return api;
  }

  window.ADX_ENGINE = { create: create, SHAPES: ALL };
})();
