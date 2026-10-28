import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CabinCrew, CabinData } from './data'
import { C, SH, SW, TAG_H, TAG_W, drawAlerts, drawLiveVitals, drawStatusBoard, drawTag, drawTrends } from './panels'

/*
 * The 3D cabin: "Space Ship Interior" by Ryley Burnett (CC BY 4.0) with a mirrored twin, scaled to a
 * 15.5 x 31 m hall (walls at x = +-7.8, floor y = -2.5, door at z = +15.4, Earth window at z = -15.4).
 * Four floating panels show the console's data, the crew float beside them, and a scroll-driven
 * camera tours nine stops from a helmet view at the door to a look back from the window.
 */

export const STOP_COUNT = 9
export interface CabinOptions {
  reducedMotion: boolean
  /** Fades and scales with the helmet stop (0 = fully in the helmet). */
  visor: HTMLElement | null
  onStop: (i: number) => void
  onPick: (crewId: string | null) => void
  onReady: () => void
}
export interface CabinScene {
  update: (d: CabinData) => void
  goTo: (i: number) => void
  dispose: () => void
}

const MODELS = `${import.meta.env.BASE_URL}models/`
const HALF = 7.76, LEN = 15.4, TOP = 3.9, FLOOR = -2.5
type V3 = [number, number, number]

/** The panels, left (-1) and right (+1) of the hall, in tour order: Status Board, Live Vitals, Alerts, Trends. */
const PANELS: { at: V3; side: -1 | 1; draw: (g: CanvasRenderingContext2D, d: CabinData, t: number) => void }[] = [
  { at: [-5.4, 0.2, 9], side: -1, draw: drawStatusBoard },
  { at: [5.4, 0.2, 5], side: 1, draw: drawLiveVitals },
  { at: [-5.4, 0.2, -1], side: -1, draw: drawAlerts },
  { at: [5.4, 0.2, -5.5], side: 1, draw: drawTrends },
]
const PW = 3.2, PH = 1.875

function mulberry(a: number) {
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** Earth from low orbit for the forward window: horizon arc, soft land, cloud streaks, a hazy limb and night to one side. */
function earthTexture() {
  const W = 2048, H = 1146, c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!, r = mulberry(11)
  g.fillStyle = '#000207'; g.fillRect(0, 0, W, H)
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`; const s = r() < 0.92 ? 1.2 : 2.4; g.fillRect(r() * W, r() * H * 0.42, s, s) }
  const cx = W * 0.5, cy = H * 2.12, R = H * 1.72
  const halo = g.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.07)
  halo.addColorStop(0, 'rgba(120,200,255,0.95)'); halo.addColorStop(0.4, 'rgba(60,140,255,0.35)'); halo.addColorStop(1, 'rgba(40,100,255,0)')
  g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R * 1.07, 0, 7); g.fill()
  const sea = g.createRadialGradient(cx - R * 0.2, cy - R * 0.9, R * 0.05, cx, cy, R)
  sea.addColorStop(0, '#3b86d0'); sea.addColorStop(0.55, '#174a8c'); sea.addColorStop(1, '#0b2a55')
  g.fillStyle = sea; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill()
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip()
  g.filter = 'blur(18px)'
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${58 + r() * 30},${84 + r() * 30},${52 + r() * 20},0.55)`; g.beginPath(); g.ellipse(r() * W, H * 0.5 + r() * H * 0.5, 120 + r() * 260, 30 + r() * 60, (r() - 0.5) * 0.4, 0, 7); g.fill() }
  g.filter = 'blur(4px)'
  for (let i = 0; i < 420; i++) {
    const y = H * 0.4 + Math.pow(r(), 0.7) * H * 0.6, k = (y - H * 0.4) / (H * 0.6)
    g.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.35})`
    g.beginPath(); g.ellipse(r() * W, y, 14 + r() * 90 * (0.4 + k), 2 + r() * 10 * (0.3 + k), (r() - 0.5) * 0.25, 0, 7); g.fill()
  }
  g.filter = 'none'
  const limb = g.createLinearGradient(0, H * 0.4, 0, H * 0.62)
  limb.addColorStop(0, 'rgba(150,210,255,0.55)'); limb.addColorStop(1, 'rgba(150,210,255,0)')
  g.fillStyle = limb; g.fillRect(0, H * 0.38, W, H * 0.3)
  const night = g.createLinearGradient(0, 0, W, 0)
  night.addColorStop(0, 'rgba(0,4,16,0)'); night.addColorStop(0.75, 'rgba(0,4,16,0)'); night.addColorStop(1, 'rgba(0,4,16,0.75)')
  g.fillStyle = night; g.fillRect(0, 0, W, H)
  g.restore()
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Throws when WebGL is unavailable; the page shows its fallback then. */
export function createCabin(canvas: HTMLCanvasElement, opts: CabinOptions): CabinScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  const size = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight] as const
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(...size(), false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.85
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#05080d')
  scene.fog = new THREE.Fog('#05080d', 35, 110)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture // soft reflections for the untextured metal
  const camera = new THREE.PerspectiveCamera(58, size()[0] / size()[1], 0.05, 140)
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(...size()), 0.45, 0.45, 0.9))
  composer.addPass(new OutputPass())

  /* ---------- lighting ---------- */
  scene.add(new THREE.HemisphereLight('#c4dcf5', '#1a2230', 0.38))
  for (const p of [[0, 5, 1], [0, 5, 8], [0, 5, 15], [-4, 4, 10], [4, 4, 10], [-4, 4, 3], [4, 4, 3]] as V3[]) {
    const l = new THREE.PointLight('#d6ecff', 8.8, 16, 1.5); l.position.set(...p); scene.add(l)
  }
  const alarm = new THREE.PointLight(C.watch, 0, 5, 1.6)
  scene.add(alarm)

  /* ---------- the hall ---------- */
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const h = TOP - FLOOR
  const hull = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 6, h + 4, LEN * 2 + 3), new THREE.MeshStandardMaterial({ color: '#141b22', metalness: 0.3, roughness: 0.8, side: THREE.BackSide }))
  hull.position.set(0, FLOOR + h / 2, 0); scene.add(hull) // fills the ceiling seam and anything seen through the wall openings
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(6, LEN * 2), new THREE.MeshStandardMaterial({ color: '#59636e', metalness: 0.4, roughness: 0.6 }))
  seam.rotation.x = Math.PI / 2; seam.position.set(0, TOP - 0.02, 0); scene.add(seam)
  const capMat = new THREE.MeshStandardMaterial({ color: '#3a4550', metalness: 0.6, roughness: 0.5 })
  const glowMat = new THREE.MeshStandardMaterial({ color: '#0b1218', emissive: C.cy, emissiveIntensity: 1.2 })
  const fwd = new THREE.Group(); fwd.position.z = -LEN; scene.add(fwd)
  for (const [w, x, y, hh] of [[HALF * 2, 0, TOP - 0.9, 1.8], [HALF * 2, 0, FLOOR + 0.6, 1.2], [2.2, -HALF + 1.1, 0.5, h], [2.2, HALF - 1.1, 0.5, h]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.3), capMat); m.position.set(x, y, 0); fwd.add(m)
  }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 4.4, h - 3), new THREE.MeshBasicMaterial({ map: earthTexture(), toneMapped: false, fog: false }))
  win.position.set(0, FLOOR + 1.2 + (h - 3) / 2, -0.4); fwd.add(win)
  for (const y of [FLOOR + 1.2, TOP - 1.8]) { const f = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 - 4.4, 0.06, 0.05), glowMat); f.position.set(0, y, 0.17); fwd.add(f) }
  const aft = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, h, 0.3), capMat); aft.position.set(0, FLOOR + h / 2, LEN); scene.add(aft)
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.05), glowMat); door.position.set(0, -0.9, LEN - 0.17); scene.add(door)
  const strip = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: C.cy, emissiveIntensity: 1.8 })
  for (const [x, y] of [[-5.6, FLOOR + 0.08], [5.6, FLOOR + 0.08], [-3, TOP - 0.08], [3, TOP - 0.08]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, LEN * 2 - 1), strip); b.position.set(x, y, 0); scene.add(b)
  }
  const hallLoaded = loader.loadAsync(`${MODELS}corridor.glb`).then((gltf) => {
    const metal = new THREE.MeshStandardMaterial({ color: '#8f9ba8', metalness: 0.5, roughness: 0.48, envMapIntensity: 0.3 })
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = metal })
    // The model is one wall with floor and ceiling, open in front: a mirrored twin closes the hall.
    const pivot = new THREE.Group()
    const wall = gltf.scene; wall.position.set(-6.74, 0, -12.16)
    const twin = wall.clone(); twin.rotation.y = Math.PI; twin.position.set(6.74, 0, 12.16)
    pivot.add(wall, twin)
    pivot.rotation.y = Math.PI / 2; pivot.scale.setScalar(0.35); pivot.position.y = -2.325
    scene.add(pivot)
  }).catch((err) => console.warn('cabin: corridor.glb failed', err))

  /* ---------- panels ---------- */
  let data: CabinData | null = null
  const panels = PANELS.map((p, i) => {
    const c = document.createElement('canvas'); c.width = SW; c.height = SH
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
    const g = new THREE.Group()
    const back = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.12, PH + 0.12, 0.05), new THREE.MeshStandardMaterial({ color: '#0b1218', roughness: 0.5, metalness: 0.4, emissive: C.cy, emissiveIntensity: 0.08 }))
    const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
    face.position.z = 0.03; face.userData.panel = i
    g.add(back, face); g.position.set(...p.at); g.rotation.y = -p.side * (Math.PI / 2 - 0.3) // turned a little toward the door
    scene.add(g)
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(g.rotation)
    const light = new THREE.PointLight(C.cy, 1.0, 5, 2); light.position.copy(g.position).addScaledVector(normal, 1.2); scene.add(light)
    return { ctx: c.getContext('2d'), tex, face, pos: g.position.clone(), normal, draw: p.draw }
  })
  /** Beside panel `i`: a metre in front of it and 2.1 m toward its outer edge. */
  const beside = (i: number, dy: number): V3 => {
    const p = panels[i], t = new THREE.Vector3(-p.normal.z, 0, p.normal.x).multiplyScalar(PANELS[i].side < 0 ? 1 : -1)
    return p.pos.clone().addScaledVector(p.normal, 1.0).addScaledVector(t, 2.1).add(new THREE.Vector3(0, dy, 0)).toArray() as V3
  }

  /* ---------- crew: the focus member beside Live Vitals, the rest by roster order ---------- */
  const SLOTS: { pos: V3; rot: V3 }[] = [
    { pos: beside(1, -0.9), rot: [0, -0.8, 0.08] },
    { pos: [-2.2, -0.9, -11.5], rot: [0, 0.9, 0.05] },
    { pos: [2.2, -0.4, -11.8], rot: [0.2, -0.9, -0.15] },
    { pos: beside(0, -0.9), rot: [0, 0.8, -0.08] },
    { pos: beside(2, -1.0), rot: [0.1, 0.8, 0.06] },
    { pos: beside(3, 0.7), rot: [Math.PI - 0.25, -0.8, 0] },
    { pos: [-1.6, 1.2, 4], rot: [0.4, 0.3, 0.6] },
    { pos: [1.8, 1.4, -4], rot: [-0.3, -0.5, -0.5] },
  ]
  interface Astro { holder: THREE.Group; base: THREE.Vector3; rot: THREE.Euler; ctx: CanvasRenderingContext2D | null; tagTex: THREE.CanvasTexture; tag: THREE.Sprite; ring: THREE.Mesh }
  const astros = new Map<string, Astro>()
  let template: THREE.Object3D | null = null
  const crewLoaded = loader.loadAsync(`${MODELS}astronaut.glb`).then((gltf) => {
    const root = gltf.scene, box = new THREE.Box3().setFromObject(root)
    const s = 1.72 / Math.max(...box.getSize(new THREE.Vector3()).toArray())
    root.position.sub(box.getCenter(new THREE.Vector3()))
    template = new THREE.Group().add(root); template.scale.setScalar(s)
  }).catch((err) => console.warn('cabin: astronaut.glb failed', err))

  function astroFor(id: string): Astro | null {
    const have = astros.get(id)
    if (have || !template) return have ?? null
    const holder = new THREE.Group(); holder.add(skeletonClone(template))
    holder.traverse((o) => { o.userData.crew = id })
    scene.add(holder)
    const c = document.createElement('canvas'); c.width = TAG_W; c.height = TAG_H
    const tagTex = new THREE.CanvasTexture(c); tagTex.colorSpace = THREE.SRGBColorSpace
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, transparent: true, toneMapped: false }))
    tag.scale.set(1.25, 0.37, 1); tag.renderOrder = 10; scene.add(tag)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: C.watch, toneMapped: false, transparent: true }))
    ring.rotation.x = Math.PI / 2; scene.add(ring)
    const a: Astro = { holder, base: new THREE.Vector3(), rot: new THREE.Euler(), ctx: c.getContext('2d'), tagTex, tag, ring }
    astros.set(id, a)
    return a
  }
  let placedKey = ''
  function place() {
    if (!data || !template) return
    const key = `${data.focusId}|${data.crew.map((c) => c.id).join(',')}`
    if (key === placedKey) return
    placedKey = key
    const order = [data.focusId, ...data.crew.map((c) => c.id).filter((id) => id !== data!.focusId)]
    order.forEach((id, i) => {
      const a = astroFor(id), slot = SLOTS[i % SLOTS.length]
      if (!a) return
      a.base.set(...slot.pos); a.rot.set(...slot.rot)
    })
    for (const [id, a] of astros) if (!order.includes(id)) { a.holder.visible = false; a.tag.visible = false; a.ring.visible = false }
    buildPath()
  }

  /* ---------- the tour ---------- */
  const facing = (i: number, d = 3.1) => ({ pos: panels[i].pos.clone().addScaledVector(panels[i].normal, d), look: panels[i].pos.clone() })
  const v = (a: V3) => new THREE.Vector3(...a)
  let posCurve = new THREE.CatmullRomCurve3(), lookCurve = new THREE.CatmullRomCurve3()
  function buildPath() {
    const f = SLOTS[0], front = new THREE.Vector3(Math.sin(f.rot[1]), 0, Math.cos(f.rot[1]))
    const close = { pos: v(f.pos).addScaledVector(front, 2.8).add(new THREE.Vector3(0, 0.55, 0)), look: v(f.pos).add(new THREE.Vector3(0, 0.25, 0)) }
    const stops = [
      { pos: v([0, 0.4, 14]), look: v([0, -0.6, 0]) },
      { pos: v([3.5, 2.4, 13]), look: v([-0.5, -1, -1]) },
      facing(0), facing(1), close, facing(2), facing(3),
      { pos: v([0, 0.4, -5.5]), look: v([0, 0.3, -16]) },
      { pos: v([0, 2.0, -13.6]), look: v([0, -0.8, 10]) },
    ]
    posCurve = new THREE.CatmullRomCurve3(stops.map((s) => s.pos), false, 'centripetal')
    lookCurve = new THREE.CatmullRomCurve3(stops.map((s) => s.look), false, 'centripetal')
  }
  buildPath()

  const N = STOP_COUNT, reduced = opts.reducedMotion
  let p = 0, pTarget = 0, snapTimer = 0, shown = -1
  let focus: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null
  const camPos = posCurve.getPoint(0), camLook = lookCurve.getPoint(0)
  const drag = { on: false, moved: 0, x: 0, y: 0, yaw: 0, pitch: 0 }

  const unfocus = () => { if (focus) { focus = null; opts.onPick(null) } }
  const goTo = (i: number) => { unfocus(); pTarget = THREE.MathUtils.clamp(i, 0, N - 1); if (reduced) p = pTarget }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    unfocus()
    pTarget = THREE.MathUtils.clamp(pTarget + e.deltaY * 0.0022, 0, N - 1)
    const dir = Math.sign(e.deltaY)
    clearTimeout(snapTimer)
    // settle on a stop in the direction of travel: even a small flick moves one stop on
    snapTimer = window.setTimeout(() => { pTarget = THREE.MathUtils.clamp(dir > 0 ? Math.ceil(pTarget - 0.05) : Math.floor(pTarget + 0.05), 0, N - 1); if (reduced) p = pTarget }, 200)
    if (reduced) p = pTarget
  }
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) return
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goTo(Math.round(pTarget) + 1) }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(Math.round(pTarget) - 1) }
  }
  const ray = new THREE.Raycaster()
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
    const hit = ray.intersectObjects([...panels.map((x) => x.face), ...[...astros.values()].map((a) => a.holder)], true)[0]
    if (!hit) return
    const panel = hit.object.userData.panel as number | undefined
    if (panel !== undefined) { goTo([2, 3, 5, 6][panel]); return }
    const id = hit.object.userData.crew as string | undefined, a = id ? astros.get(id) : undefined
    if (!id || !a) return
    const toCam = camera.position.clone().sub(a.base).setY(0).normalize()
    focus = { pos: a.base.clone().addScaledVector(toCam, 2.6).add(new THREE.Vector3(0, 0.35, 0)), look: a.base.clone() }
    opts.onPick(id)
  }
  const onDown = (e: PointerEvent) => { drag.on = true; drag.moved = 0; drag.x = e.clientX; drag.y = e.clientY; canvas.classList.add('dragging') }
  const onUp = (e: PointerEvent) => { canvas.classList.remove('dragging'); if (drag.on && drag.moved < 5) pick(e); drag.on = false }
  const onMove = (e: PointerEvent) => {
    if (!drag.on) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY
    drag.yaw = THREE.MathUtils.clamp(drag.yaw - dx * 0.003, -0.9, 0.9)
    drag.pitch = THREE.MathUtils.clamp(drag.pitch - dy * 0.003, -0.6, 0.6)
  }
  const onResize = () => {
    const [w, hh] = size()
    camera.aspect = w / hh; camera.updateProjectionMatrix()
    renderer.setSize(w, hh, false); composer.setSize(w, hh)
  }
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)

  /* ---------- loop ---------- */
  const clock = new THREE.Clock()
  const up = new THREE.Vector3(0, 1, 0)
  let raf = 0, lastDraw = 0, disposed = false
  const frame = () => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, still = reduced ? 0 : 1
    p += (pTarget - p) * (reduced ? 1 : 0.07)
    const u = p / (N - 1)
    const k = reduced ? 1 : focus ? 0.06 : 0.25
    camPos.lerp(focus ? focus.pos : posCurve.getPoint(u), k); camLook.lerp(focus ? focus.look : lookCurve.getPoint(u), k)
    if (!drag.on) { drag.yaw *= 0.94; drag.pitch *= 0.94 }
    const helmet = THREE.MathUtils.clamp(1 - p * 1.6, 0, 1)
    camera.position.copy(camPos); camera.position.y += Math.sin(t * 1.3) * 0.012 * (0.4 + helmet) * still
    const dir = camLook.clone().sub(camPos).normalize().applyAxisAngle(up, drag.yaw)
    dir.applyAxisAngle(new THREE.Vector3().crossVectors(dir, up).normalize(), drag.pitch)
    camera.lookAt(camera.position.clone().add(dir))
    if (opts.visor) { opts.visor.style.opacity = String(helmet); opts.visor.style.transform = `scale(${1 + (1 - helmet) * 0.25})` }
    const stop = Math.round(p)
    if (stop !== shown) { shown = stop; opts.onStop(stop) }

    const crew = new Map<string, CabinCrew>((data?.crew ?? []).map((c) => [c.id, c]))
    let i = 0
    alarm.intensity = 0
    for (const [id, a] of astros) {
      const m = crew.get(id)
      if (!m) continue
      a.holder.position.set(a.base.x + Math.sin(t * 0.37 + i) * 0.03 * still, a.base.y + Math.sin(t * 0.55 + i * 2) * 0.06 * still, a.base.z)
      a.holder.rotation.set(a.rot.x + Math.sin(t * 0.3 + i) * 0.05 * still, a.rot.y + Math.sin(t * 0.21 + i) * 0.08 * still, a.rot.z + Math.sin(t * 0.27 + i) * 0.05 * still)
      a.tag.position.copy(a.holder.position).add(new THREE.Vector3(0, 1.25, 0))
      ;(a.tag.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.clamp((camera.position.distanceTo(a.tag.position) - 3.0) / 1.0, 0, 1)
      const off = m.status !== 'nominal'
      a.ring.visible = off
      if (off) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 * still + (reduced ? Math.PI / 2 : 0))
        const ring = a.ring.material as THREE.MeshBasicMaterial
        ring.color.set(m.status === 'act' ? C.act : C.watch); ring.opacity = 0.35 + pulse * 0.6
        a.ring.position.copy(a.holder.position); a.ring.scale.setScalar(1 + pulse * 0.08)
        if (id === data?.focusId) { alarm.color.set(ring.color); alarm.position.copy(a.holder.position).add(new THREE.Vector3(0, 0.6, 0.8)); alarm.intensity = 0.8 + pulse * 2.2 }
      }
      i++
    }
    if (data && t - lastDraw > 0.05) { // panels and tags at about 20 fps
      lastDraw = t
      for (const x of panels) if (x.ctx) { x.draw(x.ctx, data, t); x.tex.needsUpdate = true }
      for (const [id, a] of astros) { const m = crew.get(id); if (m && a.ctx) { drawTag(a.ctx, m, t); a.tagTex.needsUpdate = true } }
    }
    composer.render(dt)
  }
  frame()
  void Promise.all([hallLoaded, crewLoaded]).then(() => { if (!disposed) { place(); opts.onReady() } })

  return {
    update(d) { data = d; place() },
    goTo,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf); clearTimeout(snapTimer)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) { (mat as THREE.MeshBasicMaterial).map?.dispose(); mat.dispose() }
      })
      scene.environment?.dispose(); pmrem.dispose(); composer.dispose(); renderer.dispose()
    },
  }
}
