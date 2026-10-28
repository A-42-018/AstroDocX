import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CabinCrew, CabinData } from './data'
import { createCrew } from './crew'
import { createSpace, SUN_AT } from './earth'
import { createEva, EVA, EVA_VIEW, evaCrewId } from './eva'
import { buildHall, HALF } from './hall'
import { addLights, createFlare, createPost, createSunBeam, pickQuality } from './lighting'
import { C, SH, SW, drawAlerts, drawLiveVitals, drawStatusBoard, drawTrends } from './panels'
import { createScreens, type ScreenSpec } from './screens'

/*
 * The 3D cabin: the hall (hall.ts, lighting.ts), four wall screens running the real console (screens.ts), the crew
 * floating beside them (crew.ts), and a scroll-driven camera touring nine stops from a helmet view at the
 * door, past a look back from the window, out to a crew member on EVA beside the station (eva.ts).
 */

export const STOP_COUNT = 10
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

const MODELS = `${import.meta.env.BASE_URL}models/`, TEXTURES = `${import.meta.env.BASE_URL}textures/`
type V3 = [number, number, number]

/**
 * The wall screens, left (-1) and right (+1) of the hall, in tour order: Status Board, Live Vitals, Alerts, Trends.
 * `z` is where to look for a flat stretch of wall; `draw` is the stand-in seen from afar, `screen` the live console view.
 */
const PANELS: { z: number; side: -1 | 1; draw: (g: CanvasRenderingContext2D, d: CabinData, t: number) => void; screen: ScreenSpec }[] = [
  { z: 9, side: -1, draw: drawStatusBoard, screen: { view: 'board', px: [1600, 938] } },
  { z: 5, side: 1, draw: drawLiveVitals, screen: { view: 'vitals', px: [1024, 600] } },
  { z: -1, side: -1, draw: drawAlerts, screen: { view: 'alerts', px: [1280, 750] } },
  { z: -5.5, side: 1, draw: drawTrends, screen: { view: 'trends', px: [1280, 750] } },
]
const PW = 3.2, PH = 1.875, PY = 0.2

/** Throws when WebGL is unavailable; the page shows its fallback then. */
export function createCabin(canvas: HTMLCanvasElement, opts: CabinOptions): CabinScene {
  const quality = pickQuality()
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' })
  const size = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight] as const
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1.5))
  renderer.setSize(...size(), false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  renderer.shadowMap.enabled = quality !== 'low'
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false // the hall is static and the crew drift slowly: refreshed every few frames in the loop
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#05080d')
  scene.fog = new THREE.Fog('#05080d', 35, 110)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture // soft reflections for the metal
  scene.environmentIntensity = 0.45
  const camera = new THREE.PerspectiveCamera(58, size()[0] / size()[1], 0.08, 2000) // far enough for Earth and the stars
  const flare = createFlare(camera, SUN_AT)
  const post = createPost(renderer, scene, camera, ...size(), quality, [flare.pass])
  const { composer } = post

  /* ---------- lighting and the hall ---------- */
  const { alarm } = addLights(scene, quality)
  const space = createSpace(scene, TEXTURES, quality !== 'low' && renderer.capabilities.maxTextureSize >= 4096, quality !== 'low')
  const beam = createSunBeam(scene, quality)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const hallLoaded = buildHall(scene, loader, MODELS, TEXTURES)

  /* ---------- wall screens ---------- */
  let data: CabinData | null = null
  const screens = createScreens(canvas.parentElement ?? document.body, import.meta.env.BASE_URL)
  screens.setSize(...size())
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1a232c', roughness: 0.45, metalness: 0.7 })
  const panels = PANELS.map((p, i) => {
    const c = document.createElement('canvas'); c.width = SW; c.height = SH
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
    const g = new THREE.Group()
    // a bezel with a little depth and two brackets into the wall, so the screen reads as mounted
    const back = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.16, PH + 0.16, 0.1), frameMat)
    back.position.z = -0.05
    const lip = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.04, 0.025, 0.02), new THREE.MeshStandardMaterial({ color: '#0b1218', emissive: C.cy, emissiveIntensity: 1.4 }))
    lip.position.set(0, -PH / 2 - 0.055, 0.005)
    for (const x of [-PW / 3, PW / 3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.6), frameMat); b.position.set(x, 0, -0.38); g.add(b) }
    const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
    face.position.z = 0.002; face.userData.panel = i
    back.castShadow = true
    g.add(back, lip, face); g.rotation.y = -p.side * (Math.PI / 2) // flat against its wall, facing the middle of the hall
    g.position.set(p.side * (HALF - 1), PY, p.z)
    scene.add(g)
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(g.rotation)
    const light = new THREE.PointLight(C.cy, 1.0, 5, 2); scene.add(light)
    const at = () => { light.position.copy(g.position).addScaledVector(normal, 1.2); screens.place(i, face.getWorldPosition(new THREE.Vector3()), g.rotation.y) }
    screens.add(p.screen, PW, PH); g.updateMatrixWorld(); at()
    return { ctx: c.getContext('2d'), tex, face, g, pos: g.position, normal, draw: p.draw, at }
  })
  /**
   * Hangs each screen on the wall: rays across its footprint find how far the wall's pipes and ribs reach into the
   * hall; the screen goes on the flattest stretch near its spot, its back just clear of the nearest part.
   */
  function mount(hall: THREE.Object3D) {
    const ray = new THREE.Raycaster(), dir = new THREE.Vector3()
    hall.updateMatrixWorld(true)
    panels.forEach((p, i) => {
      const side = PANELS[i].side
      dir.set(side, 0, 0)
      const reach = (z: number) => { // the smallest |x| the wall reaches over a screen centred at z
        let min = HALF
        for (let a = 0; a <= 6; a++) for (let b = 0; b <= 4; b++) {
          ray.set(new THREE.Vector3(side * 2, PY - PH / 2 - 0.05 + (b / 4) * (PH + 0.1), z - PW / 2 - 0.05 + (a / 6) * (PW + 0.1)), dir)
          const hit = ray.intersectObject(hall, true)[0]
          if (hit) min = Math.min(min, 2 + hit.distance)
        }
        return min
      }
      let best = { z: PANELS[i].z, x: reach(PANELS[i].z), score: -Infinity }
      for (let dz = -2.5; dz <= 2.5; dz += 0.25) {
        const z = PANELS[i].z + dz, x = reach(z), score = x - Math.abs(dz) * 0.08
        if (score > best.score) best = { z, x, score }
      }
      p.g.position.set(side * Math.max(best.x - 0.11, 4.6), PY, best.z)
      p.g.updateMatrixWorld(); p.at()
    })
  }
  /** Beside panel `i`: a metre in front of it and 2.4 m toward its outer edge. */
  const beside = (i: number, dy: number): V3 => {
    const p = panels[i], t = new THREE.Vector3(-p.normal.z, 0, p.normal.x).multiplyScalar(PANELS[i].side < 0 ? 1 : -1)
    return p.pos.clone().addScaledVector(p.normal, 1.0).addScaledVector(t, 2.4).add(new THREE.Vector3(0, dy, 0)).toArray() as V3
  }

  /* ---------- crew: the focus member beside Live Vitals, the rest by roster order ---------- */
  const slots = (): { pos: V3; rot: V3 }[] => [
    { pos: beside(1, -0.9), rot: [0, -0.8, 0.08] },
    { pos: [-2.2, -0.9, -11.5], rot: [0, 0.9, 0.05] },
    { pos: [2.2, -0.4, -11.8], rot: [0.2, -0.9, -0.15] },
    { pos: beside(0, -0.9), rot: [0, 0.8, -0.08] },
    { pos: beside(2, -1.0), rot: [0.1, 0.8, 0.06] },
    { pos: beside(3, 0.7), rot: [Math.PI - 0.25, -0.8, 0] },
    { pos: [-1.6, 1.2, 4], rot: [0.4, 0.3, 0.6] },
    { pos: [1.8, 1.4, -4], rot: [-0.3, -0.5, -0.5] },
  ]
  let SLOTS = slots()
  const crew = createCrew(scene, loader, MODELS)
  const eva = createEva(scene, loader, MODELS)
  let placedKey = ''
  function place() {
    if (!data) return
    const out = evaCrewId(data)
    const order = [data.focusId, ...data.crew.map((c) => c.id).filter((id) => id !== data!.focusId && id !== out)]
    const key = `${data.focusId}|${out}|${data.crew.map((c) => c.id).join(',')}`
    if (key === placedKey || !crew.get(order[0])) return // not loaded yet
    placedKey = key
    SLOTS = slots()
    order.forEach((id, i) => {
      const a = crew.get(id), slot = SLOTS[i % SLOTS.length]
      if (!a) return
      a.base.set(...slot.pos); a.rot.set(...slot.rot)
    })
    const spacewalker = out ? crew.get(out) : null
    if (spacewalker) { spacewalker.base.set(...EVA.pos); spacewalker.rot.set(...EVA.rot) }
    crew.hideOthers(out ? [...order, out] : order)
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
      { pos: EVA_VIEW.pos.clone(), look: EVA_VIEW.look.clone() },
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
    const hit = ray.intersectObjects([...panels.map((x) => x.face), ...crew.holders()], true)[0]
    if (!hit) return
    const panel = hit.object.userData.panel as number | undefined
    if (panel !== undefined) { goTo([2, 3, 5, 6][panel]); return }
    const id = hit.object.userData.crew as string | undefined, a = id ? crew.find(id) : undefined
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
    renderer.setSize(w, hh, false); composer.setSize(w, hh); screens.setSize(w, hh)
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
  let raf = 0, lastDraw = 0, disposed = false, ready = false, downgraded = false
  const slow = { n: 0, sum: 0 }
  let frameNo = 0
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

    const live = new Map<string, CabinCrew>((data?.crew ?? []).map((c) => [c.id, c]))
    crew.animate(live, data?.focusId, t, dt, still, reduced, camera, alarm)
    if (data && t - lastDraw > 0.05) { // panels and tags at about 20 fps
      lastDraw = t
      for (const x of panels) if (x.ctx) { x.draw(x.ctx, data, t); x.tex.needsUpdate = true }
      crew.drawTags(live, t)
    }
    if (p > 5) eva.load()
    space.update(t, still); beam.update(t, still); post.update(t, still); eva.update(still, p); flare.update(reduced)
    if (frameNo++ % 6 === 0) renderer.shadowMap.needsUpdate = true
    composer.render(dt)
    screens.render(camera, crew.holders().filter((h) => h.visible).map((h) => h.getWorldPosition(new THREE.Vector3())), dt)
    // step down once if the first seconds run slow (frame times are only trusted after the scene is ready)
    if (ready && !downgraded) {
      slow.n++; slow.sum += dt
      if (slow.n === 90) { downgraded = true; if (slow.sum / slow.n > 1 / 40) post.downgrade() }
    }
  }
  frame()
  void Promise.all([hallLoaded, crew.loaded]).then(([hall]) => {
    if (disposed) return
    if (hall) mount(hall)
    placedKey = ''; place(); renderer.shadowMap.needsUpdate = true; ready = true; opts.onReady()
    loadScreens()
  })
  /** The console views follow the cabin: your own board, and vitals, alerts and trends for the focus crew member. */
  function loadScreens() {
    if (!ready || !data) return
    const crewFor = [data.selfId, data.focusId, data.focusId, data.focusId]
    PANELS.forEach((_, i) => screens.load(i, crewFor[i] ?? null, i * 1200))
  }

  return {
    update(d) { data = d; place(); loadScreens() },
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
      for (const s of [scene, flare.pass.scene]) s.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) { (mat as THREE.MeshBasicMaterial).map?.dispose(); mat.dispose() }
      })
      scene.environment?.dispose(); pmrem.dispose(); composer.dispose(); renderer.dispose(); screens.dispose()
    },
  }
}
