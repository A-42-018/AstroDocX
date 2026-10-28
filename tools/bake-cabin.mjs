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
