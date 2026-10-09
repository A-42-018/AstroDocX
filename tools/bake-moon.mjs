#!/usr/bin/env node
/* ============================================================
   AstroDocX — "Crew" scene baker: astronaut saluting the flag on
   the Moon, a small Earth hanging above. One point cloud for
   the astronaut slot of the landing intro.

   Layout follows the Apollo 11 photo AS11-40-5875: the pole on the left, the cloth
   reaching right toward the saluting astronaut, Earth above the flag.

   Usage
     node tools/bake-moon.mjs --suit z2-decoded.glb --out landing/universe/targets/astronaut.bin
         [--n 24000] [--seed 3]

   --suit   the NASA Z2 spacesuit .glb (NASA 3D Resources), Draco-decoded with
            tools/undraco.mjs. It stands arms forward, facing +z, feet at y = 0;
            the right arm is re-posed into a salute here (two-bone, blended at
            the shoulder and elbow so the surface stays closed).

   Output   Int16 x,y,z per point (as bake-particles.mjs), then one Uint8 tag per point
              0 suit / ground / pole   1 Earth (spins)   16..255 flag cloth, (u, v) on the cloth
            The engine animates by tag: the cloth ripples, the Earth turns.
   Scene units are metres before normalising; the suit is 1.93 m tall.
============================================================ */
import { parseArgs, rng, readGlbMesh, sampleMesh, normaliser, morton, writeBin } from './particles-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const N = +args.n || 24000;
if (!args.suit || !args.out) { console.error('usage: bake-moon.mjs --suit z2.glb --out astronaut.bin [--n 24000]'); process.exit(1); }
const rand = rng(+args.seed || 3);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(6.2831853 * rand());

/* particle budget, as a share of N */
const SHARE = { suit: 0.44, cloth: 0.11, pole: 0.022, bar: 0.009, ground: 0.305, rocks: 0.012 };

/* ── small vector kit ── */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => scl(a, 1 / (len(a) || 1)), lerp = (a, b, t) => add(a, scl(sub(b, a), t));
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rotFromTo(a, b) {                                     // 3x3 rotation taking unit a onto unit b (shortest arc)
  const v = cross(a, b), c = dot(a, b), k = 1 / (1 + c);
  return [v[0] * v[0] * k + c, v[1] * v[0] * k - v[2], v[2] * v[0] * k + v[1],
          v[0] * v[1] * k + v[2], v[1] * v[1] * k + c, v[2] * v[1] * k - v[0],
          v[0] * v[2] * k - v[1], v[1] * v[2] * k + v[0], v[2] * v[2] * k + c];
}
function rotAxis(ax, t) {                                      // 3x3 rotation about unit axis by t
  const [x, y, z] = ax, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
const mm = (A, B) => [0, 1, 2].flatMap(r => [0, 1, 2].map(c => A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]));
const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];

/* ── the suit, right arm raised to the brow ── */
const SHOULDER = [-0.30, 1.48, 0.05], HAND0 = [-0.283, 1.078, 0.595];   // measured on the Z2 mesh (right arm is -x)
const L1 = 0.33, LARM = len(sub(HAND0, SHOULDER)), L2 = LARM - L1;
const U0 = nrm(sub(HAND0, SHOULDER)), ELBOW0 = add(SHOULDER, scl(U0, L1));
const HAND = [-0.155, 1.79, 0.27];                                       // hand at the right brow of the helmet
const POLE = nrm([-1, -0.35, 0.15]);                                    // the elbow points out and a little down
function salute(mesh) {
  const sh = sub(HAND, SHOULDER), d = len(sh), dh = scl(sh, 1 / d);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const perp = nrm(sub(POLE, scl(dh, dot(POLE, dh)))), elbow = add(add(SHOULDER, scl(dh, a)), scl(perp, h));
  const uDir = nrm(sub(elbow, SHOULDER)), fDir = nrm(sub(HAND, elbow));
  const RU = rotFromTo(U0, uDir);
  const RF = mm(rotAxis(fDir, -0.9), rotFromTo(U0, fDir));               // forearm, rolled so the palm faces down and out
  mesh.verts = mesh.verts.map(p => {
    const q = sub(p, SHOULDER), t = dot(q, U0), r = len(sub(q, scl(U0, t)));
    const m = (1 - smooth(r, 0.12, 0.17)) * smooth(-p[0], 0.14, 0.2);  // inside the sleeve, outside the torso
    const wu = m * smooth(t, -0.05, 0.07), wf = m * smooth(t, L1 - 0.06, L1 + 0.04);
    if (wu <= 0) return p;
    const up = add(SHOULDER, mv(RU, q)), fo = add(elbow, mv(RF, sub(p, ELBOW0)));
    return lerp(lerp(p, up, wu), fo, wf);
  });
  return mesh;
}

/* ── the flag: Apollo style, pole plus a horizontal crossbar holding the cloth out ── */
const POLE_AT = [-1.75, 0, -0.32], POLE_H = 2.28, BAR_L = 1.12;
const CLOTH = { x0: POLE_AT[0] + 0.03, w: 1.1, top: 2.24, h: 0.7 };
function clothZ(u, v) { return POLE_AT[2] + (0.035 * Math.sin(u * 10.5 + v * 1.8) + 0.018 * Math.sin(u * 23 - v * 3)) * (0.35 + 0.65 * u); }
function cloth(n) {
  /* 13 stripes; the bright (white) ones dense, the red ones sparse. Canton: 7 stripes deep, 0.4 wide, 50 stars as tight clusters */
  const pts = [], tags = [], tag = (u, v) => 16 + Math.min(15, Math.round(u * 15)) + 16 * Math.min(14, Math.round(v * 14));
  const starN = Math.round(n * 0.12), stars = [];
  for (let row = 0; row < 9; row++) for (let k = 0; k < (row % 2 ? 5 : 6); k++) stars.push([(k + (row % 2 ? 1 : 0.5)) / 6 * 0.4, (row + 1) / 10 * (7 / 13)]);
  for (let i = 0; i < starN; i++) {
    const s = stars[i % stars.length], u = s[0] + gauss() * 0.0045, v = s[1] + gauss() * 0.007;
    pts.push([CLOTH.x0 + u * CLOTH.w, CLOTH.top - v * CLOTH.h, clothZ(u, v) + 0.004]); tags.push(tag(u, v));
  }
  while (pts.length < n) {
    const u = rand(), v = rand(), stripe = Math.min(12, Math.floor(v * 13)), canton = u < 0.4 && stripe < 7;
    const dens = canton ? 0.3 : stripe % 2 ? 0.07 : 1;
    if (rand() > dens) continue;
    pts.push([CLOTH.x0 + u * CLOTH.w, CLOTH.top - v * CLOTH.h, clothZ(u, v)]); tags.push(tag(u, v));
  }
  return { pts, tags };
}
function cylinder(n, a, b, r) {
  const ax = nrm(sub(b, a)), t1 = nrm(cross(ax, Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), t2 = cross(ax, t1), out = [];
  for (let i = 0; i < n; i++) { const t = rand(), th = rand() * 6.2832; out.push(add(lerp(a, b, t), add(scl(t1, Math.cos(th) * r), scl(t2, Math.sin(th) * r)))); }
  return out;
}

/* ── the ground: regolith patch with craters and boot prints, fading out at the edge ── */
const GROUND = { c: [-0.55, 0, 0.05], rx: 1.8, rz: 1.35 };
const CRATERS = [[-1.75, 0.6, 0.3], [0.75, 0.55, 0.24], [-0.35, -0.95, 0.42], [-1.1, 0.95, 0.16], [0.85, -0.6, 0.14], [-2.0, -0.55, 0.2]];   // x, z, radius
const PRINTS = [[-0.42, 0.55, 0.4], [-0.1, 0.78, -0.2], [0.3, 0.42, 0.3], [-0.85, 0.2, -0.1], [-1.2, 0.05, 0.2], [-0.62, 0.75, 0.5]];   // x, z, heading
function noise(x, z) { return (Math.sin(x * 3.1 + Math.sin(z * 2.3)) + Math.sin(z * 3.7 + Math.sin(x * 1.9) * 1.4) + 0.5 * Math.sin((x + z) * 9.3)) / 2.5; }
function groundY(x, z) {
  let y = noise(x, z) * 0.035 - 0.02;
  for (const [cx, cz, cr] of CRATERS) { const d = Math.hypot(x - cx, z - cz) / cr; if (d < 1.4) y += d < 1 ? -0.09 * cr * (1 - d * d) : 0.05 * cr * Math.exp(-Math.pow((d - 1.05) * 6, 2)); }
  return y;
}
function inPrint(x, z) {
  for (const [px, pz, hd] of PRINTS) {
    const dx = x - px, dz = z - pz, a = Math.cos(hd) * dx + Math.sin(hd) * dz, b = -Math.sin(hd) * dx + Math.cos(hd) * dz;
    if (Math.pow(a / 0.06, 2) + Math.pow(b / 0.14, 2) < 1) return true;
  }
  return false;
}
function ground(n) {
  const out = [];
  while (out.length < n) {
    const x = GROUND.c[0] + (rand() * 2 - 1) * GROUND.rx, z = GROUND.c[2] + (rand() * 2 - 1) * GROUND.rz;
    const r = Math.hypot((x - GROUND.c[0]) / GROUND.rx, (z - GROUND.c[2]) / GROUND.rz);
    let dens = r > 1 ? 0 : 1 - smooth(r, 0.45, 1);
    for (const [cx, cz, cr] of CRATERS) { const d = Math.hypot(x - cx, z - cz) / cr; if (d < 0.85) dens *= 0.45; else if (d < 1.2) dens = Math.min(1, dens * 1.6); }   // dark floor, bright rim
    if (inPrint(x, z)) dens *= 0.15;
    if (rand() > dens) continue;
    out.push([x, groundY(x, z) + gauss() * 0.004, z]);
  }
  return out;
}
function rocks(n) {
  const R = [[-2.05, 0.35, 0.07], [0.6, 0.95, 0.05], [0.95, 0.1, 0.06], [-1.3, -0.85, 0.08], [-0.6, -0.35, 0.04], [0.35, -0.5, 0.05]], out = [];
  for (let i = 0; i < n; i++) {
    const [x, z, s] = R[i % R.length], v = nrm([gauss(), gauss(), gauss()]);
    out.push([x + v[0] * s * 1.3, groundY(x, z) + Math.max(-0.2, v[1]) * s * 0.8 + s * 0.4, z + v[2] * s]);
  }
  return out;
}

/* ── a small Earth above the flag: continents dense, oceans sparse, ice caps ── */
const EARTH = { c: [-1.05, 3.0, -1.1], r: 0.3 };
function n3(x, y, z) { return (Math.sin(x * 1.7 + Math.sin(y * 2.3) + z) + Math.sin(y * 1.9 + Math.sin(z * 2.1) + x * .7) + Math.sin(z * 2.2 + Math.sin(x * 1.3) + y * .9)) / 3; }
function earth(n) {
  const out = [];
  while (out.length < n) {
    const v = nrm([gauss(), gauss(), gauss()]), land = n3(v[0] * 2.6 + 1, v[1] * 2.6, v[2] * 2.6) + n3(v[0] * 6, v[1] * 6, v[2] * 6) * 0.25 > 0.12;
    if (!land && Math.abs(v[1]) < 0.85 && rand() > 0.3) continue;
    out.push(add(EARTH.c, scl(v, EARTH.r * (1 + (rand() < 0.04 ? 0.06 : 0)))));
  }
  return out;
}

/* ── compose ── */
const count = k => Math.round(N * SHARE[k]);
const suitN = count('suit'), clothN = count('cloth'), poleN = count('pole'), barN = count('bar'), groundN = count('ground'), rockN = count('rocks');
const earthN = N - suitN - clothN - poleN - barN - groundN - rockN;
const mesh = salute(readGlbMesh(args.suit));
console.log('suit triangles:', mesh.tris.length);
const helmet = [0, 1.75, 0.03];
const suit = sampleMesh(mesh, suitN, rand, c => 1 + 0.6 * Math.exp(-Math.pow(len(sub(c, helmet)) / 0.25, 2)));   // a little extra on the helmet: it carries the read
const fl = cloth(clothN);
const parts = [
  [suit, 0], [fl.pts, fl.tags],
  [cylinder(poleN, add(POLE_AT, [0, -0.04, 0]), add(POLE_AT, [0, POLE_H, 0]), 0.016), 0],
  [cylinder(barN, add(POLE_AT, [0, CLOTH.top + 0.02, 0]), add(POLE_AT, [BAR_L, CLOTH.top + 0.02, 0]), 0.011), 0],
  [ground(groundN), 0], [rocks(rockN), 0], [earth(earthN), 1]
];
let pts = [], tags = [];
for (const [p, t] of parts) { pts = pts.concat(p); tags = tags.concat(Array.isArray(t) ? t : p.map(() => t)); }
const norm = normaliser(pts);
pts = pts.map(norm);
console.log('chest (shape space):', norm([0, 1.3, 0.2]).map(v => +v.toFixed(3)));
const sorted = morton(pts, tags);
writeBin(args.out, sorted.pts, sorted.tags);
