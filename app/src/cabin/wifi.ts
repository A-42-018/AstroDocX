import * as THREE from 'three'
import { rng } from '../data/synthetic'
import type { CabinCrew } from './data'
import type { createCrew } from './crew'
import { FLOOR, HALF, LEN, TOP } from './hall'

/*
 * The Wi-Fi sensing view of the cabin. What the picture is made of:
 *  - the cabin as a dotted point cloud: sampled once from the 3D hall (in a real system, a one-off LiDAR or CAD scan of the
 *    empty cabin; Wi-Fi cannot see walls and furniture), coloured by height, with a scan line sweeping the length of it;
 *  - the people, drawn as heat shapes at the places the routers' signals say they are, their glow swelling with each
 *    breath (the breathing rate is the console's live respiration);
 *  - three sensing routers on the ceiling with their waves, and a thin link to each person they are watching.
 * All of it is simulated: no Wi-Fi hardware is read. The overlay says so.
 */

type Crew = ReturnType<typeof createCrew>

/** Where the three sensing routers hang. */
export const ROUTERS: THREE.Vector3[] = [new THREE.Vector3(-5.6, TOP - 0.3, -8.5), new THREE.Vector3(5.6, TOP - 0.3, -1.5), new THREE.Vector3(-3.2, TOP - 0.3, 9)]

const POINT_BUDGET = 900_000
const DENSITY = 150 // points per square metre of surface, before the budget

const PALETTE: [number, string][] = [[0, '#ff4d3a'], [0.16, '#ffae2b'], [0.34, '#8df25a'], [0.62, '#22d3ee'], [1, '#3b5bff']]
const lerpColor = (t: number, out: THREE.Color) => {
  for (let i = 1; i < PALETTE.length; i++) {
    if (t <= PALETTE[i][0]) {
      const [t0, c0] = PALETTE[i - 1], [t1, c1] = PALETTE[i]
      return out.set(c0).lerp(new THREE.Color(c1), (t - t0) / (t1 - t0))
    }
  }
  return out.set(PALETTE[PALETTE.length - 1][1])
}

const POINT_VERT = /* glsl */ `
  attribute vec3 aColor; attribute vec3 aNormal; uniform float uTime; uniform float uSize; uniform float uScale;
  varying vec3 vC; varying float vS; varying float vB;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uScale / max(-mv.z, 0.1), 1.0, 2.4);
    // surfaces facing the camera glow more and far ones fade, which is what makes the dots read as a room
    vec3 toCam = cameraPosition - position;
    float dist = length(toCam);
    float facing = abs(dot(toCam / max(dist, 0.001), aNormal));
    vB = (0.55 + 1.6 * facing) * (0.5 + 0.9 * exp(-dist / 22.0));
    vS = exp(-pow((mod(uTime * 3.2, 40.0) - 20.0 - position.z) / 1.5, 2.0)); // a scan line down the cabin
    vC = aColor;
  }
`
const POINT_FRAG = /* glsl */ `
  varying vec3 vC; varying float vS; varying float vB;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vC * vB * (1.0 + 2.0 * vS), a * (0.6 + 0.4 * vS));
  }
`

/** Heat colours from blue (cool) through green and yellow to red (hot), facing the camera = hottest. */
const THERMAL_VERT = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  varying vec3 vN; varying vec3 vV;
  void main() {
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
    vN = normalize(transformedNormal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const THERMAL_FRAG = /* glsl */ `
  uniform float uBreath; uniform float uTime;
  varying vec3 vN; varying vec3 vV;
  vec3 heat(float h) {
    vec3 c = mix(vec3(0.04, 0.25, 1.0), vec3(0.05, 0.95, 0.95), smoothstep(0.0, 0.3, h));
    c = mix(c, vec3(0.45, 1.0, 0.25), smoothstep(0.3, 0.55, h));
    c = mix(c, vec3(1.0, 0.85, 0.1), smoothstep(0.55, 0.78, h));
    return mix(c, vec3(1.0, 0.22, 0.08), smoothstep(0.78, 1.0, h));
  }
  void main() {
    float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float h = clamp(pow(f, 2.2) * 1.0 + uBreath * 0.1, 0.0, 1.0);
    gl_FragColor = vec4(heat(h) * 0.95, 1.0);
  }
`

const FLOOR_NEAR = new THREE.Color('#7cf05a'), FLOOR_MID = new THREE.Color('#ffc42e'), FLOOR_FAR = new THREE.Color('#ff4d3a')
const WALL_LOW = new THREE.Color('#22d3ee'), WALL_HIGH = new THREE.Color('#3b5bff'), CEIL = new THREE.Color('#6a5cff')
/** A point's colour from the way its surface faces: floors green fading to red toward the walls, walls cyan to blue with height, the ceiling violet. */
function surfaceColor(p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) {
  const hy = THREE.MathUtils.clamp((p.y - FLOOR) / (TOP - FLOOR), 0, 1)
  const jitter = 0
  if (n.y > 0.7) {
    if (p.y > TOP - 1) return out.copy(CEIL).lerp(WALL_HIGH, 0.4 + jitter)
    const e = THREE.MathUtils.clamp(Math.abs(p.x) / HALF + jitter, 0, 1)
    return e < 0.5 ? out.copy(FLOOR_NEAR).lerp(FLOOR_MID, e * 2) : out.copy(FLOOR_MID).lerp(FLOOR_FAR, (e - 0.5) * 2)
  }
  if (n.y < -0.7) return out.copy(CEIL).lerp(WALL_HIGH, 0.4 + jitter)
  if (Math.abs(n.y) < 0.5) return out.copy(WALL_LOW).lerp(WALL_HIGH, THREE.MathUtils.clamp(hy + jitter, 0, 1))
  return lerpColor(THREE.MathUtils.clamp(hy + jitter, 0, 1), out)
}

/** A mesh's triangles with their running area, so points can be drawn evenly over its surface (cached per geometry). */
interface Tris { cum: Float64Array; idx: Uint32Array; total: number }
const triCache = new WeakMap<THREE.BufferGeometry, Tris>()
function trisOf(g: THREE.BufferGeometry): Tris {
  const have = triCache.get(g)
  if (have) return have
  const pos = g.attributes.position, ix = g.index
  const n = Math.floor((ix ? ix.count : pos.count) / 3)
  const idx = new Uint32Array(n * 3), cum = new Float64Array(n)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3()
  let total = 0
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 3; k++) idx[t * 3 + k] = ix ? ix.getX(t * 3 + k) : t * 3 + k
    a.fromBufferAttribute(pos, idx[t * 3]); b.fromBufferAttribute(pos, idx[t * 3 + 1]); c.fromBufferAttribute(pos, idx[t * 3 + 2])
    total += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5
    cum[t] = total
  }
  const out = { cum, idx, total }
  triCache.set(g, out)
  return out
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,170,60,0.85)'); r.addColorStop(0.35, 'rgba(255,90,40,0.35)'); r.addColorStop(1, 'rgba(255,60,30,0)')
  g.fillStyle = r; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface Person { holder: THREE.Object3D; mat: THREE.ShaderMaterial; glow: THREE.Sprite; chip: HTMLElement; saved: Map<THREE.Mesh, THREE.Material | THREE.Material[]> }

export interface WifiView {
  setOn: (on: boolean) => void
  isOn: () => boolean
  update: (t: number, dt: number, live: Map<string, CabinCrew>) => void
  dispose: () => void
}

/** What one crew member's live numbers say about how they are doing, in the overlay's words. */
export function stateOf(m: Pick<CabinCrew, 'live' | 'status'>): 'Resting' | 'Active' | 'Elevated breathing' {
  if (m.live.resp > 20 || m.status === 'act') return 'Elevated breathing'
  if (m.live.hr > 80) return 'Active'
  return 'Resting'
}

/** Signal strength 1 to 4 bars from the distance to the nearest router. */
export function barsAt(p: THREE.Vector3): number {
  const d = Math.min(...ROUTERS.map((r) => r.distanceTo(p)))
  return d < 6 ? 4 : d < 10 ? 3 : d < 15 ? 2 : 1
}

export function createWifiView(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, crew: Crew, host: HTMLElement, reduced: boolean): WifiView {
  const group = new THREE.Group(); group.visible = false; group.name = 'wifi-view'
  scene.add(group)
  let on = false, built = false
  let cloud: THREE.Points | null = null
  const pointMat = new THREE.ShaderMaterial({
    vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSize: { value: 0.034 }, uScale: { value: 800 } },
  })
  const glowTex = glowTexture()
  const waves: { mesh: THREE.Mesh; phase: number; origin: THREE.Vector3 }[] = []
  const linkGeo = new THREE.BufferGeometry()
  const linkMat = new THREE.LineBasicMaterial({ color: '#36e2f5', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
  const links = new THREE.LineSegments(linkGeo, linkMat); links.frustumCulled = false; group.add(links)
  const people = new Map<string, Person>()
  const hidden = new Map<THREE.Object3D, boolean>()
  let savedBg: THREE.Color | THREE.Texture | null = null
  let lastSweep = -1

  /* ---- the DOM overlay ---- */
  const ui = document.createElement('div'); ui.className = 'wifi-ui'; ui.hidden = true
  ui.innerHTML = `
    <div class="wifi-top"><b>Wi-Fi Sensing Overlay</b><span>Sensing routers: ${ROUTERS.length} active (Tx/Rx map)</span><em>Simulated</em></div>
    <div class="wifi-count"><b class="wifi-n">0/0 Personnel Detected</b><span>Active Motion &amp; Respiration Tracker</span></div>
    <ol class="wifi-cards" aria-label="People detected by Wi-Fi sensing"></ol>
    <p class="wifi-note">Cabin drawn from a stored scan; people placed from simulated Wi-Fi signals.</p>
    <div class="wifi-chips" aria-hidden="true"></div>`
  host.appendChild(ui)
  const nEl = ui.querySelector('.wifi-n') as HTMLElement, cardsEl = ui.querySelector('.wifi-cards') as HTMLElement, chipsEl = ui.querySelector('.wifi-chips') as HTMLElement

  /** Samples the hall's surfaces into one coloured cloud (once). */
  function buildCloud() {
    const meshes: { mesh: THREE.Mesh; area: number }[] = []
    const holders = new Set<THREE.Object3D>(crew.holders())
    const box = new THREE.Box3(), sc = new THREE.Vector3()
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || !mesh.geometry?.attributes.position) return
      for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (holders.has(p) || p === group || p.userData.crew) return
      const mats = ([] as THREE.Material[]).concat(mesh.material)
      if (mats.some((m) => m.side === THREE.BackSide || m.visible === false || (m.transparent && m.opacity < 0.9))) return
      box.setFromObject(mesh)
      const c = box.getCenter(new THREE.Vector3())
      if (Math.abs(c.x) > HALF + 1.5 || Math.abs(c.z) > LEN + 1.5 || c.y < FLOOR - 1 || c.y > TOP + 1.5) return // Earth, the station, the stars
      mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc)
      const k = (sc.x * sc.y + sc.y * sc.z + sc.x * sc.z) / 3
      meshes.push({ mesh, area: Math.max(0.0001, trisOf(mesh.geometry).total * k) })
    })
    const total = meshes.reduce((s, m) => s + m.area, 0)
    const density = Math.min(DENSITY, POINT_BUDGET / Math.max(total, 1))
    const counts = meshes.map(({ area }) => Math.min(250_000, Math.max(4, Math.round(area * density))))
    const all = counts.reduce((q, n) => q + n, 0)
    const pos = new Float32Array(all * 3), col = new Float32Array(all * 3), nor = new Float32Array(all * 3)
    let at = 0
    const v = new THREE.Vector3(), c = new THREE.Color()
    const rand = rng(11).next
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
    meshes.forEach(({ mesh }, mi) => {
      const geo = mesh.geometry, pa = geo.attributes.position, { cum, idx, total: tot } = trisOf(geo)
      if (!(tot > 0)) return
      const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
      for (let i = 0; i < counts[mi]; i++) {
        // a triangle chosen in proportion to its area, then a uniform point inside it
        const r = rand() * tot
        let lo = 0, hi = cum.length - 1
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid }
        va.fromBufferAttribute(pa, idx[lo * 3]); vb.fromBufferAttribute(pa, idx[lo * 3 + 1]); vc.fromBufferAttribute(pa, idx[lo * 3 + 2])
        let u = rand(), w = rand()
        if (u + w > 1) { u = 1 - u; w = 1 - w }
        e1.subVectors(vb, va); e2.subVectors(vc, va)
        nrm.copy(e1).cross(e2).normalize()
        v.copy(va).addScaledVector(e1, u).addScaledVector(e2, w).applyMatrix4(mesh.matrixWorld)
        nrm.applyMatrix3(nm).normalize()
        if (!Number.isFinite(v.x + v.y + v.z)) continue
        surfaceColor(v, nrm, c)
        pos[at * 3] = v.x; pos[at * 3 + 1] = v.y; pos[at * 3 + 2] = v.z
        col[at * 3] = c.r; col[at * 3 + 1] = c.g; col[at * 3 + 2] = c.b
        nor[at * 3] = nrm.x; nor[at * 3 + 1] = nrm.y; nor[at * 3 + 2] = nrm.z
        at++
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, at * 3), 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, at * 3), 3)); g.setAttribute('aNormal', new THREE.BufferAttribute(nor.subarray(0, at * 3), 3))
    cloud = new THREE.Points(g, pointMat); cloud.frustumCulled = false; cloud.renderOrder = 1
    group.add(cloud)

    // routers and their waves
    const boxMat = new THREE.MeshBasicMaterial({ color: '#9ff4ff', toneMapped: false })
    ROUTERS.forEach((r, i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.32), boxMat); b.position.copy(r); group.add(b)
      for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), new THREE.MeshBasicMaterial({ color: '#36e2f5', wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
        m.position.copy(r); m.frustumCulled = false; group.add(m)
        waves.push({ mesh: m, phase: (i * 0.31 + k * 0.5) % 1, origin: r })
      }
    })
    built = true
  }

  function person(id: string): Person | null {
    const have = people.get(id)
    if (have) return have
    const a = crew.find(id)
    if (!a) return null
    const mat = new THREE.ShaderMaterial({ vertexShader: THERMAL_VERT, fragmentShader: THERMAL_FRAG, uniforms: { uBreath: { value: 0 }, uTime: { value: 0 } } })
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
    glow.renderOrder = 2; group.add(glow)
    const chip = document.createElement('div'); chip.className = 'wifi-chip'; chipsEl.appendChild(chip)
    const p: Person = { holder: a.holder, mat, glow, chip, saved: new Map() }
    people.set(id, p)
    return p
  }

  /** Swaps a person's suit for the heat shader (and back). */
  function dress(p: Person, thermal: boolean) {
    p.holder.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (thermal) { if (!p.saved.has(m)) { p.saved.set(m, m.material); m.material = p.mat } }
      else if (p.saved.has(m)) { m.material = p.saved.get(m)!; p.saved.delete(m) }
    })
  }

  /** Hides the ordinary cabin (lights stay, so no shader recompiles) and shows only this view and the crew. */
  function enforce() {
    const keep = new Set<THREE.Object3D>([group, ...crew.holders()])
    for (const o of scene.children) {
      if (keep.has(o) || (o as THREE.Light).isLight) continue
      if (!hidden.has(o)) hidden.set(o, o.visible)
      o.visible = false
    }
  }

  const v3 = new THREE.Vector3(), tmp = new THREE.Vector3()
  let cardKey = ''

  function setOn(next: boolean) {
    if (next === on) return
    on = next
    if (on) {
      if (!built) buildCloud()
      savedBg = scene.background as THREE.Color | THREE.Texture | null
      scene.background = new THREE.Color('#020611')
      enforce()
      group.visible = true; ui.hidden = false
    } else {
      for (const [o, vis] of hidden) o.visible = vis
      hidden.clear()
      for (const p of people.values()) dress(p, false)
      scene.background = savedBg
      group.visible = false; ui.hidden = true
    }
  }

  function update(t: number, dt: number, live: Map<string, CabinCrew>) {
    if (!on) return
    if (Math.floor(t * 4) !== lastSweep) { lastSweep = Math.floor(t * 4); enforce() } // things added while the view is on stay hidden
    pointMat.uniforms.uTime.value = reduced ? 8 : t
    pointMat.uniforms.uScale.value = (renderer.domElement.clientHeight * renderer.getPixelRatio() * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.55
    const rect = renderer.domElement.getBoundingClientRect()

    // router waves
    for (const w of waves) {
      const k = reduced ? 0.45 : (t * 0.22 + w.phase) % 1
      w.mesh.scale.setScalar(0.6 + k * 11)
      ;(w.mesh.material as THREE.MeshBasicMaterial).opacity = 0.07 * (1 - k) * (1 - k)
    }

    // people
    const segs: number[] = []
    const cards: string[] = []
    let seen = 0
    camera.updateMatrixWorld()
    for (const [id, m] of live) {
      const a = crew.find(id)
      if (!a || !a.holder.visible) continue
      const p = person(id)
      if (!p) continue
      seen++
      dress(p, true)
      const breath = reduced ? 0 : Math.sin(2 * Math.PI * (m.live.resp / 60) * t + seen)
      p.mat.uniforms.uBreath.value = breath
      p.holder.getWorldPosition(v3)
      p.glow.position.copy(v3); p.glow.scale.setScalar(2.6 + breath * 0.25)
      ;(p.glow.material as THREE.SpriteMaterial).opacity = 0.55 + breath * 0.15
      for (const r of ROUTERS) segs.push(r.x, r.y, r.z, v3.x, v3.y, v3.z)
      // a chip over the head
      if (a.head) a.head.getWorldPosition(tmp); else tmp.copy(v3).y += 1
      tmp.y += 0.45
      tmp.project(camera)
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1
      p.chip.style.display = visible ? '' : 'none'
      if (visible) p.chip.style.transform = `translate(${((tmp.x + 1) / 2) * rect.width}px, ${((1 - tmp.y) / 2) * rect.height}px) translate(-50%, -100%)`
      const st = stateOf(m)
      p.chip.textContent = `${m.name} · ${m.live.resp.toFixed(0)}/min`
      p.chip.dataset.state = st
      cards.push(`<li data-state="${st}"><b>${m.name}</b><span>${st} (${m.live.resp.toFixed(0)}/min respiration)</span><i class="wifi-bars" data-bars="${barsAt(v3)}" aria-label="Signal ${barsAt(v3)} of 4"><u></u><u></u><u></u><u></u></i></li>`)
    }
    for (const [id, p] of people) if (!live.has(id) || !crew.find(id)?.holder.visible) { p.chip.style.display = 'none'; p.glow.visible = false } else p.glow.visible = true
    linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3))
    linkMat.opacity = reduced ? 0.22 : 0.14 + 0.1 * Math.sin(t * 2.2)

    // the cards change only when the numbers do (about once a second)
    const key = cards.join('')
    if (key !== cardKey) { cardKey = key; cardsEl.innerHTML = key; nEl.textContent = `${seen}/${live.size} Personnel Detected` }
    void dt
  }

  function dispose() {
    setOn(false)
    cloud?.geometry.dispose(); pointMat.dispose(); glowTex.dispose(); linkGeo.dispose(); linkMat.dispose()
    for (const w of waves) { w.mesh.geometry.dispose(); (w.mesh.material as THREE.Material).dispose() }
    for (const p of people.values()) { p.mat.dispose(); (p.glow.material as THREE.Material).dispose() }
    scene.remove(group); ui.remove()
  }

  return { setOn, isOn: () => on, update, dispose }
}
