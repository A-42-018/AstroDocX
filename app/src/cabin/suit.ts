import * as THREE from 'three'

/*
 * Suit patches, as on the Apollo and ISS suits: the NASA "meatball" on the right chest and the US flag on the left
 * upper arm. Each is drawn on a canvas and wrapped onto the suit in its bind pose (a grid of rays, like a decal); every
 * vertex takes the skin weights of the fabric under it, so the patch bends with the sleeve through the float loop and
 * is copied with every clone of the astronaut.
 */

/** NASA insignia blue and vector red. */
const NASA_BLUE = '#0b3d91', NASA_RED = '#fc3d21'
/** Flag blue and red. */
const OLD_GLORY_BLUE = '#3c3b6e', OLD_GLORY_RED = '#b22234'

/** The NASA insignia: blue disc, stars, a white orbit and the red vector through "NASA". */
function drawMeatball(): HTMLCanvasElement {
  const n = 512, r = n / 2, c = document.createElement('canvas'); c.width = c.height = n
  const g = c.getContext('2d')!
  g.beginPath(); g.arc(r, r, r - 2, 0, Math.PI * 2); g.fillStyle = '#f2f2ee'; g.fill() // the patch's stitched edge
  g.save(); g.beginPath(); g.arc(r, r, r - 18, 0, Math.PI * 2); g.fillStyle = NASA_BLUE; g.fill(); g.clip()
  g.fillStyle = '#fff'
  const stars: [number, number, number][] = [[0.3, 0.28, 5], [0.42, 0.18, 3], [0.66, 0.22, 4], [0.76, 0.36, 3], [0.22, 0.48, 3], [0.36, 0.72, 4], [0.58, 0.8, 3], [0.8, 0.66, 5], [0.7, 0.74, 3], [0.18, 0.62, 3]]
  for (const [x, y, s] of stars) { g.beginPath(); g.arc(x * n, y * n, s * 1.6, 0, Math.PI * 2); g.fill() }
  // the orbit: a tilted white ellipse around the lettering
  g.save(); g.translate(r, r * 1.02); g.rotate(-0.38); g.strokeStyle = '#fff'; g.lineWidth = 9
  g.beginPath(); g.ellipse(0, 0, r * 0.82, r * 0.28, 0, 0, Math.PI * 2); g.stroke(); g.restore()
  // the vector: a red chevron swept from lower left to upper right
  g.fillStyle = NASA_RED
  g.beginPath(); g.moveTo(n * 0.06, n * 0.8); g.quadraticCurveTo(n * 0.45, n * 0.5, n * 0.98, n * 0.2); g.lineTo(n * 0.6, n * 0.48)
  g.lineTo(n * 0.66, n * 0.5); g.quadraticCurveTo(n * 0.4, n * 0.62, n * 0.06, n * 0.8); g.fill()
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `italic 900 ${n * 0.25}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  g.fillText('NASA', r, r * 1.03)
  g.restore()
  return c
}

/** The flag: thirteen stripes, fifty stars in nine alternating rows, on a white patch border. */
function drawFlag(): HTMLCanvasElement {
  const w = 760, h = 400, m = 12, c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h)
  const fw = w - m * 2, fh = h - m * 2, sh = fh / 13
  for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : OLD_GLORY_RED; g.fillRect(m, m + i * sh, fw, sh + 0.5) }
  const cw = fw * 0.4, ch = sh * 7
  g.fillStyle = OLD_GLORY_BLUE; g.fillRect(m, m, cw, ch)
  g.fillStyle = '#fff'
  for (let row = 0; row < 9; row++) for (let col = 0; col < 11; col++) {
    if ((row + col) % 2) continue // 6 stars on even rows, 5 on odd ones, offset
    const x = m + (col + 1) * cw / 12, y = m + (row + 1) * ch / 10, s = ch * 0.032
    g.beginPath()
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.4 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) }
    g.fill()
  }
  return c
}

interface Patch {
  canvas: () => HTMLCanvasElement
  /** Size in metres on a 2.1 m astronaut: across, then up. */
  size: [number, number]
  /** A point inside the suit under the patch's centre, and the direction it faces out of the suit (model space, +z forward, +x the astronaut's left). */
  at: [number, number, number]
  out: [number, number, number]
  /** Which way is up on the patch. */
  up: [number, number, number]
  /** Wrapped round a limb whose axis runs through `at` along `up` (rays aimed at the axis), not laid on a flat front. */
  wrap?: boolean
}

const PATCHES: Patch[] = [
  // right chest, clear of the chest pack
  { canvas: drawMeatball, size: [0.11, 0.11], at: [-0.17, 0.54, 0], out: [-0.3, 0.1, 1], up: [0, 1, 0] },
  // left upper arm: stripes across the arm, the canton forward and toward the shoulder, facing out and forward when the arm hangs
  { canvas: drawFlag, size: [0.17, 0.09], at: [0.42, 0.627, -0.03], out: [0, 0.6, 0.8], up: [-1, -0.03, 0.04], wrap: true },
]

/** Grid of rays per patch: fine enough that the fabric's creases do not poke through between them. */
const COLS = 18, ROWS = 11
/** How far the patch sits off the fabric, metres: clear of the creases, too thin to see edge-on. */
const LIFT = 0.007
/** A ray hit further than this from the centre's depth is something else (the shoulder, a hose): the patch skips it. Round a limb the depth barely changes. */
const SNAG = 0.05, SNAG_WRAP = 0.02

/** Margin round a patch's footprint in which the suit's triangles are kept for the rays, metres; a wrapped patch's limb is at least `LIMB` thick. */
const MARGIN = 0.02, LIMB = 0.06

/** Wraps the patches onto `root` (the astronaut in bind pose, 2.1 m tall and centred on the origin), each skinned to the suit's skeleton. */
export function addPatches(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const suits: THREE.SkinnedMesh[] = []
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) suits.push(o as THREE.SkinnedMesh) })
  // In bind pose a suit vertex v sits at bone.matrixWorld * boneInverse * bindMatrix * v (the same for every bone): the rays go
  // through static copies of the vertices placed that way, read once, so no ray pays for skinning or the file's quantized numbers.
  const bindPose = new Map(suits.map((m) => {
    const toWorld = m.skeleton.bones[0].matrixWorld.clone().multiply(m.skeleton.boneInverses[0]).multiply(m.bindMatrix)
    const src = m.geometry.attributes.position, xyz = new Float32Array(src.count * 3), v = new THREE.Vector3()
    for (let i = 0; i < src.count; i++) v.fromBufferAttribute(src, i).applyMatrix4(toWorld).toArray(xyz, i * 3)
    return [m, { xyz: new THREE.BufferAttribute(xyz, 3), toSuit: toWorld.invert() }]
  }))
  const ray = new THREE.Raycaster(), o = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3()
  /** The fabric of `on` along the ray, near `depth` when given. */
  const cast = (from: THREE.Vector3, dir: THREE.Vector3, on: THREE.Object3D[], depth?: number, snag = SNAG) => {
    ray.set(from, dir)
    return ray.intersectObjects(on, false).find((h) => depth === undefined || Math.abs(h.distance - depth) < snag)
  }
  for (const patch of PATCHES) {
    const at = new THREE.Vector3(...patch.at), out = new THREE.Vector3(...patch.out).normalize()
    const right = new THREE.Vector3(...patch.up).cross(out).normalize(), up = out.clone().cross(right)
    const [w, h] = patch.size, into = out.clone().negate(), radial = new THREE.Vector3()
    /** Whether `v` lies under the patch's footprint (seen along its rays). */
    const under = (v: THREE.Vector3) => {
      v.sub(at)
      if (Math.abs(v.dot(up)) > h / 2 + MARGIN) return false
      return patch.wrap ? Math.abs(Math.atan2(v.dot(right), v.dot(out))) < (w / 2 + MARGIN) / LIMB : Math.abs(v.dot(right)) < w / 2 + MARGIN
    }
    // the suit's triangles under the patch, same vertex numbering, so a hit's face still indexes the suit's skin weights
    const near = suits.map((suit) => {
      const { xyz } = bindPose.get(suit)!, tri = suit.geometry.index?.array, n = tri ? tri.length : xyz.count, keep: number[] = []
      for (let t = 0; t < n; t += 3) {
        const a = tri ? tri[t] : t
        if (under(p.fromBufferAttribute(xyz, a))) keep.push(a, tri ? tri[t + 1] : t + 1, tri ? tri[t + 2] : t + 2)
      }
      const proxy = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', xyz).setIndex(keep))
      proxy.geometry.boundingSphere = new THREE.Sphere(at, 1) // loose, but saves measuring the whole suit
      proxy.userData.suit = suit
      return proxy
    }).filter((x) => x.geometry.index!.count > 0)
    const centre = cast(o.copy(at).addScaledVector(out, 0.6), into, near)
    if (!centre) { console.warn('cabin: a suit patch missed the suit'); continue }
    const suit = centre.object.userData.suit as THREE.SkinnedMesh, proxy = centre.object, { xyz, toSuit } = bindPose.get(suit)!
    /** Skin at `hit`: the weights of its triangle's corners blended by where it landed, the four strongest bones kept. */
    const skinAt = (hit: THREE.Intersection) => {
      const f = hit.face!, corners = [f.a, f.b, f.c], si = suit.geometry.attributes.skinIndex, sw = suit.geometry.attributes.skinWeight
      const [pa, pb, pc] = corners.map((i) => new THREE.Vector3().fromBufferAttribute(xyz, i))
      const bary = THREE.Triangle.getBarycoord(hit.point, pa, pb, pc, q)?.toArray() ?? [1 / 3, 1 / 3, 1 / 3]
      const sum = new Map<number, number>()
      corners.forEach((i, c) => { for (let k = 0; k < 4; k++) { const b = si.getComponent(i, k); sum.set(b, (sum.get(b) ?? 0) + sw.getComponent(i, k) * bary[c]) } })
      const top = [...sum].sort((x, y) => y[1] - x[1]).slice(0, 4), total = top.reduce((t, x) => t + x[1], 0) || 1
      while (top.length < 4) top.push([0, 0])
      return top.map(([b, w]) => [b, w / total])
    }
    const centreSkin = skinAt(centre), r = 0.6 - centre.distance // a wrapped patch's radius round the limb
    const pos: number[] = [], uv: number[] = [], skinIndex: number[] = [], skinWeight: number[] = [], index: number[] = []
    for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) {
      const u = i / COLS, v = j / ROWS
      if (patch.wrap) { const a = (u - 0.5) * w / r; radial.copy(out).multiplyScalar(Math.cos(a)).addScaledVector(right, Math.sin(a)) }
      else radial.copy(out)
      o.copy(at).addScaledVector(up, (v - 0.5) * h).addScaledVector(radial, 0.6)
      if (!patch.wrap) o.addScaledVector(right, (u - 0.5) * w)
      radial.negate()
      // only the centre's piece of suit (a sleeve, not the shoulder beside it); nothing near: stay level with the centre
      const hit = cast(o, radial, [proxy], centre.distance, patch.wrap ? SNAG_WRAP : SNAG)
      p.copy(o).addScaledVector(radial, (hit?.distance ?? centre.distance) - LIFT).applyMatrix4(toSuit)
      pos.push(p.x, p.y, p.z); uv.push(u, v)
      for (const [b, wt] of hit ? skinAt(hit) : centreSkin) { skinIndex.push(b); skinWeight.push(wt) }
      if (i < COLS && j < ROWS) { const a = j * (COLS + 1) + i, b = a + COLS + 1; index.push(a, a + 1, b, b, a + 1, b + 1) }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
    geo.setIndex(index); geo.computeVertexNormals()
    const map = new THREE.CanvasTexture(patch.canvas()); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }))
    mesh.name = 'suit-patch'
    mesh.position.copy(suit.position); mesh.quaternion.copy(suit.quaternion); mesh.scale.copy(suit.scale)
    suit.parent!.add(mesh); mesh.bind(suit.skeleton, suit.bindMatrix) // beside the suit, on its skeleton: SkeletonUtils.clone rebinds both
  }
}
