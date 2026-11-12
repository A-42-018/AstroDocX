// Bakes the X-Ray Mirror's anatomy into app/public/xray/models/{head,hand}.glb from BodyParts3D 4.0
// (© DBCLS, CC BY-SA 2.1 JP, dbarchive.biosciencedbc.jp/en/bodyparts3d). Part of the removable X-Ray feature
// (app/src/xray): delete this folder with it.
//
// Source folder (not in git), as downloaded and unzipped from dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST:
//   partof_element_parts.txt   partof/partof_BP3D_4.0_obj_99/FJ*.obj
//   isa_element_parts.txt      isa/isa_BP3D_4.0_obj_99/FJ*.obj
// Run from app/: node ../tools/xray/bake-xray.mjs <source folder>
//
// Coordinates: BodyParts3D is in mm with x to the body's left, y to the back and z up. Here it becomes metres in
// three.js axes: x to the body's left, y up, z to the front (x, z, -y), which is also MediaPipe's canonical face frame.
//
// head.glb: nodes skull, mandible, eyes, brain, neck, plus (when the data has them) teeth, teethLower, skin, eyeMuscles. The origin is between the corneas, so it can sit on the
// tracked eye centres. extras: { eyeDist, hinge, tags } (distance between the corneas; the jaw's hinge point, between the condyles;
// the name tags ({ id, text, layer, p }) measured from the parts, in the same frame).
// hand.glb: a right hand, one node per bone in its own frame (origin at the bone's base, +y along it to its tip,
// +z out of the back of the hand), plus "carpals" in the hand's frame (origin at the wrist, +y towards the third
// knuckle). extras per bone: { len, from? } (its length; for a metacarpal, how far along wrist→knuckle its base sits);
// scene extras: { handLen, dorsalSign } (wrist to third knuckle; which way cross(index − wrist, little − wrist) points).
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const app = join(root, 'app')
const src = resolve(process.argv[2] ?? join(root, 'assets-src/bp3d'))
const outDir = join(app, 'public/xray/models')
mkdirSync(outDir, { recursive: true })
const req = createRequire(join(app, 'package.json'))
const { Document, NodeIO } = req('@gltf-transform/core')
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions')
const { dedup, meshopt, normals, prune, quantize, simplifyPrimitive, weld } = req('@gltf-transform/functions')
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = req('meshoptimizer')
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

/* ---------- reading BodyParts3D ---------- */
const index = (set) => {
  const m = new Map()
  for (const line of readFileSync(join(src, `${set}_element_parts.txt`), 'utf8').split(/\r?\n/).slice(1)) {
    const [, name, file] = line.split('\t')
    if (!file) continue
    if (!m.has(name)) m.set(name, new Set())
    m.get(name).add(file)
  }
  return m
}
const SETS = { partof: index('partof'), isa: index('isa') }
const objPath = (set, id) => join(src, set, `${set}_BP3D_4.0_obj_99`, `${id}.obj`)

/** One OBJ: its English name and triangles, in metres and three.js axes. */
function readObj(set, id) {
  const text = readFileSync(objPath(set, id), 'utf8')
  const v = [], idx = []
  let name = ''
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) { const [, x, y, z] = line.trim().split(/\s+/).map(Number); v.push(x / 1000, z / 1000, -y / 1000) }
    else if (line.startsWith('f ')) {
      const f = line.trim().split(/\s+/).slice(1).map((s) => parseInt(s, 10) - 1)
      for (let i = 1; i < f.length - 1; i++) idx.push(f[0], f[i], f[i + 1])
    } else if (line.startsWith('# English name')) name = line.split(':')[1].trim()
  }
  return { name, pos: new Float32Array(v), idx: new Uint32Array(idx) }
}

/** Like `part`, but an empty list (instead of an error) when the data has no such concept. */
const tryPart = (set, concept, keep) => { try { return part(set, concept, keep) } catch { return [] } }

/** The element files of a concept, from either set, optionally filtered by their English names. */
function part(set, concept, keep = () => true) {
  const files = SETS[set].get(concept)
  if (!files) throw new Error(`${set}: no concept "${concept}"`)
  return [...files].map((id) => readObj(set, id)).filter((o) => keep(o.name))
}
const merge = (objs) => {
  const n = objs.reduce((s, o) => s + o.pos.length, 0), m = objs.reduce((s, o) => s + o.idx.length, 0)
  const pos = new Float32Array(n), idx = new Uint32Array(m)
  let pv = 0, pi = 0
  for (const o of objs) { pos.set(o.pos, pv); for (let i = 0; i < o.idx.length; i++) idx[pi + i] = o.idx[i] + pv / 3; pv += o.pos.length; pi += o.idx.length }
  return { pos, idx }
}
/** Keeps only the triangles whose three corners all pass `keep([x, y, z])`, and drops the vertices nothing uses. */
function cropTris(geo, keep) {
  const { pos, idx } = geo, map = new Map(), np = [], ni = []
  const ok = (v) => keep([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]])
  for (let i = 0; i < idx.length; i += 3) {
    if (!(ok(idx[i]) && ok(idx[i + 1]) && ok(idx[i + 2]))) continue
    for (let k = 0; k < 3; k++) {
      const v = idx[i + k]
      if (!map.has(v)) { map.set(v, np.length / 3); np.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) }
      ni.push(map.get(v))
    }
  }
  return { pos: new Float32Array(np), idx: new Uint32Array(ni) }
}
const centroid = ({ pos }) => { const c = [0, 0, 0]; for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) c[k] += pos[i + k]; return c.map((x) => x / (pos.length / 3)) }

/* ---------- small vector maths ---------- */
const sub = (a, b) => a.map((x, i) => x - b[i])
const add = (a, b) => a.map((x, i) => x + b[i])
const mul = (a, s) => a.map((x) => x * s)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const len = (a) => Math.hypot(...a)
const norm = (a) => mul(a, 1 / len(a))
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const r4 = (a) => a.map((x) => +x.toFixed(4))

/** The long axis of a bone (power iteration on its covariance) and its two ends along it. */
function axisOf(geo) {
  const c = centroid(geo), p = geo.pos, n = p.length / 3
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < p.length; i += 3) { const d = [p[i] - c[0], p[i + 1] - c[1], p[i + 2] - c[2]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b] / n }
  let v = [0.3, 0.8, 0.5]
  for (let k = 0; k < 60; k++) v = norm([dot(C[0], v), dot(C[1], v), dot(C[2], v)])
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < p.length; i += 3) { const t = dot(sub([p[i], p[i + 1], p[i + 2]], c), v); lo = Math.min(lo, t); hi = Math.max(hi, t) }
  return { a: add(c, mul(v, lo)), b: add(c, mul(v, hi)), c }
}
/** Moves a geometry into a frame (origin o, axes x y z, all unit and at right angles). */
function toFrame(geo, o, x, y, z) {
  const p = geo.pos, out = new Float32Array(p.length)
  for (let i = 0; i < p.length; i += 3) { const d = [p[i] - o[0], p[i + 1] - o[1], p[i + 2] - o[2]]; out[i] = dot(d, x); out[i + 1] = dot(d, y); out[i + 2] = dot(d, z) }
  return { pos: out, idx: geo.idx }
}
const shift = (geo, o) => toFrame(geo, o, [1, 0, 0], [0, 1, 0], [0, 0, 1])

/* ---------- writing glTF ---------- */
async function write(file, nodes, extras, ratio) {
  const doc = new Document()
  const buf = doc.createBuffer()
  const scene = doc.createScene('xray').setExtras(extras)
  for (const { name, geo, extras: e, ratio: r } of nodes) {
    if (!geo || !geo.pos.length) { console.log(`skipping ${name}: no triangles`); continue }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(geo.pos).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(geo.idx).setBuffer(buf))
    const mesh = doc.createMesh(name).addPrimitive(prim)
    mesh.setExtras({ ratio: r ?? ratio })
    scene.addChild(doc.createNode(name).setMesh(mesh).setExtras(e ?? {}))
  }
  await doc.transform(weld())
  // each mesh keeps its own share of triangles (a phalanx needs few, the skull many)
  for (const mesh of doc.getRoot().listMeshes()) {
    const r = mesh.getExtras().ratio
    for (const prim of mesh.listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: r, error: 0.001 })
    mesh.setExtras({})
  }
  // normals() leaves the triangles unindexed: weld again before compressing
  await doc.transform(normals({ overwrite: true }), weld(), prune(), dedup(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const path = join(outDir, file)
  writeFileSync(path, await io.writeBinary(doc))
  const tris = doc.getRoot().listMeshes().map((m) => `${m.getName()} ${m.listPrimitives().reduce((a, p) => a + (p.getIndices() ?? p.getAttribute('POSITION')).getCount() / 3, 0)}`)
  console.log(`${file}: ${(statSync(path).size / 1e6).toFixed(2)} MB — ${tris.join(', ')}`)
}

/* ---------- the head ---------- */
const BONES = /bone|ethmoid|maxilla|vomer|concha|sphenoid|occipital|parietal|temporal|frontal|palatine|lacrimal|zygomatic|nasal/i
const cranium = [...part('partof', 'neurocranium'), ...part('partof', 'viscerocranium', (n) => BONES.test(n) && !/hyoid|mandible/i.test(n))]
const seen = new Set(), skull = merge(cranium.filter((o) => (seen.has(o.name) ? false : seen.add(o.name))))
const mandible = merge(part('partof', 'mandible'))
const cornea = (side) => centroid(merge(part('partof', 'viscerocranium', (n) => n === `${side} cornea`)))
const cL = cornea('Left'), cR = cornea('Right')
const origin = mul(add(cL, cR), 0.5)
const eyeObjs = part('partof', 'viscerocranium', (n) => /sclera|cornea|iris|lens/i.test(n))
const eyes = merge(eyeObjs)
const GYRI = (n) => !/white matter|internal capsule|ventricle|hippocampus|parahippocampal|cingulate|insula|fusiform/i.test(n)
const brainObjs = [
  ...part('partof', 'left cerebral hemisphere', GYRI), ...part('partof', 'right cerebral hemisphere', GYRI),
  ...part('isa', 'cerebellum'), ...part('partof', 'pons'), ...part('partof', 'medulla oblongata'),
]
const brain = merge(brainObjs)
const sternos = [...part('isa', 'right sternocleidomastoid'), ...part('isa', 'left sternocleidomastoid')]
const neck = merge([...sternos, ...tryPart('isa', 'right platysma'), ...tryPart('isa', 'left platysma')])

// the hinge: the tops of the two condyles (the jaw's highest points at its back)
let top = -Infinity; for (let i = 1; i < mandible.pos.length; i += 3) top = Math.max(top, mandible.pos[i])
const condyle = []; for (let i = 0; i < mandible.pos.length; i += 3) if (mandible.pos[i + 1] > top - 0.006 && mandible.pos[i + 2] < origin[2] - 0.04) condyle.push(mandible.pos[i], mandible.pos[i + 1], mandible.pos[i + 2])
const hinge = sub(centroid({ pos: condyle }), origin)

// teeth: the secondary (adult) teeth, upper ones follow the skull and lower ones the jaw
const toothNames = [...SETS.isa.keys()].filter((n) => /secondary .*tooth$/i.test(n))
const teethOf = (re) => merge(toothNames.filter((n) => re.test(n)).flatMap((n) => part('isa', n)))
const hasTeeth = toothNames.length > 0
const teeth = hasTeeth ? teethOf(/\bupper\b/i) : null
const teethLower = hasTeeth ? teethOf(/\blower\b/i) : null
// skin: the whole-body skin cut down to the head (everything above the collarbones), the head's outline
const skinAll = merge(tryPart('partof', 'skin'))
const skin = skinAll.pos.length ? cropTris(shift(skinAll, origin), ([, y]) => y > -0.12) : null
// the eye's own muscles (the data has no chewing or expression muscles: those come from the tracked face mesh)
const eyeMuscleObjs = tryPart('isa', 'muscle of head', (n) => /rectus|oblique|levator palpebrae/i.test(n))
const eyeMuscles = eyeMuscleObjs.length ? merge(eyeMuscleObjs) : null

// where the name tags point (head frame, metres): the centre of a named part, from the left side where there is one
const inHead = (objs) => (objs.length ? r4(sub(centroid(merge(objs)), origin)) : null)
const named = (objs, re) => objs.filter((o) => re.test(o.name))
const leftHalf = (g) => { const k = []; for (let i = 0; i < g.pos.length; i += 3) if (g.pos[i] > origin[0]) k.push(g.pos[i], g.pos[i + 1], g.pos[i + 2]); return { pos: new Float32Array(k), idx: new Uint32Array(0) } }
const TAGS = [
  ['frontal-bone', 'Frontal bone', 'skull', named(cranium, /^Frontal bone/)],
  ['parietal-bone', 'Parietal bone', 'skull', named(cranium, /^Left parietal bone/)],
  ['temporal-bone', 'Temporal bone', 'skull', named(cranium, /^Left temporal bone/)],
  ['occipital-bone', 'Occipital bone', 'skull', named(cranium, /^Occipital bone/)],
  ['nasal-bone', 'Nasal bone', 'skull', named(cranium, /^Left nasal bone/)],
  ['zygomatic-bone', 'Zygomatic bone (cheekbone)', 'skull', named(cranium, /^Left zygomatic bone/)],
  ['maxilla', 'Maxilla (upper jaw)', 'skull', named(cranium, /^Left maxilla/)],
  ['frontal-lobe', 'Frontal lobe', 'brain', named(brainObjs, /^Left (superior|middle|inferior) frontal gyrus|^Left precentral/)],
  ['parietal-lobe', 'Parietal lobe', 'brain', named(brainObjs, /^Left (superior parietal|postcentral|supramarginal|angular)/)],
  ['temporal-lobe', 'Temporal lobe', 'brain', named(brainObjs, /^Left (middle|inferior) temporal/)],
  ['occipital-lobe', 'Occipital lobe', 'brain', named(brainObjs, /^Left occipital/)],
  ['cerebellum', 'Cerebellum', 'brain', named(brainObjs, /^Cerebellum/)],
  ['eyeball', 'Eyeball', 'eyes', named(eyeObjs, /^Left sclera/)],
  ['sternocleidomastoid', 'Sternocleidomastoid', 'muscles', named(sternos, /^Left /)],
]
const tags = []
for (const [id, text, layer, objs] of TAGS) { const p = inHead(objs); if (p) tags.push({ id, text, layer, p }); else console.log(`no part for tag ${id}`) }
if (teeth) tags.push({ id: 'teeth', text: 'Teeth', layer: 'skull', p: inHead([teeth]) })
{
  const m = mandible.pos.length ? r4(sub(centroid(leftHalf(shift(mandible, [0, 0, 0]))), origin)) : null
  if (m) tags.push({ id: 'mandible', text: 'Mandible (lower jaw)', layer: 'skull', p: m })
}

await write('head.glb', [
  { name: 'skull', geo: shift(skull, origin), ratio: 0.5 },
  { name: 'mandible', geo: shift(mandible, origin), ratio: 0.8 },
  { name: 'eyes', geo: shift(eyes, origin), ratio: 0.1 },
  { name: 'brain', geo: shift(brain, origin), ratio: 0.4 },
  { name: 'neck', geo: shift(neck, origin), ratio: 0.5 },
  { name: 'teeth', geo: teeth && shift(teeth, origin), ratio: 0.15 },
  { name: 'teethLower', geo: teethLower && shift(teethLower, origin), ratio: 0.15 },
  { name: 'skin', geo: skin, ratio: 0.04 },
  { name: 'eyeMuscles', geo: eyeMuscles && shift(eyeMuscles, origin), ratio: 0.5 },
], { eyeDist: +len(sub(cL, cR)).toFixed(5), hinge: r4(hinge), tags }, 0.5)

/* ---------- the right hand ---------- */
const FINGERS = ['thumb', 'index finger', 'middle finger', 'ring finger', 'little finger']
const ORD = ['first', 'second', 'third', 'fourth', 'fifth']
const one = (concept) => merge(part('partof', concept))
const CARPALS = ['right scaphoid', 'right lunate', 'right triquetral', 'right pisiform', 'right trapezium', 'right capitate', 'right hamate']
const carpals = merge(CARPALS.map((c) => part('partof', c)).flat())
const mc = ORD.map((o) => one(`right ${o} metacarpal bone`))
const carpusC = centroid(carpals)
// a bone's base is the end nearer the carpus
const ends = (geo) => { const { a, b } = axisOf(geo); return len(sub(a, carpusC)) < len(sub(b, carpusC)) ? [a, b] : [b, a] }
const mcEnds = mc.map(ends)
const knuckle3 = mcEnds[2][1]
const handY = norm(sub(knuckle3, carpusC))
// the wrist crease: the carpus's end nearest the forearm along the hand
let lo = Infinity; for (let i = 0; i < carpals.pos.length; i += 3) lo = Math.min(lo, dot(sub([carpals.pos[i], carpals.pos[i + 1], carpals.pos[i + 2]], carpusC), handY))
const wrist = add(carpusC, mul(handY, lo))
const DORSAL = [0, 0, -1] // the back of the hand, with the palm forwards
const frame = (o, tip) => {
  const y = norm(sub(tip, o)), z = norm(sub(DORSAL, mul(y, dot(DORSAL, y)))), x = cross(y, z)
  return [o, x, y, z]
}
const handLen = len(sub(knuckle3, wrist))
const dorsalSign = Math.sign(dot(cross(sub(mcEnds[1][1], wrist), sub(mcEnds[4][1], wrist)), DORSAL))
const nodes = [{ name: 'carpals', geo: toFrame(carpals, ...frame(wrist, knuckle3)), ratio: 0.6, extras: { len: +handLen.toFixed(5) } }]
const bone = (name, geo, extras = {}) => {
  const [a, b] = ends(geo)
  nodes.push({ name, geo: toFrame(geo, ...frame(a, b)), ratio: 0.6, extras: { len: +len(sub(b, a)).toFixed(5), ...extras } })
  return [a, b]
}
mc.forEach((g, i) => {
  const [a, b] = mcEnds[i]
  bone(`mc${i + 1}`, g, i ? { from: +(len(sub(a, wrist)) / len(sub(b, wrist))).toFixed(4) } : {})
})
FINGERS.forEach((f, i) => {
  bone(`pp${i + 1}`, one(`proximal phalanx of right ${f}`))
  if (i) bone(`mp${i + 1}`, one(`middle phalanx of right ${f}`))
  bone(`dp${i + 1}`, one(`distal phalanx of right ${f}`))
})
await write('hand.glb', nodes, { handLen: +handLen.toFixed(5), dorsalSign }, 0.6)
