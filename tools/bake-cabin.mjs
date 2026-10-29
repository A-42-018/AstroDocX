// Compresses the 3D cabin's raw downloads (assets-src/cabin/, not in git) into app/public/models and app/public/textures.
// Run from app/: node ../tools/bake-cabin.mjs   (needs the @gltf-transform/cli devDependency)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'assets-src/cabin'), models = join(root, 'app/public/models'), textures = join(root, 'app/public/textures')
const tmp = join(root, 'assets-src/.bake')
for (const d of [models, textures, tmp]) mkdirSync(d, { recursive: true })
const gt = (...args) => execFileSync('npx', ['gltf-transform', ...args], { cwd: join(root, 'app'), stdio: ['ignore', 'ignore', 'inherit'] })
const mb = (f) => (statSync(f).size / 1e6).toFixed(2) + ' MB'

/** glTF: optional spec/gloss -> metal/rough, then textures to webp at `size`, meshopt geometry. */
function model(name, out, size, specGloss = false) {
  const input = join(src, name)
  if (!existsSync(input)) return console.log(`skip ${name} (not downloaded)`)
  let cur = input
  if (specGloss) { gt('metalrough', cur, join(tmp, 'mr.glb')); cur = join(tmp, 'mr.glb') }
  gt('optimize', cur, join(models, out), '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(size), '--simplify', 'false', '--instance', 'false')
  console.log(`${out}: ${mb(input)} -> ${mb(join(models, out))}`)
}

/** An image to webp, longest side `size`. */
async function image(input, out, size, quality = 82, flip = false) {
  if (!existsSync(input)) return console.log(`skip ${input} (not downloaded)`)
  const { default: sharp } = await import(createRequire(join(root, 'app/package.json')).resolve('sharp'))
  let img = sharp(input, { limitInputPixels: false }).resize(size, size, { fit: 'inside' })
  if (flip) img = img.flip()
  await img.webp({ quality }).toFile(join(textures, out))
  console.log(`${out}: ${mb(input)} -> ${mb(join(textures, out))}`)
}

model('astronaut-float.glb', 'astronaut-float.glb', 1024, true)
model('iss.glb', 'iss.glb', 512)
await tars()
// Hall surfaces (ambientCG, CC0): color, normal (GL), roughness, at 1K
for (const [dir, key, ext] of [['metalplates', 'MetalPlates006_1K-PNG', 'png'], ['paintedmetal', 'PaintedMetal004_1K-JPG', 'jpg']]) {
  for (const map of ['Color', 'NormalGL', 'Roughness']) await image(join(src, dir, `${key}_${map}.${ext}`), `${dir}_${map.toLowerCase().replace('gl', '')}.webp`, 1024, map === 'NormalGL' ? 90 : 80)
}
// Earth (NASA Visible Earth, public domain): equirectangular 2:1 maps from eoimages.gsfc.nasa.gov, records 57752, 55167 and 57747
for (const [f, out] of [['land_shallow_topo_2048.jpg', 'earth_day.webp'], ['earth_lights_lrg.jpg', 'earth_night.webp'], ['cloud_combined_2048.jpg', 'earth_clouds.webp']]) await image(join(src, f), out, 2048)
// Sharper Earth for desktop: "Earth" by kongle (CC BY-SA 4.0, sketchfab.com/3d-models/earth-63d902b12fd14868b4dc2f19dc21d7c2),
// its 8K texture pulled out of earth.glb (stored upside down, glTF style) and baked at 4K
const earthGlb = join(src, 'earth.glb')
if (existsSync(earthGlb)) {
  const b = readFileSync(earthGlb), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString())
  const bv = j.bufferViews[j.images[0].bufferView], at = 20 + n + 8 + (bv.byteOffset ?? 0)
  writeFileSync(join(tmp, 'earth_8k.jpg'), b.subarray(at, at + bv.byteLength))
  await image(join(tmp, 'earth_8k.jpg'), 'earth_day_4k.webp', 4096, 85, true)
} else console.log('skip earth.glb (not downloaded)')

/**
 * TARS: "TARS Interstellar (Improved)" by THAD (CC BY 4.0, sketchfab.com/3d-models/4648e3edb8cd4b35af57868da5fcb62c).
 * The download is posed with its arm sections out in front and its parts hung on an armature; the arms go, and every
 * other part is baked into one of four slab nodes (slab0..3, left to right), each pivoting at the hinge, so
 * robots.ts only has to swing them. Normalized: 1 unit tall, feet at y = 0, facing +x, slabs stacked along z.
 */
async function tars() {
  const input = join(src, 'tars.glb')
  if (!existsSync(input)) return console.log('skip tars.glb (not downloaded)')
  const req = createRequire(join(root, 'app/package.json'))
  const { NodeIO, getBounds } = req('@gltf-transform/core')
  const { ALL_EXTENSIONS } = req('@gltf-transform/extensions')
  const { transformPrimitive, prune, dedup, join: joinMeshes } = req('@gltf-transform/functions')
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(input), scene = doc.getRoot().getDefaultScene()
  const parts = []
  scene.traverse((n) => { if (n.getMesh()) { const b = getBounds(n); parts.push({ n, c: b.min.map((v, i) => (v + b.max[i]) / 2), b }) } })
  const body = parts.filter((p) => p.c[0] < 1.2) // the arm sections reach out past x = 8
  const min = [0, 1, 2].map((i) => Math.min(...body.map((p) => p.b.min[i]))), max = [0, 1, 2].map((i) => Math.max(...body.map((p) => p.b.max[i])))
  const h = max[1] - min[1], cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, w = (max[2] - min[2]) / 4
  const HINGE = 0.62 // of the height: the slabs swing from just above the middle
  const slabs = [0, 1, 2, 3].map((k) => {
    const mesh = doc.createMesh(`slab${k}`)
    // the mesh hangs on a child: compression folds its own offset and scale into the mesh's node, the pivot stays clean
    const node = doc.createNode(`slab${k}`).setTranslation([0, HINGE, (min[2] + (k + 0.5) * w - cz) / h]).addChild(doc.createNode(`slab${k}-mesh`).setMesh(mesh))
    scene.addChild(node)
    return { node, mesh, z: node.getTranslation()[2] }
  })
  for (const p of body) {
    const k = Math.min(3, Math.max(0, Math.floor((p.c[2] - min[2]) / w))), s = slabs[k]
    // world -> normalized, then into the slab's pivot frame
    const m = p.n.getWorldMatrix(), sc = 1 / h, t = [-cx * sc, -min[1] * sc - HINGE, -cz * sc - s.z]
    const norm = [sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, t[0], t[1], t[2], 1]
    const mat = new Array(16).fill(0)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) mat[c * 4 + r] += norm[i * 4 + r] * m[c * 4 + i]
    for (const prim of p.n.getMesh().listPrimitives()) { transformPrimitive(prim, mat); s.mesh.addPrimitive(prim) }
  }
  for (const n of scene.listChildren()) if (!slabs.some((s) => s.node === n)) n.dispose()
  await doc.transform(prune(), dedup(), joinMeshes({ keepNamed: true }))
  const tmpOut = join(tmp, 'tars-slabs.glb')
  await io.write(tmpOut, doc)
  gt('optimize', tmpOut, join(models, 'tars.glb'), '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '512', '--simplify', 'false', '--instance', 'false', '--flatten', 'false', '--join-named', 'false')
  console.log(`tars.glb: ${mb(input)} -> ${mb(join(models, 'tars.glb'))}`)
}
