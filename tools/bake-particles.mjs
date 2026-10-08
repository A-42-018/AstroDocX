#!/usr/bin/env node
/* ============================================================
   AstroDocX — particle target baker (plan §12.5)
   No dependencies. Turns a 3D model (or a land mask) into a
   compact point cloud the landing intro morphs between.

   Usage
     node tools/bake-particles.mjs --glb model.glb --out landing/universe/targets/orion.bin
         [--n 24000] [--axis y|x|z] [--weight-by-area|--uniform] [--seed 1]
     node tools/bake-particles.mjs --earth-mask landmask.bmp --out landing/universe/targets/earth.bin
         [--n 24000] [--ocean 0.22] [--cloud 0.04]

   --glb          binary glTF (.glb). Meshes of every node are sampled with their
                  node transforms. Not supported: Draco / meshopt compression, sparse accessors.
   --earth-mask   equirectangular BMP (8- or 24-bit); bright = land. Make one from a
                  NASA Blue Marble / land-mask image with: sips -s format bmp in.png --out mask.bmp
   --axis         which model axis points "up" in the source (default y). Output is Y-up.

   Output  <out>  Int16 little-endian x,y,z per point, N points, normalised so the
                  largest extent is +-32767 (runtime divides by 32767), Morton-sorted so
                  particle i sits in the same region in every shape.
   The .glb files are inputs only. They never ship to the browser.
============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const N = +args.n || 24000;
if (!args.out || !(args.glb || args['earth-mask'])) {
  console.error('usage: bake-particles.mjs (--glb model.glb | --earth-mask mask.bmp) --out file.bin [--n 24000]');
  process.exit(1);
}

/* deterministic PRNG */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(+args.seed || 1);

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

/* ── minimal GLB reader: returns world-space triangles [{a,b,c}] ── */
const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function readGlbTriangles(file) {
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
  if ((json.extensionsRequired || []).some(e => /draco|meshopt/i.test(e))) throw new Error('compressed GLB (' + json.extensionsRequired + ') is not supported; export it uncompressed');

  function accessor(i) {
    const acc = json.accessors[i], bv = json.bufferViews[acc.bufferView], [T, size] = COMP[acc.componentType], n = NCOMP[acc.type];
    if (acc.sparse) throw new Error('sparse accessors are not supported');
    const stride = bv.byteStride || size * n, base = (bv.byteOffset || 0) + (acc.byteOffset || 0), out = new Array(acc.count);
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const get = { 5126: (o) => dv.getFloat32(o, true), 5125: (o) => dv.getUint32(o, true), 5123: (o) => dv.getUint16(o, true), 5122: (o) => dv.getInt16(o, true), 5121: (o) => dv.getUint8(o), 5120: (o) => dv.getInt8(o) }[acc.componentType];
    for (let k = 0; k < acc.count; k++) { const r = []; for (let c = 0; c < n; c++) r.push(get(base + k * stride + c * size)); out[k] = n === 1 ? r[0] : r; }
    return out;
  }
  const tris = [];
  function visit(ni, parent) {
    const node = json.nodes[ni], m = mul(parent, node.matrix || trs(node.translation, node.rotation, node.scale));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives) {
        if (prim.mode !== undefined && prim.mode !== 4) continue;                  // triangles only
        const pos = accessor(prim.attributes.POSITION).map(v => apply(m, v));
        const idx = prim.indices !== undefined ? accessor(prim.indices) : pos.map((_, i) => i);
        for (let i = 0; i + 2 < idx.length; i += 3) tris.push({ a: pos[idx[i]], b: pos[idx[i + 1]], c: pos[idx[i + 2]] });
      }
    }
    (node.children || []).forEach(c => visit(c, m));
  }
  const sc = json.scenes[json.scene || 0];
  sc.nodes.forEach(n => visit(n, I4()));
  return tris;
}

/* ── sampling ── */
function sampleTriangles(tris, n) {
  const area = tris.map(t => {
    const u = [t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]], v = [t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]];
    return 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  });
  const cum = new Float64Array(area.length); let tot = 0;
  area.forEach((a, i) => { tot += a; cum[i] = tot; });
  if (!(tot > 0)) throw new Error('model has no surface area');
  const out = [];
  for (let k = 0; k < n; k++) {
    const x = rand() * tot; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < x) lo = mid + 1; else hi = mid; }
    const t = tris[lo]; let r1 = rand(), r2 = rand(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    out.push([0, 1, 2].map(c => t.a[c] + r1 * (t.b[c] - t.a[c]) + r2 * (t.c[c] - t.a[c])));
  }
  return out;
}

/* ── minimal BMP reader (8-bit palette or 24/32-bit): returns {w,h,lum(x,y) 0..1} ── */
function readBmp(file) {
  const b = readFileSync(file);
  if (b.toString('latin1', 0, 2) !== 'BM') throw new Error('not a BMP');
  const dataOff = b.readUInt32LE(10), w = b.readInt32LE(18), hh = b.readInt32LE(22), bpp = b.readUInt16LE(28), h = Math.abs(hh), top = hh < 0;
  if (b.readUInt32LE(30) !== 0) throw new Error('compressed BMP not supported');
  const rowBytes = Math.ceil(w * bpp / 32) * 4, palOff = 14 + b.readUInt32LE(14);
  return {
    w, h, lum(x, y) {
      const row = top ? y : h - 1 - y, o = dataOff + row * rowBytes;
      if (bpp === 8) { const p = palOff + b[o + x] * 4; return (b[p] + b[p + 1] + b[p + 2]) / 765; }
      if (bpp === 24 || bpp === 32) { const q = o + x * (bpp / 8); return (b[q] + b[q + 1] + b[q + 2]) / 765; }
      throw new Error('BMP must be 8, 24 or 32 bit');
    }
  };
}
function earthPoints(file, n) {
  const img = readBmp(file), ocean = args.ocean !== undefined ? +args.ocean : 0.22, cloud = args.cloud !== undefined ? +args.cloud : 0.04, out = [];
  const cn = Math.floor(n * cloud); let guard = 0;
  while (out.length < n - cn && guard++ < n * 60) {
    const y = 1 - 2 * rand(), th = rand() * 2 * Math.PI, r = Math.sqrt(1 - y * y);
    const lat = Math.asin(y), lon = th - Math.PI;                                   // longitude -pi..pi
    const px = Math.min(img.w - 1, Math.floor((lon + Math.PI) / (2 * Math.PI) * img.w)), py = Math.min(img.h - 1, Math.floor((0.5 - lat / Math.PI) * img.h));
    const land = img.lum(px, py) > 0.5;
    if (land || rand() < ocean) out.push([Math.cos(th) * r * 0.8, y * 0.8, Math.sin(th) * r * 0.8]);
  }
  for (let k = out.length; k < n; k++) { const y = 1 - 2 * rand(), th = rand() * 2 * Math.PI, r = Math.sqrt(1 - y * y); out.push([Math.cos(th) * r * 0.85, y * 0.85, Math.sin(th) * r * 0.85]); }
  return out;
}

/* ── normalise to a unit box centred on the bounding box, Y-up ── */
function normalise(pts, axis) {
  if (axis === 'z') pts = pts.map(p => [p[0], p[2], -p[1]]);
  else if (axis === 'x') pts = pts.map(p => [-p[1], p[0], p[2]]);
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  pts.forEach(p => p.forEach((v, k) => { if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }));
  const c = min.map((v, k) => (v + max[k]) / 2), s = Math.max(...max.map((v, k) => v - min[k])) / 2 || 1;
  return pts.map(p => p.map((v, k) => (v - c[k]) / s));
}

/* ── Morton sort (same as the runtime) ── */
function spread(v) { v &= 0x3ff; v = (v | (v << 16)) & 0x030000ff; v = (v | (v << 8)) & 0x0300f00f; v = (v | (v << 4)) & 0x030c30c3; return (v | (v << 2)) & 0x09249249; }
function morton(pts) {
  const q = p => p.map(v => Math.min(1023, Math.max(0, Math.floor((v + 1) / 2 * 1023))));
  return pts.map(p => { const [a, b, c] = q(p); return { p, k: spread(a) + spread(b) * 2 + spread(c) * 4 }; }).sort((x, y) => x.k - y.k).map(o => o.p);
}

/* ── run ── */
let pts;
if (args.glb) {
  const tris = readGlbTriangles(args.glb);
  console.log('triangles:', tris.length);
  pts = sampleTriangles(tris, N);
  pts = normalise(pts, args.axis || 'y');
} else {
  pts = earthPoints(args['earth-mask'], N);                                          // already a unit sphere, keep its scale
}
pts = morton(pts);
const buf = Buffer.alloc(N * 6);
pts.forEach((p, i) => p.forEach((v, k) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 6 + k * 2)));
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, buf);
console.log('wrote', args.out, N, 'points,', buf.length, 'bytes');
