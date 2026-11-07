// Bakes VITA's 3D crew doctor into app/public/models/doctor.glb from Microsoft Rocketbox "Medical_Female_02" (MIT,
// github.com/microsoft/Microsoft-Rocketbox): the rigged body with the face shapes VITA uses (visemes for her lips,
// blinks, smile and brows), six motion-capture clips (idle, listen, three talking gestures, think) and the textures.
//
// Source folder (not in git; default assets-src/doctor), laid out as in the Rocketbox repo:
//   Export/Medical_Female_02_facial.fbx     Assets/Avatars/Professions/Medical_Female_02/Export/
//   Textures/f153_*.tga                     .../Medical_Female_02/Textures/
//   Animations/<clip>.max.fbx               Assets/Animations/all_animations_max_motextr_static/
// Run from app/: node ../tools/bake-doctor.mjs [source folder]     (macOS: uses sips to read the TGA textures)
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(root, 'app')
const src = resolve(process.argv[2] ?? join(root, 'assets-src/doctor'))
const out = join(app, 'public/models/doctor.glb')
const tmp = join(root, 'assets-src/.bake/doctor')
mkdirSync(tmp, { recursive: true })
const req = createRequire(join(app, 'package.json'))
const three = (p) => import(pathToFileURL(join(app, 'node_modules/three', p)).href)
const mb = (n) => (n / 1e6).toFixed(2) + ' MB'

// three's FBX loader and glTF exporter, in Node: textures become named placeholders, FileReader reads Blobs
const THREE = await three('build/three.module.js')
const { FBXLoader } = await three('examples/jsm/loaders/FBXLoader.js')
const { GLTFExporter } = await three('examples/jsm/exporters/GLTFExporter.js')
THREE.TextureLoader.prototype.load = function (url) { const t = new THREE.Texture(); t.name = url; return t }
globalThis.FileReader ??= class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.() }) }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type || 'application/octet-stream'};base64,${Buffer.from(r).toString('base64')}`; this.onloadend?.() }) }
}
const quiet = console.warn; console.warn = (...a) => { if (!/TGA loader not found|No target node found/.test(String(a[0]))) quiet(...a) }
const fbx = (file) => { const b = readFileSync(file); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '') }

/* ---------- the body ---------- */
const avatar = fbx(join(src, 'Export/Medical_Female_02_facial.fbx'))
avatar.name = 'doctor'
avatar.scale.setScalar(0.01) // centimetres to metres
let body
avatar.traverse((o) => { if (o.isSkinnedMesh) body = o })
body.name = 'body'
const geo = body.geometry
geo.deleteAttribute('color') // baked vertex colours would darken the textures
// FBX UVs start at the bottom of the image, glTF's at the top: the textures are attached after export, unflipped
const uv = geo.attributes.uv
for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))

// Face shapes: the 15 Oculus visemes for lip-sync, and the ARKit shapes for blinks, smile and brows. The other ~150
// (FACS units, tracker shapes) would add tens of megabytes.
const VISEMES = ['sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U']
const ARKIT = ['EyeBlinkLeft', 'EyeBlinkRight', 'EyeSquintLeft', 'EyeSquintRight', 'JawOpen', 'MouthClose', 'MouthSmileLeft', 'MouthSmileRight',
  'BrowInnerUp', 'BrowOuterUpLeft', 'BrowOuterUpRight', 'BrowDownLeft', 'BrowDownRight']
const dict = body.morphTargetDictionary
const pick = (re) => Object.entries(dict).find(([k]) => re.test(k))?.[1]
const keep = [
  ...VISEMES.map((v, i) => [`viseme_${v}`, pick(new RegExp(`AA_VI_${String(i).padStart(2, '0')}_`))]),
  ...ARKIT.map((a) => [a[0].toLowerCase() + a.slice(1), pick(new RegExp(`AK_\\d\\d_${a}$`))]),
]
const missing = keep.filter(([, i]) => i === undefined).map(([n]) => n)
if (missing.length) throw new Error('face shapes not found: ' + missing.join(', '))
for (const attr of Object.keys(geo.morphAttributes)) geo.morphAttributes[attr] = keep.map(([n, i]) => Object.assign(geo.morphAttributes[attr][i], { name: n }))
body.morphTargetDictionary = Object.fromEntries(keep.map(([n], i) => [n, i]))
body.morphTargetInfluences = keep.map(() => 0)

// Rocketbox ships Phong materials; the console renders PBR. Textures are attached after export, by material name.
body.material = (Array.isArray(body.material) ? body.material : [body.material]).map((m) => {
  const hair = /opacity/.test(m.name)
  return new THREE.MeshStandardMaterial({ name: m.name.replace(/^f153_/, ''), roughness: hair ? 0.6 : 0.75, metalness: 0, transparent: false, alphaTest: hair ? 0.35 : 0, side: hair ? THREE.DoubleSide : THREE.FrontSide })
})

/* ---------- the clips ---------- */
// Body motion only: the face bones stay still (the face shapes move the face), scale keys are constant, and only the
// root (Bip01) keeps its position track (the sway of the hips); every other bone's position is its fixed length.
const CLIPS = [['idle', 'f_idle_breathe_02'], ['listen', 'f_gestic_listen_neutral_01'], ['talk1', 'f_gestic_talk_neutral_01'],
  ['talk2', 'f_gestic_talk_neutral_02'], ['talk3', 'f_gestic_talk_self-assured_01'], ['think', 'f_gestic_thoughtful_01']]
const FACE = /Eye|Jaw|Lip|Tongue|Mouth|Masseter|Caninus|Cheek|Brow|Nose/
const bones = new Set(); avatar.traverse((o) => { if (o.isBone) bones.add(o.name) })
const clips = CLIPS.map(([name, file]) => {
  const c = fbx(join(src, 'Animations', `${file}.max.fbx`)).animations[0]
  c.name = name
  c.tracks = c.tracks.filter((t) => {
    const [bone, prop] = t.name.split('.')
    return bones.has(bone) && !FACE.test(bone) && (prop === 'quaternion' || (prop === 'position' && bone === 'Bip01'))
  })
  const p = c.tracks.find((t) => t.name === 'Bip01.position')
  if (p) { // how far the hips wander, in cm (the figure keeps its feet on the pedestal)
    const r = [0, 1, 2].map((k) => { let lo = Infinity, hi = -Infinity; for (let i = k; i < p.values.length; i += 3) { lo = Math.min(lo, p.values[i]); hi = Math.max(hi, p.values[i]) } return +(hi - lo).toFixed(1) })
    console.log(`clip ${name}: ${c.duration.toFixed(1)} s, ${c.tracks.length} tracks, hips range x/y/z ${r.join(' / ')} cm`)
  }
  return c
})

/* ---------- export, then textures and compression ---------- */
const scene = new THREE.Scene(); scene.add(avatar)
const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations: clips, onlyVisible: false })
const raw = join(tmp, 'doctor-raw.glb'); writeFileSync(raw, Buffer.from(glb))
console.log('exported', mb(glb.byteLength))

const { NodeIO } = req('@gltf-transform/core')
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions')
const { dedup, meshopt, prune, quantize, resample, sparse, textureCompress } = req('@gltf-transform/functions')
const { MeshoptEncoder, MeshoptDecoder } = req('meshoptimizer')
const sharp = req('sharp')
await MeshoptEncoder.ready; await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const doc = await io.readBinary(new Uint8Array(glb))

const png = (name) => {
  const p = join(tmp, `${name}.png`)
  execFileSync('sips', ['-s', 'format', 'png', join(src, 'Textures', `f153_${name}.tga`), '--out', p], { stdio: 'ignore' })
  return readFileSync(p)
}
const tex = (name) => doc.createTexture(name).setImage(png(name)).setMimeType('image/png').setURI(`${name}.png`)
for (const m of doc.getRoot().listMaterials()) {
  const n = m.getName()
  if (n === 'opacity') { m.setBaseColorTexture(tex('opacity_color')).setAlphaMode('MASK').setAlphaCutoff(0.35).setDoubleSided(true); continue }
  const key = n === 'stetoskop' ? 'stetoskop' : n
  m.setBaseColorTexture(tex(`${key}_color`)).setNormalTexture(tex(`${key}_normal`))
  if (n === 'stetoskop') m.setRoughnessFactor(0.45).setMetallicFactor(0.3)
}
await doc.transform(
  prune(), dedup(), resample(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 84 }),
  quantize(), sparse({ ratio: 1 / 3 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
)
writeFileSync(out, await io.writeBinary(doc))
const tris = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0)
console.log(`doctor.glb: ${tris} triangles, ${keep.length} face shapes, ${clips.length} clips -> ${mb(statSync(out).size)}`)
