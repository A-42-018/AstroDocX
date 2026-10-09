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
                  node transforms. Not supported: meshopt compression, sparse accessors. Draco: decode
                  first with tools/undraco.mjs.
   --earth-mask   equirectangular BMP (8- or 24-bit); bright = land. Make one from a
                  NASA Blue Marble / land-mask image with: sips -s format bmp in.png --out mask.bmp
   --axis         which model axis points "up" in the source (default y). Output is Y-up.

   Output  <out>  Int16 little-endian x,y,z per point, N points, normalised so the
                  largest extent is +-32767 (runtime divides by 32767), Morton-sorted so
                  particle i sits in the same region in every shape.
   The .glb files are inputs only. They never ship to the browser.
============================================================ */
import { readFileSync } from 'node:fs';
import { parseArgs, rng, readGlbMesh, sampleMesh, toYUp, normaliser, morton, writeBin } from './particles-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const N = +args.n || 24000;
if (!args.out || !(args.glb || args['earth-mask'])) {
  console.error('usage: bake-particles.mjs (--glb model.glb | --earth-mask mask.bmp) --out file.bin [--n 24000]');
  process.exit(1);
}
const rand = rng(+args.seed || 1);

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

/* ── run ── */
let pts;
if (args.glb) {
  const mesh = readGlbMesh(args.glb);
  console.log('triangles:', mesh.tris.length);
  pts = toYUp(sampleMesh(mesh, N, rand), args.axis || 'y');
  pts = pts.map(normaliser(pts));
} else {
  pts = earthPoints(args['earth-mask'], N);                                          // already a unit sphere, keep its scale
}
writeBin(args.out, morton(pts).pts);
