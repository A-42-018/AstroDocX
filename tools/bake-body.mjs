#!/usr/bin/env node
/* ============================================================
   AstroDocX — Health Twin body baker: a real human shape from a
   turntable video (no 3D file needed).

   Usage
     node tools/bake-body.mjs --video "Human anatomy.mp4" --out landing/universe/targets/body.bin

   How
   1. Silhouettes: ffmpeg decodes every frame (540 px); the figure is every saturated pixel
      (blue skin, red vessels) on the grey studio background. Red counts only where skin
      encloses it, so the heart model that sticks out of the chest is not part of the body.
   2. Visual hull: a voxel is body if it falls inside the silhouette in all but 4 frames.
      The video is one full turn over all its frames; the camera was fitted by reprojection
      (99 % of every silhouette covered): 620 px away, looking 3 degrees down.
   3. Skin = hull surface points with normals (the X-ray rim needs them).
   4. Skeleton, arteries and organs are the hand-built ones from engine.js (genBody), warped
      into the hull: trunk and head per height (width, depth, centre), legs along their
      centre lines, arms bone by bone (shoulder -> elbow -> wrist -> fingertips).

   Output
     body.bin   per point: Int16 x,y,z (/8192), Int16 aNrm x,y,z (/4096), Uint8 region;
                Morton-sorted the way the runtime sorts. 24,000 points, 312,000 bytes.
     body.json  the Health Twin anchors in the new body: heart, label anchors, region heights.
   Requires ffmpeg on PATH. Body units: feet at -2.02, crown at 1.87 (the procedural body's).
============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './particles-lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.video || !args.out) { console.error('usage: bake-body.mjs --video turntable.mp4 --out body.bin'); process.exit(1); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = 24000, PX = 540;
const CAM = { AX: 270, YC: 290, EL: 3 * Math.PI / 180, D: 620, KEEP_MISS: 4, QR: { x: 405, y: 130 } };   // QR code: top right
const TOP = 1.87, BOT = -2.02;

/* ── the procedural body (same seed as the runtime) ── */
const engSrc = readFileSync(join(ROOT, 'landing/universe/engine.js'), 'utf8');
const HOOK = 'window.ADX_ENGINE = {';
if (!engSrc.includes(HOOK)) throw new Error('engine.js changed: cannot find ' + HOOK);
const win = {};
new Function('window', 'THREE', 'document', engSrc.replace(HOOK, 'window.__b = { genBody, rng, mortonSort }; ' + HOOK))(win, {}, {});
const { genBody, rng, mortonSort } = win.__b;
const proc = genBody(N, rng(20261009));
const SKIN = Math.floor(N * 0.46);                                     // genBody puts the skin first

/* ── 1. silhouettes ── */
const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', args.video, '-vf', `scale=${PX}:${PX}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
if (dec.status !== 0) throw new Error('ffmpeg failed: ' + dec.stderr);
const raw = dec.stdout, F = raw.length / (PX * PX * 3);
console.log('frames:', F);
const P2 = PX * PX, mask = new Uint8Array(F * P2);
for (let f = 0; f < F; f++) for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
  if (x > CAM.QR.x && y < CAM.QR.y) continue;
  const o = (f * P2 + y * PX + x) * 3, r = raw[o], g = raw[o + 1], b = raw[o + 2];
  if (Math.max(r, g, b) - Math.min(r, g, b) > 40) mask[f * P2 + y * PX + x] = r > b + 20 ? 2 : 1;
}
for (let f = 0; f < F; f++) for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {      // red: keep only if skin encloses it
  const i = f * P2 + y * PX + x; if (mask[i] !== 2) continue;
  const skin = (dx, dy) => { for (let k = 1; k <= 60; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= PX || yy >= PX) return false; const m = mask[f * P2 + yy * PX + xx]; if (m === 1) return true; if (!m) return false; } return false; };
  mask[i] = (skin(-1, 0) && skin(1, 0)) || (skin(0, -1) && skin(0, 1)) ? 3 : 0;
}
const sil = new Uint8Array(F * P2);                                    // 1 px dilation
for (let f = 0; f < F; f++) for (let y = 1; y < PX - 1; y++) for (let x = 1; x < PX - 1; x++) { const b = f * P2 + y * PX + x; if (mask[b] || mask[b - 1] || mask[b + 1] || mask[b - PX] || mask[b + PX]) sil[b] = 1; }

/* ── 2. visual hull ── */
const ST = 2, R = 120, GX = R + 1, Y0 = 70, GY = 226;                  // voxel grid in pixels: x, z in [-120, 120], y from 70 down
const cs = [], sn = []; for (let f = 0; f < F; f++) { const a = -f * 2 * Math.PI / F; cs.push(Math.cos(a)); sn.push(Math.sin(a)); }
const ce = Math.cos(CAM.EL), se = Math.sin(CAM.EL);
const occ = new Uint8Array(GX * GY * GX), vid = (ix, iy, iz) => (iy * GX + ix) * GX + iz;
for (let iy = 0; iy < GY; iy++) { const Y = Y0 + iy * ST;
  for (let ix = 0; ix < GX; ix++) for (let iz = 0; iz < GX; iz++) {
    const X = -R + ix * ST, Z = -R + iz * ST; let miss = 0;
    for (let f = 0; f < F && miss <= CAM.KEEP_MISS; f++) {
      const xr = cs[f] * X + sn[f] * Z, zr = -sn[f] * X + cs[f] * Z, k = CAM.D / (CAM.D - (zr * ce + (CAM.YC - Y) * se));
      const sx = Math.round(CAM.AX + xr * k), sy = Math.round(CAM.YC + ((Y - CAM.YC) * ce + zr * se) * k);
      if (!(sx >= 0 && sx < PX && sy >= 0 && sy < PX && sil[f * P2 + sy * PX + sx])) miss++;
    }
    if (miss <= CAM.KEEP_MISS) occ[vid(ix, iy, iz)] = 1;
  } }
let yTop = 1e9, yBot = -1e9;
for (let iy = 0; iy < GY; iy++) for (let i = 0; i < GX * GX; i++) if (occ[iy * GX * GX + i]) { yTop = Math.min(yTop, iy); yBot = Math.max(yBot, iy); }
const SC = (TOP - BOT) / ((yBot - yTop) * ST);                          // pixels -> body units
const bx = ix => (-R + ix * ST) * SC, by = iy => TOP - (iy - yTop) * ST * SC, bz = bx;
const at = (ix, iy, iz) => ix >= 0 && iy >= 0 && iz >= 0 && ix < GX && iy < GY && iz < GX && occ[vid(ix, iy, iz)];
console.log('hull rows', yTop, '..', yBot, 'scale', SC.toFixed(5));

/* ── hull measurements per row: runs along x (over all z), each with z range ── */
const rows = [];
for (let iy = yTop; iy <= yBot; iy++) {
  const runs = []; let cur = null;
  for (let ix = 0; ix < GX; ix++) {
    let z0 = 1e9, z1 = -1e9; for (let iz = 0; iz < GX; iz++) if (occ[vid(ix, iy, iz)]) { z0 = Math.min(z0, iz); z1 = Math.max(z1, iz); }
    if (z1 >= z0) { if (!cur) runs.push(cur = { x0: ix, x1: ix, z0, z1, zc0: 0, n: 0 }); cur.x1 = ix; cur.z0 = Math.min(cur.z0, z0); cur.z1 = Math.max(cur.z1, z1); cur.zc0 += (z0 + z1) / 2; cur.n++; }
    else cur = null;
  }
  rows.push({ y: by(iy), runs: runs.map(r => ({ x0: bx(r.x0), x1: bx(r.x1), cx: (bx(r.x0) + bx(r.x1)) / 2, hw: (r.x1 - r.x0 + 1) * ST * SC / 2, z0: bz(r.z0), z1: bz(r.z1), zc: bz(r.zc0 / r.n) })) });
}
/* centre column of the trunk (x ~ 0): front and back of the body at that height */
const colZ = iy => { const ix0 = Math.round(R / ST); let z0 = 1e9, z1 = -1e9; for (let ix = ix0 - 1; ix <= ix0 + 1; ix++) for (let iz = 0; iz < GX; iz++) if (occ[vid(ix, iy, iz)]) { z0 = Math.min(z0, bz(iz)); z1 = Math.max(z1, bz(iz)); } return z1 >= z0 ? [z0, z1] : null; };
rows.forEach((r, i) => { r.col = colZ(yTop + i); });
const rowAt = y => rows[Math.max(0, Math.min(rows.length - 1, Math.round((TOP - y) / (ST * SC))))];
const smoothRows = (y, fn, w = 3) => { const i0 = Math.round((TOP - y) / (ST * SC)); let s = 0, c = 0; for (let i = i0 - w; i <= i0 + w; i++) { const r = rows[i]; const v = r && fn(r); if (v !== null && v !== undefined && !Number.isNaN(v)) { s += v; c++; } } return c ? s / c : null; };

/* landmarks: armpit (first row from the top with arms apart), crotch (first row with two legs and no trunk) */
const isLegRow = r => r.runs.length >= 2 && !r.runs.some(q => q.x0 < 0 && q.x1 > 0) && r.runs.every(q => Math.abs(q.cx) < 0.6);
const armpit = rows.find(r => r.y < 1.1 && r.runs.length >= 3).y;
const crotch = rows.find(r => r.y < 0 && isLegRow(r)).y;
const shoulderTop = rows.find(r => r.runs.length === 1 && r.runs[0].hw > 0.3).y;
console.log('armpit', armpit.toFixed(3), 'crotch', crotch.toFixed(3), 'shoulder top', shoulderTop.toFixed(3));
const mid = r => r.runs.find(q => q.x0 <= 0.02 && q.x1 >= -0.02) || null;

/* ── the procedural body's own profile (engine.js genBody numbers) ── */
const TORSO = [[-0.26, 0.24, 0.15, 0], [-0.05, 0.33, 0.17, -0.01], [0.15, 0.29, 0.155, 0], [0.35, 0.265, 0.15, 0.01], [0.55, 0.32, 0.175, 0.015],
               [0.75, 0.37, 0.2, 0.02], [0.95, 0.395, 0.195, 0.01], [1.08, 0.38, 0.155, -0.01], [1.17, 0.22, 0.11, -0.02], [1.24, 0.09, 0.085, -0.01]];
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function procTrunk(y) {                                                // half width, half depth, centre z
  if (y > 1.46) return { hw: 0.152, hd: 0.178, zc: 0.015 };            // head
  if (y > 1.24) return { hw: 0.065, hd: 0.065, zc: 0 };                // neck
  const yy = clamp(y, TORSO[0][0], 1.24); let i = 0; while (i < TORSO.length - 2 && yy > TORSO[i + 1][0]) i++;
  const A = TORSO[i], B = TORSO[i + 1], t = (yy - A[0]) / (B[0] - A[0]), s = t * t * (3 - 2 * t);
  return { hw: lerp(A[1], B[1], s), hd: lerp(A[2], B[2], s), zc: lerp(A[3], B[3], s) };
}
const HEAD_Y = 1.66, NECK_Y = 1.36;
function hullTrunkRaw(y) {
  const yy = y > 1.46 ? HEAD_Y : y > 1.24 ? NECK_Y : Math.max(y, crotch + 0.02);   // head and neck: one size each, like the procedural ones; no trunk below the crotch
  const zc = smoothRows(yy, r => r.col ? (r.col[0] + r.col[1]) / 2 : null), hd = smoothRows(yy, r => r.col ? (r.col[1] - r.col[0]) / 2 : null);
  let hw;
  if (yy > armpit && yy < shoulderTop) hw = procTrunk(yy).hw * (smoothRows(armpit - 0.03, r => mid(r) && mid(r).hw) / procTrunk(armpit - 0.03).hw);   // arms merged here
  else hw = smoothRows(yy, r => mid(r) && mid(r).hw);
  return { hw, hd, zc };
}
/* legs: procedural centre line (thigh -> knee -> calf -> ankle -> foot) and the hull's, per side */
const PLEG = [[-0.12, 0.175, 0, 0.18, 0.18], [-0.62, 0.16, 0.01, 0.14, 0.14], [-1.02, 0.145, 0.02, 0.092, 0.092], [-1.32, 0.15, -0.01, 0.102, 0.102], [-1.86, 0.15, 0, 0.052, 0.052], [-1.97, 0.15, 0.07, 0.06, 0.14]];   // y, |x|, z, r x, r z
function procLeg(y) {
  const yy = clamp(y, -1.97, -0.12); let i = 0; while (i < PLEG.length - 2 && yy < PLEG[i + 1][0]) i++;
  const A = PLEG[i], B = PLEG[i + 1], t = (yy - A[0]) / (B[0] - A[0]);
  return { cx: lerp(A[1], B[1], t), cz: lerp(A[2], B[2], t), rx: lerp(A[3], B[3], t), rz: lerp(A[4], B[4], t) };
}
function hullLeg(y, side) {
  const yy = Math.min(y, crotch - 0.03);                               // legs merge above the crotch: carry the first separate row up
  const pick = r => isLegRow(r) ? r.runs.filter(q => Math.sign(q.cx) === side).sort((a, b) => b.hw - a.hw)[0] : null;
  const g = fn => smoothRows(yy, r => { const q = pick(r); return q ? fn(q) : null; }, 2);
  return { cx: Math.abs(g(q => q.cx)), cz: g(q => (q.z0 + q.z1) / 2), rx: g(q => q.hw), rz: g(q => (q.z1 - q.z0) / 2) };
}
/* arms: procedural joints and the hull's, per side */
const PARM = { S: [0.43, 1.07, -0.01], E: [0.565, 0.42, 0.02], W: [0.625, -0.17, 0.07], F: [0.64, -0.42, 0.1], r: [0.093, 0.066, 0.05] };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => scl(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rotFromTo(a, b) { const v = cross(a, b), c = dot(a, b), k = 1 / (1 + c); return p => [
  (v[0] * v[0] * k + c) * p[0] + (v[1] * v[0] * k - v[2]) * p[1] + (v[2] * v[0] * k + v[1]) * p[2],
  (v[0] * v[1] * k + v[2]) * p[0] + (v[1] * v[1] * k + c) * p[1] + (v[2] * v[1] * k - v[0]) * p[2],
  (v[0] * v[2] * k - v[1]) * p[0] + (v[1] * v[2] * k + v[0]) * p[1] + (v[2] * v[2] * k + c) * p[2]]; }
function hullArm(side) {
  const line = rows.filter(r => r.y < armpit && r.runs.length >= 3).map(r => { const q = side > 0 ? r.runs[r.runs.length - 1] : r.runs[0]; return { y: r.y, p: [q.cx, r.y, (q.z0 + q.z1) / 2], hw: q.hw, hd: (q.z1 - q.z0) / 2 }; });
  const tip = line[line.length - 1];
  const F_ = [tip.p[0], tip.p[1] - 0.02, tip.p[2]];
  const wr = line.filter(q => q.y > tip.y + 0.25 && q.y < tip.y + 0.6).sort((a, b) => a.hw - b.hw)[0];
  const up = line.filter(q => q.y < armpit - 0.03 && q.y > armpit - 0.3);                 // upper arm: fit a line, extend to the shoulder joint
  const ym = up.reduce((s, q) => s + q.y, 0) / up.length, xm = up.reduce((s, q) => s + q.p[0], 0) / up.length, zm = up.reduce((s, q) => s + q.p[2], 0) / up.length;
  const vy = up.reduce((s, q) => s + (q.y - ym) ** 2, 0), kx = up.reduce((s, q) => s + (q.y - ym) * (q.p[0] - xm), 0) / vy, kz = up.reduce((s, q) => s + (q.y - ym) * (q.p[2] - zm), 0) / vy;
  const S_ = [xm + kx * (1.06 - ym), 1.06, zm + kz * (1.06 - ym)];
  const ey = wr.y + 0.476 * (S_[1] - wr.y), eq = line.reduce((b, q) => Math.abs(q.y - ey) < Math.abs(b.y - ey) ? q : b);
  const avg = (a, b) => { const s = line.filter(q => q.y <= a && q.y >= b); return s.reduce((t, q) => t + (q.hw + q.hd) / 2, 0) / s.length; };
  return { S: S_, E: eq.p, W: wr.p, F: F_, r: [avg(armpit - 0.03, eq.y), avg(eq.y, wr.y), avg(wr.y, tip.y)] };
}
const ARMS = { 1: hullArm(1), '-1': hullArm(-1) };
console.log('arm (+x):', JSON.stringify(ARMS[1], (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));

/* ── the warp: procedural body point -> point inside the hull ── */
const keepIn = v => { const a = Math.abs(v); return a < 0.7 ? v : Math.sign(v) * (0.7 + 0.22 * Math.tanh((a - 0.7) / 0.22)); };   // inner parts stay inside the skin (the ribs reached past the old torso's back)
function mapTrunk(p) {
  const P = procTrunk(p[1]), H = hullTrunkRaw(p[1]);
  return [keepIn(p[0] / P.hw) * H.hw, p[1], H.zc + keepIn((p[2] - P.zc) / P.hd) * H.hd];
}
function mapLeg(p) {
  const side = p[0] < 0 ? -1 : 1, P = procLeg(p[1]), H = hullLeg(p[1], side);
  return [side * (H.cx + (Math.abs(p[0]) - P.cx) / P.rx * H.rx), p[1], H.cz + (p[2] - P.cz) / P.rz * H.rz];
}
function mapArm(p) {
  const side = p[0] < 0 ? -1 : 1, m = q => [q[0] * side, q[1], q[2]], A = ARMS[side];
  const pj = [m(PARM.S), m(PARM.E), m(PARM.W), m(PARM.F)], hj = [A.S, A.E, A.W, A.F];
  let best = null;
  for (let s = 0; s < 3; s++) {
    const a = pj[s], ab = sub(pj[s + 1], a), t = clamp(dot(sub(p, a), ab) / dot(ab, ab), s ? 0 : -0.5, s < 2 ? 1 : 1.3), c = add(a, scl(ab, t)), d = len(sub(p, c));
    if (!best || d < best.d) best = { s, t, off: sub(p, c), d };
  }
  const { s, t, off } = best, pd = nrm(sub(pj[s + 1], pj[s])), hd = nrm(sub(hj[s + 1], hj[s]));
  return add(add(hj[s], scl(sub(hj[s + 1], hj[s]), t)), scl(rotFromTo(pd, hd)(off), A.r[s] / PARM.r[s]));
}
function warp(p, region) {
  if (region === 9) return p;                                          // the floor ring stays
  const ax = Math.abs(p[0]);
  const wArm = p[1] > -0.55 && p[1] < 1.16 ? smooth(ax, 0.36, 0.47) : 0;
  const wLeg = p[1] < -0.12 && ax < 0.36 ? smooth(-p[1], 0.12, 0.3) : 0;
  let q = mapTrunk(p);
  if (wLeg > 0) q = q.map((v, k) => lerp(v, mapLeg(p)[k], wLeg));
  if (wArm > 0) q = q.map((v, k) => lerp(v, mapArm(p)[k], wArm));
  return q;
}

/* ── 3. skin from the hull surface; normals from a blurred occupancy gradient ── */
const surf = [];
for (let iy = 0; iy < GY; iy++) for (let ix = 0; ix < GX; ix++) for (let iz = 0; iz < GX; iz++)
  if (at(ix, iy, iz) && !(at(ix + 1, iy, iz) && at(ix - 1, iy, iz) && at(ix, iy + 1, iz) && at(ix, iy - 1, iz) && at(ix, iy, iz + 1) && at(ix, iy, iz - 1))) surf.push([ix, iy, iz]);
function normalAt(ix, iy, iz) {
  const g = [0, 0, 0], B = 3;
  for (let dy = -B; dy <= B; dy++) for (let dx = -B; dx <= B; dx++) for (let dz = -B; dz <= B; dz++) if (at(ix + dx, iy + dy, iz + dz)) { g[0] -= dx; g[1] += dy; g[2] -= dz; }   // y flips: rows grow downward
  return nrm(g);
}
const r = rng(31337), pos = new Float32Array(N * 3), reg = new Float32Array(N), nrmA = new Float32Array(N * 3);
console.log('surface voxels', surf.length);
const transmitterElbowY = ARMS[1].E[1];
for (let k = 0; k < SKIN; k++) {
  const [ix, iy, iz] = surf[Math.floor(r() * surf.length)], n = normalAt(ix, iy, iz);
  const p = [bx(ix) + (r() - 0.5) * ST * SC, by(iy) + (r() - 0.5) * ST * SC, bz(iz) + (r() - 0.5) * ST * SC];
  if (r() < 0.34) p[1] = Math.round(p[1] / 0.075) * 0.075;             // scanner contour lines, as before
  const legs = p[1] < crotch + 0.12 && Math.abs(p[0]) < 0.5, arm = Math.abs(p[0]) > 0.45 && p[1] < armpit + 0.1;
  const g = legs ? 5 : arm && p[0] > 0 && p[1] < transmitterElbowY ? 7 : 0;
  pos.set(p, k * 3); nrmA.set(n, k * 3); reg[k] = g;
}
/* ── 4. everything inside, warped ── */
for (let k = SKIN; k < N; k++) {
  const g = proc.reg[k], p = warp([proc.pos[k * 3], proc.pos[k * 3 + 1], proc.pos[k * 3 + 2]], g);
  pos.set(p, k * 3); reg[k] = g; nrmA.set([proc.nrm[k * 3], proc.nrm[k * 3 + 1], proc.nrm[k * 3 + 2]], k * 3);   // arteries: aNrm.x = pulse distance
}

/* anchors for the Health Twin (health-twin.js STAGES, engine.js HEART) */
const STAGE_AT = [[0, 1.70, 0.06, 1], [-0.16, 0.86, 0.08, 3], [-0.27, 0.30, 0.12, 0], [0.06, 0.78, 0.12, 2], [0.60, 0.12, 0.08, 7], [0.15, -1.15, 0.08, 5]];
const rig = {
  heart: warp([0.06, 0.78, 0.07], 2).map(v => +v.toFixed(3)),
  at: STAGE_AT.map(a => warp(a.slice(0, 3), a[3]).map(v => +v.toFixed(3))),
  centers: { 0: 9, 1: 1.70, 2: 0.78, 3: 0.86, 4: 0.26, 5: -1.2, 6: 0.5, 7: +warp([0.60, 0.0, 0.05], 7)[1].toFixed(3), 8: 0, 9: -9 }
};
console.log('rig', JSON.stringify(rig));

/* ── write: Morton-sorted exactly like the runtime, region and normal ride along ── */
const sorted = mortonSort(pos, N, [reg, nrmA]);
const buf = Buffer.alloc(N * 13);
for (let i = 0; i < N; i++) {
  for (let c = 0; c < 3; c++) buf.writeInt16LE(clamp(Math.round(sorted[i * 3 + c] * 8192), -32767, 32767), i * 6 + c * 2);
  for (let c = 0; c < 3; c++) buf.writeInt16LE(clamp(Math.round(nrmA[i * 3 + c] * 4096), -32767, 32767), N * 6 + i * 6 + c * 2);
  buf.writeUInt8(reg[i], N * 12 + i);
}
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, buf);
writeFileSync(args.out.replace(/\.bin$/, '.json'), JSON.stringify(rig, null, 1) + '\n');
console.log('wrote', args.out, buf.length, 'bytes, and', args.out.replace(/\.bin$/, '.json'));
