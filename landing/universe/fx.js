/* ============================================================
   ASTRODOCX — UNIVERSE INTRO · P3 scene effects (plan §12.2)
   Extra small Points systems, each driven only by (progress, time)
   and the engine's scene weights, so they are as reversible as the
   morph itself.
     03  ECG line made of particles across the lunar foreground
     04  engine trail streaming back from the Orion engine
     05  small far Earth + data packets (satellite -> Earth along an arc)
     01  singularity: hairline streaks / beams / curly trails, the black
         event horizon behind the headline, rim glow, collapse flash
   (heartbeat ripple, mouse repel and planet shading live in engine.js)
============================================================ */
(function () {
  'use strict';
  const CYAN = [0.13, 0.83, 0.93];

  const VS =
    'attribute vec4 aSeed; attribute float aT; uniform float uTime,uPR,uW,uKind,uHead; uniform vec3 uA,uB,uC; varying float vA; varying vec3 vC;' +
    'void main(){ vec3 p=position; float a=1.;' +
    ' if(uKind<.5){ p=position; float d=uHead-aT; a=(d>0.&&d<.9)?pow(1.-d/.9,1.3):.0; a+=.08; }' +                         // ECG: bright head, fading tail
    ' else if(uKind<1.5){ float life=fract(uTime*.55+aSeed.x); p=vec3(uA.x-life*3.2*(.6+aSeed.y*.8), uA.y, uA.z);' +       // engine trail: streams back (-x), spreads
    '   float sp=.05+life*.34; p.y+=(aSeed.z-.5)*sp*2.; p.z+=(aSeed.w-.5)*sp*2.; a=(1.-life)*(1.-life); }' +
    ' else if(uKind<2.5){ float tt=fract(uTime*.28+aSeed.x*.22+aT); vec3 m=(uA+uB)*.5+vec3(0.,1.7,0.);' +                    // packets: quadratic arc A -> C(m) -> B
    '   p=(1.-tt)*(1.-tt)*uA+2.*(1.-tt)*tt*m+tt*tt*uB; p+=(aSeed.yzw-.5)*.09; a=sin(3.14159*tt); }' +
    ' else { p=position; a=.55; }' +                                                                                       // far Earth
    ' vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=clamp((.9+aSeed.y*1.6)*uPR*(9./-mv.z)*(uKind>1.5&&uKind<2.5||uKind<.5?2.4:1.7),1.,12.);' +
    ' vA=a*uW; vC=vec3(' + CYAN.join(',') + '); if(uKind>=1.5&&uKind<2.5) vC=mix(vC,vec3(.9,1.,1.),.5); if(uKind>2.5) vC=vec3(.45,.65,1.);' +
    ' if(uKind>.5&&uKind<1.5) vC=vec3(.75,.88,1.);' +
    ' gl_Position=projectionMatrix*mv; }';
  const FS =
    'precision mediump float; varying float vA; varying vec3 vC;' +
    'void main(){ vec2 d=gl_PointCoord-.5; float r2=dot(d,d)*4.; float a=exp(-r2*6.)+.14*exp(-r2*1.5); gl_FragColor=vec4(vC*a*vA*1.6,a*vA); }';

  function system(scene, n, kind, fill) {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), t = new Float32Array(n);
    for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
    if (fill) fill(pos, t, n);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    const U = { uTime: { value: 0 }, uPR: { value: 1 }, uW: { value: 0 }, uKind: { value: kind }, uHead: { value: 0 },
      uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() } };
    const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; scene.add(pts);
    return { pts: pts, U: U, pos: pos, geo: g };
  }

  /* ECG shape: baseline, P bump, QRS spike, T bump; x in 0..1 per beat */
  function ecg(x) {
    const b = (c, w, h) => h * Math.exp(-Math.pow((x - c) / w, 2));
    return b(0.18, 0.035, 0.12) - b(0.37, 0.012, 0.14) + b(0.40, 0.012, 1.0) - b(0.43, 0.012, 0.28) + b(0.66, 0.05, 0.22);
  }

  /* ── 01 singularity: the parts points can't draw. Hairline streaks and curly trails as 1-px lines, a black
        event-horizon disc that hides the stars behind the headline, and a soft rim glow. Everything is in the
        iris plane (z = 0), sized by the dust shape's scale (= horizon radius), and driven by
        (time, ignite, morph t), so it reverses with the scroll like the particles do. ── */
  const LVS =
    'attribute vec4 aSeed; attribute vec2 aL; uniform float uTime,uR,uW,uIgn,uBurst; varying float vA; varying vec3 vC;' +
    'void main(){ float ign=1.-pow(1.-uIgn,3.), k=aSeed.w, th, r, a;' +
    ' if(k<.5){ float life=fract(uTime*(.03+.05*aSeed.y)+aSeed.x); th=aL.x+uTime*.012;' +                 // streak: a hairline running outward
    '  float head=1.02+pow(life,1.3)*3.6*(.4+.6*aSeed.z), len=.05+.5*life*aSeed.z; r=aL.y>.5?head:max(1.01,head-len);' +
    '  a=(aL.y>.5?1.:0.)*smoothstep(0.,.05,life)*pow(1.-life,1.4)*.55; }' +
    ' else if(k<1.5){ th=aL.x+uTime*.012; r=aL.y>.5?5.5:1.0; a=(aL.y>.5?0.:.75)*(.75+.25*sin(uTime*.7+aSeed.x*9.)); }' +   // beam: a long spoke fading out
    ' else if(k<2.5){ th=position.y+uTime*(.012-.02/position.x); r=position.x; float h=fract(uTime*.11+aSeed.x), d=fract(h-aL.y);' +   // curl: a trail with a running bright head
    '  a=.07+.5*exp(-d*6.); }' +
    ' else { th=position.y+uTime*(.012+.035/position.x); r=1.+(position.x-1.)*(1.+.1*sin(uTime*.9+aSeed.x*6.28));' +   // corona fibre: rooted on the rim, swirls and breathes with the particles
    '  a=pow(1.-aL.y,1.3)*(.4+.3*sin(uTime*(1.2+aSeed.y*2.5)+aSeed.z*30.)); }' +
    ' r*=mix(.08,1.,ign)*(1.+uBurst*uBurst*3.2); a*=ign*uW*(1.-uBurst);' +
    ' vec3 p=vec3(cos(th)*r,sin(th)*r,0.)*uR; vA=a; vC=mix(vec3(.9,.95,1.),vec3(.55,.85,1.),aSeed.z*.4);' +
    ' gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }';
  const LFS = 'precision mediump float; varying float vA; varying vec3 vC; void main(){ gl_FragColor=vec4(vC*vA,vA); }';
  /* disc + glow share one quad: uMode 0 = black horizon (normal blend), 1 = rim glow (additive) */
  const QVS = 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  /* the glow also carries the two big light shapes of the reference: five soft beams (on the same angles as the
     hairline beams, turning with them) and three thick shock bands that ride the particle shock rings outward */
  const QFS =
    'precision mediump float; varying vec2 vP; uniform float uMode,uW,uIgn,uBurst,uTime,uHole;' +
    'float beam(float th,float r,float b,float R){ float d=abs(mod(th-b+3.14159,6.28318)-3.14159)*r, s=.02+.016*(r-R);' +   // d: distance off the spoke
    ' return exp(-d*d/(2.*s*s))*exp(-(r-R)*.5)*smoothstep(R,R*1.12,r); }' +
    'void main(){ float ign=1.-pow(1.-uIgn,3.), R=mix(.08,1.,ign)*uHole, r=length(vP);' +
    ' if(uMode<.5){ float m=smoothstep(R,R*.93,r)*uW; gl_FragColor=vec4(0.,0.,0.,m*.96); return; }' +
    ' float rim=exp(-pow((r-R)/(.035+.02*sin(uTime*.9)),2.))*step(R*.9,r), haze=exp(-max(r-R,0.)*1.6)*step(R,r)*.22;' +
    ' float th=atan(vP.y,vP.x)-uTime*.012, bm=0., rg=0.;' +
    ' bm+=beam(th,r,.42,R)*(.8+.2*sin(uTime*.7)); bm+=beam(th,r,1.31,R)*(.8+.2*sin(uTime*.7+1.9)); bm+=beam(th,r,2.05,R)*(.8+.2*sin(uTime*.7+3.8));' +
    ' bm+=beam(th,r,3.6,R)*(.8+.2*sin(uTime*.7+5.7)); bm+=beam(th,r,4.9,R)*(.8+.2*sin(uTime*.7+7.6));' +
    ' for(int i=0;i<3;i++){ float fi=float(i), life=fract(uTime*.042+fi/3.+.15), rr=R*(1.08+life*2.7), w=.06+.26*life;' +   // same cycle as the particle rings (engine.js iris())
    '  float tex=.6+.4*sin(th*97.+fi*7.)*sin(th*41.-fi*3.+uTime*.2);' +                                                     // streaky, like long-exposure trails
    '  rg+=exp(-pow((r-rr)/w,2.))*tex*pow(sin(3.14159*life),1.4)*(1.-.45*life); }' +
    ' float fb=clamp(uBurst*2.2,0.,1.), flash=fb*(1.-fb)*4.*exp(-r*r*1.8)*.32;' +                      // a short, soft collapse flash at the core
    ' float a=(rim*.28+haze+bm*.42+rg*.32)*uW*ign*(1.-uBurst)+flash*uW; gl_FragColor=vec4(vec3(.82,.92,1.)*a,a); }';

  function singularity(scene) {
    const TAU = Math.PI * 2, rnd = Math.random;
    const STREAKS = 1100, BEAMS = [0.42, 1.31, 2.05, 3.6, 4.9], TRAILS = 90, SEG = 48, FIBRES = 2200, FSEG = 3;
    const nV = (STREAKS + BEAMS.length) * 2 + TRAILS * SEG * 2 + FIBRES * FSEG * 2;
    const pos = new Float32Array(nV * 3), seed = new Float32Array(nV * 4), L = new Float32Array(nV * 2);
    let v = 0;
    const vert = (s, lx, ly, px, py) => { seed.set(s, v * 4); L[v * 2] = lx; L[v * 2 + 1] = ly; pos[v * 3] = px || 0; pos[v * 3 + 1] = py || 0; v++; };
    for (let i = 0; i < STREAKS; i++) { const s = [rnd(), rnd(), rnd(), 0], th = rnd() * TAU; vert(s, th, 0); vert(s, th, 1); }
    BEAMS.forEach(th => { const s = [rnd(), 0, 0, 1]; vert(s, th, 0); vert(s, th, 1); });
    for (let t = 0; t < TRAILS; t++) {                                       // curls in polar form: position.x = radius, .y = angle
      const s = [rnd(), rnd(), rnd(), 2], pts = [];
      let rr = 1.1 + Math.pow(rnd(), 1.4) * 2.2, th = rnd() * TAU, hd = rnd() * TAU;
      const turn = (rnd() - 0.5) * 0.45, step = 0.012 + rnd() * 0.012;
      for (let j = 0; j <= SEG; j++) {
        pts.push([rr, th]);
        hd += turn + Math.sin(j * 0.25 + t) * 0.22;
        const x = Math.cos(th) * rr + Math.cos(hd) * step, y = Math.sin(th) * rr + Math.sin(hd) * step;
        rr = Math.max(1.06, Math.hypot(x, y)); th = Math.atan2(y, x);
      }
      for (let j = 0; j < SEG; j++) { vert(s, 0, j / SEG, pts[j][0], pts[j][1]); vert(s, 0, (j + 1) / SEG, pts[j + 1][0], pts[j + 1][1]); }
    }
    for (let f = 0; f < FIBRES; f++) {                                       // corona fibres: short, a few long, bending slightly
      const s = [rnd(), rnd(), rnd(), 3], th0 = rnd() * TAU, len = 0.06 + Math.pow(rnd(), 2.2) * 1.1, bend = (rnd() - 0.5) * 0.35;
      for (let j = 0; j < FSEG; j++) {
        const u0 = j / FSEG, u1 = (j + 1) / FSEG;
        vert(s, 0, u0, 1.0 + u0 * len, th0 + bend * u0 * u0 * len); vert(s, 0, u1, 1.0 + u1 * len, th0 + bend * u1 * u1 * len);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aL', new THREE.BufferAttribute(L, 2));
    const LU = { uTime: { value: 0 }, uR: { value: 1 }, uW: { value: 0 }, uIgn: { value: 1 }, uBurst: { value: 0 } };
    const lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: LU, vertexShader: LVS, fragmentShader: LFS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    lines.frustumCulled = false; lines.visible = false; scene.add(lines);

    const qg = new THREE.PlaneGeometry(14, 14);
    const quad = (mode, blend, order) => {
      const U = { uMode: { value: mode }, uW: { value: 0 }, uIgn: { value: 1 }, uBurst: { value: 0 }, uTime: { value: 0 }, uHole: { value: 1 } };
      const m = new THREE.Mesh(qg, new THREE.ShaderMaterial({ uniforms: U, vertexShader: QVS, fragmentShader: QFS, transparent: true, depthWrite: false, depthTest: false, blending: blend }));
      m.renderOrder = order; m.frustumCulled = false; m.visible = false; scene.add(m);
      return { m: m, U: U };
    };
    const disc = quad(0, THREE.NormalBlending, -1);                          // after the stars (-2), before the particles (0)
    const glow = quad(1, THREE.AdditiveBlending, -1);
    return {
      update: function (time, w, ign, burst, R) {
        const on = w > 0.002;
        lines.visible = disc.m.visible = glow.m.visible = on;
        if (!on) return;
        LU.uTime.value = time; LU.uR.value = R; LU.uW.value = w; LU.uIgn.value = ign; LU.uBurst.value = burst;
        [disc, glow].forEach(q => {
          q.m.scale.setScalar(R); q.U.uTime.value = time; q.U.uW.value = w; q.U.uIgn.value = ign; q.U.uBurst.value = burst;
          q.U.uHole.value = 1 - burst * burst * (3 - 2 * burst);               // the horizon collapses as the planet forms
        });
      },
      dispose: function () { [lines, disc.m, glow.m].forEach(o => { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }); }
    };
  }

  function create(scene, engine) {
    const S = engine.uniforms, W = engine.weights;
    const SG = singularity(scene);
    const ecgN = 360, ECG_X = -3.6, ECG_Y = -3.28, ECG_Z = 2.6, ECG_LEN = 3.2;
    const E = system(scene, ecgN, 0, function (pos, t, n) {
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), beats = 2.2, ph = (u * beats) % 1;
        pos[i * 3] = ECG_X - ECG_LEN / 2 + u * ECG_LEN; pos[i * 3 + 1] = ECG_Y + ecg(ph) * 0.42; pos[i * 3 + 2] = ECG_Z; t[i] = u;
      }
    });
    const T = system(scene, 900, 1);
    T.U.uA.value.set(-0.24, 0.2, 0);                       // Orion engine bell: offset 2.0 + (-0.55 - 0.28) * scale 2.7 (engine.js SHAPES; Orion does not spin)
    const earthN = 700;
    const FE = system(scene, earthN, 3, function (pos) {
      for (let i = 0; i < earthN; i++) { const y = 1 - (i + .5) / earthN * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; pos[i * 3] = 2.4 + Math.cos(th) * r * 0.9; pos[i * 3 + 1] = -1.4 + y * 0.9; pos[i * 3 + 2] = -4 + Math.sin(th) * r * 0.9; }
    });
    const PK = system(scene, 160, 2, function (pos, t, n) { for (let i = 0; i < n; i++) t[i] = Math.floor(i / 40) / 4; });   // 4 bursts of 40
    PK.U.uA.value.set(-2.0, 0.55, 0); PK.U.uB.value.set(2.1, -1.2, -3.2);          // relay dish -> far Earth

    const all = [E, T, FE, PK];
    const sm = (x) => x * x * (3 - 2 * x);
    return {
      setPR: function (pr) { all.forEach(s => { s.U.uPR.value = pr; }); },
      update: function (time) {
        const t0 = S.uSeg.value < 0.5 ? S.uT.value : 1;                    // morph out of the singularity
        SG.update(time, W[0], S.uIgn.value, Math.min(1, t0 / 0.7), ADX_ENGINE.SHAPES[0].sc);
        const wAstro = W[2], wOrion = W[3], wRelay = W[4];
        E.U.uW.value = sm(wAstro); E.pts.visible = wAstro > 0.01; E.U.uHead.value = (time * 0.42) % 1.5;     // head sweeps, tail fades; pause beyond 1 for a beat
        T.U.uW.value = sm(wOrion); T.pts.visible = wOrion > 0.01; T.U.uTime.value = time;
        FE.U.uW.value = sm(wRelay); FE.pts.visible = wRelay > 0.01;
        PK.U.uW.value = sm(wRelay); PK.pts.visible = wRelay > 0.01; PK.U.uTime.value = time;
      },
      dispose: function () { SG.dispose(); all.forEach(s => { scene.remove(s.pts); s.geo.dispose(); s.pts.material.dispose(); }); }
    };
  }
  window.ADX_FX = { create: create };
})();
