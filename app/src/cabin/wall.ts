import * as THREE from 'three'
import { HALF } from './hall'

/**
 * The triangles of `root` (in world space) whose bounds touch `box`, as one mesh to raycast against. Faces keep their
 * winding, so rays still pass through back faces as they do on the hall itself.
 */
export function wallPatch(root: THREE.Object3D, box: THREE.Box3) {
  const out: number[] = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), tri = new THREE.Box3()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.visible) return
    const pos = m.geometry.getAttribute('position'), index = m.geometry.getIndex()
    const flip = m.matrixWorld.determinant() < 0
    const count = index ? index.count : pos.count
    for (let t = 0; t + 2 < count; t += 3) {
      const [i, j, k] = index ? [index.getX(t), index.getX(t + 1), index.getX(t + 2)] : [t, t + 1, t + 2]
      a.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      b.fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld)
      c.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld)
      if (!box.intersectsBox(tri.setFromPoints([a, b, c]))) continue
      out.push(...a.toArray(), ...(flip ? c : b).toArray(), ...(flip ? b : c).toArray())
    }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
}

/**
 * Feels the wall on one side (`side` -1 left, +1 right) over a stretch of the hall: `reach(y, z)` casts a ray out
 * from |x| = 2 and gives the |x| of the nearest wall part there, or null where it looks out through a port.
 * Only the stretch's own triangles are tested, since the whole hall is too many for hundreds of rays.
 */
export function wallProbe(hall: THREE.Object3D, side: -1 | 1, y0: number, y1: number, z0: number, z1: number) {
  hall.updateMatrixWorld(true)
  const near = wallPatch(hall, new THREE.Box3(
    new THREE.Vector3(side < 0 ? -HALF - 2 : 2, y0 - 0.1, z0 - 0.1),
    new THREE.Vector3(side < 0 ? -2 : HALF + 2, y1 + 0.1, z1 + 0.1)))
  const ray = new THREE.Raycaster(), from = new THREE.Vector3(), dir = new THREE.Vector3(side, 0, 0)
  return {
    reach(y: number, z: number): number | null {
      ray.set(from.set(side * 2, y, z), dir)
      const hit = ray.intersectObject(near, false)[0]
      return hit ? 2 + hit.distance : null
    },
    dispose: () => near.geometry.dispose(),
  }
}

const mapVert = /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`
// |x| in millimetres over two bytes; alpha marks where anything was drawn
const mapFrag = /* glsl */ `varying vec3 vW; void main() { float v = floor(abs(vW.x) * 1000.0); gl_FragColor = vec4(floor(v / 256.0) / 255.0, mod(v, 256.0) / 255.0, 0.0, 1.0); }`

export interface WallMap {
  /** |x| of the nearest wall part at (y, z), or null where the wall is open to space. */
  reach: (y: number, z: number) => number | null
  /** Nearest and farthest reach over a patch of wall, the share of it open to space, and the share within 12 cm of the nearest (what a flat thing laid there would touch). */
  span: (y0: number, y1: number, z0: number, z1: number) => { min: number; max: number; open: number; touch: number }
}

/**
 * The shape of one wall (`side` -1 left, +1 right) as seen straight on from the middle of the hall: a depth picture
 * of everything on `layer` (the hall's shadow casters), rendered once on the GPU and read back, `res` metres a pixel.
 * Thousands of placements can then ask how far the wall reaches without raycasting the hall's 200k triangles.
 */
export function wallMap(renderer: THREE.WebGLRenderer, scene: THREE.Scene, side: -1 | 1, layer: number, box: { y0: number; y1: number; z0: number; z1: number }, res = 0.04): WallMap {
  const W = Math.ceil((box.z1 - box.z0) / res), H = Math.ceil((box.y1 - box.y0) / res)
  const cam = new THREE.OrthographicCamera(-W * res / 2, W * res / 2, H * res / 2, -H * res / 2, 1.5, 14)
  cam.position.set(0, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2); cam.lookAt(side, cam.position.y, cam.position.z)
  cam.layers.set(layer); cam.updateMatrixWorld()
  const rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true })
  const mat = new THREE.ShaderMaterial({ vertexShader: mapVert, fragmentShader: mapFrag })
  const bg = scene.background, clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha()
  scene.background = null; scene.overrideMaterial = mat; renderer.setClearColor(0x000000, 0)
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null)
  scene.background = bg; scene.overrideMaterial = null; renderer.setClearColor(clear, alpha)
  const px = new Uint8Array(W * H * 4)
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, px)
  rt.dispose(); mat.dispose()
  // looking along -x the picture's right is -z, along +x it is +z; rows run bottom up
  const col = (z: number) => Math.floor(side > 0 ? (z - box.z0) / res : (box.z1 - z) / res)
  const row = (y: number) => Math.floor((y - box.y0) / res)
  const at = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= H || c >= W) return null
    const i = (r * W + c) * 4
    return px[i + 3] ? (px[i] * 256 + px[i + 1]) / 1000 : null
  }
  return {
    reach: (y, z) => at(row(y), col(z)),
    span(y0, y1, z0, z1) {
      let min = Infinity, max = -Infinity, open = 0, n = 0, touch = 0
      const ca = col(z0), cb = col(z1), c0 = Math.min(ca, cb), c1 = Math.max(ca, cb), vals: number[] = []
      for (let r = row(y0); r <= row(y1); r++) for (let c = c0; c <= c1; c++) {
        const v = at(r, c); n++
        if (v === null) { open++; continue }
        vals.push(v)
        if (v < min) min = v
        if (v > max) max = v
      }
      for (const v of vals) if (v < min + 0.12) touch++
      return { min, max, open: n ? open / n : 1, touch: n ? touch / n : 0 }
    },
  }
}
