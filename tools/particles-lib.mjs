/* ============================================================
   AstroDocX — shared helpers for the particle bakers
   (bake-particles.mjs, bake-moon.mjs). No dependencies.
============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function parseArgs(argv) {
  return Object.fromEntries(argv.reduce((a, v, i, arr) => {
    if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return a;
  }, []));
}

/* deterministic PRNG */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ── 4x4 matrix helpers (column-major, glTF) ── */
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0,
          (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0,
          (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
}
const apply = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];

/* ── minimal GLB reader: world-space mesh {verts: [[x,y,z]], tris: [[i,j,k]]} ── */
const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
export function readGlbMesh(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error('not a .glb file (magic)');
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004E4942 && !bin) bin = data;
    off += 8 + len;
  }
  if (!json || !bin) throw new Error('GLB has no JSON or BIN chunk');
  if ((json.extensionsRequired || []).some(e => /draco|meshopt/i.test(e))) throw new Error('compressed GLB (' + json.extensionsRequired + ') is not supported; decode it first with tools/undraco.mjs');

  function accessor(i) {
    const acc = json.accessors[i], bv = json.bufferViews[acc.bufferView], [, size] = COMP[acc.componentType], n = NCOMP[acc.type];
    if (acc.sparse) throw new Error('sparse accessors are not supported');
    const stride = bv.byteStride || size * n, base = (bv.byteOffset || 0) + (acc.byteOffset || 0), out = new Array(acc.count);
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const get = { 5126: (o) => dv.getFloat32(o, true), 5125: (o) => dv.getUint32(o, true), 5123: (o) => dv.getUint16(o, true), 5122: (o) => dv.getInt16(o, true), 5121: (o) => dv.getUint8(o), 5120: (o) => dv.getInt8(o) }[acc.componentType];
    for (let k = 0; k < acc.count; k++) { const r = []; for (let c = 0; c < n; c++) r.push(get(base + k * stride + c * size)); out[k] = n === 1 ? r[0] : r; }
    return out;
  }
  const verts = [], tris = [];
  function visit(ni, parent) {
    const node = json.nodes[ni], m = mul(parent, node.matrix || trs(node.translation, node.rotation, node.scale));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives) {
        if (prim.mode !== undefined && prim.mode !== 4) continue;                  // triangles only
        const base = verts.length, pos = accessor(prim.attributes.POSITION);
        pos.forEach(v => verts.push(apply(m, v)));
        const idx = prim.indices !== undefined ? accessor(prim.indices) : pos.map((_, i) => i);
        for (let i = 0; i + 2 < idx.length; i += 3) tris.push([base + idx[i], base + idx[i + 1], base + idx[i + 2]]);
      }
    }
    (node.children || []).forEach(c => visit(c, m));
  }
  const sc = json.scenes[json.scene || 0];
  sc.nodes.forEach(n => visit(n, I4()));
  return { verts, tris };
}

/* ── area-weighted surface sampling of a mesh; weight(p) (optional) biases density per triangle ── */
export function sampleMesh(mesh, n, rand, weight) {
  const { verts, tris } = mesh;
  const area = tris.map(([i, j, k]) => {
    const a = verts[i], b = verts[j], c = verts[k];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const ar = 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    return weight ? ar * weight([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]) : ar;
  });
  const cum = new Float64Array(area.length); let tot = 0;
  area.forEach((a, i) => { tot += a; cum[i] = tot; });
  if (!(tot > 0)) throw new Error('model has no surface area');
  const out = [];
  for (let s = 0; s < n; s++) {
    const x = rand() * tot; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < x) lo = mid + 1; else hi = mid; }
    const [i, j, k] = tris[lo], a = verts[i], b = verts[j], c = verts[k];
    let r1 = rand(), r2 = rand(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    out.push([0, 1, 2].map(q => a[q] + r1 * (b[q] - a[q]) + r2 * (c[q] - a[q])));
  }
  return out;
}

/* ── axis swap to Y-up, then centre on the bounding box and scale the largest half-extent to 1 ── */
export function toYUp(pts, axis) {
  if (axis === 'z') return pts.map(p => [p[0], p[2], -p[1]]);
  if (axis === 'x') return pts.map(p => [-p[1], p[0], p[2]]);
  return pts;
}
export function normaliser(pts) {
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  pts.forEach(p => p.forEach((v, k) => { if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }));
  const c = min.map((v, k) => (v + max[k]) / 2), s = Math.max(...max.map((v, k) => v - min[k])) / 2 || 1;
  return p => p.map((v, k) => (v - c[k]) / s);
}

/* ── Morton sort (same as the runtime); extra per-point values ride along ── */
function spread(v) { v &= 0x3ff; v = (v | (v << 16)) & 0x030000ff; v = (v | (v << 8)) & 0x0300f00f; v = (v | (v << 4)) & 0x030c30c3; return (v | (v << 2)) & 0x09249249; }
export function morton(pts, tags) {
  const q = p => p.map(v => Math.min(1023, Math.max(0, Math.floor((v + 1) / 2 * 1023))));
  const order = pts.map((p, i) => { const [a, b, c] = q(p); return { i, k: spread(a) + spread(b) * 2 + spread(c) * 4 }; }).sort((x, y) => x.k - y.k).map(o => o.i);
  return { pts: order.map(i => pts[i]), tags: tags ? order.map(i => tags[i]) : null };
}

/* ── output: Int16 LE x,y,z per point (+-32767), optionally followed by one Uint8 tag per point ── */
export function writeBin(out, pts, tags) {
  const N = pts.length, buf = Buffer.alloc(N * 6 + (tags ? N : 0));
  pts.forEach((p, i) => p.forEach((v, k) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 6 + k * 2)));
  if (tags) tags.forEach((t, i) => buf.writeUInt8(t, N * 6 + i));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  console.log('wrote', out, N, 'points,', buf.length, 'bytes');
}
