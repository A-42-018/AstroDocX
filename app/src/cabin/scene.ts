import * as THREE from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CabinCrew, CabinData } from './data'
import { createCrew } from './crew'
import { createSpace, SUN_AT } from './earth'
import { createEva, EVA, EVA_VIEW, evaCrewId } from './eva'
import { buildHall, HALF } from './hall'
import { addLights, createFlare, createPost, createSunBeam, pickQuality, windowEnvironment } from './lighting'
import { C, SH, SW, drawAlerts, drawLiveVitals, drawStatusBoard, drawTrends } from './panels'
import { createScreens, type ScreenSpec } from './screens'

/*
 * The 3D cabin: the hall (hall.ts, lighting.ts), four wall screens running the real console (screens.ts), the crew
 * floating beside them (crew.ts), and a scroll-driven camera touring nine stops from a helmet view at the
 * door, past a look back from the window, out to a crew member on EVA beside the station (eva.ts).
 */

export const STOP_COUNT = 10
/** The arrival: flying in from space (`fly`), holding out there while the hall loads (`wait`), the glare (`lock`), the visor clearing (`clear`). */
export type IntroPhase = 'fly' | 'wait' | 'lock' | 'clear' | 'off'
export interface CabinOptions {
  reducedMotion: boolean
  /** Play the arrival from space before the tour; otherwise the tour starts in the helmet. */
  intro: boolean
  /** Fades and scales with the helmet stop (0 = fully in the helmet). */
  visor: HTMLElement | null
  /** The arrival's glare, over everything, and the mist on the visor glass, under the HUD. */
  flash: HTMLElement | null
  mist: HTMLElement | null
  onIntro: (phase: IntroPhase) => void
  onStop: (i: number) => void
  onPick: (crewId: string | null) => void
  onReady: () => void
}
export interface CabinScene {
  update: (d: CabinData) => void
  goTo: (i: number) => void
  /** Cut the arrival short (as soon as the hall is ready). */
  skipIntro: () => void
  replayIntro: () => void
  dispose: () => void
}

/*
 * The arrival: a timed flight from a wide view of Earth, the sun and the station in toward the station, kept behind the
 * hall (z < -20, looking away from it) since the hall is only modelled from inside. At the sun's glare the camera cuts
 * to the helmet stop, and the visor closes in, misted, as the glare fades.
 */
const FLY = { pos: [new THREE.Vector3(-45, 55, -40), new THREE.Vector3(-8, 26, -58), new THREE.Vector3(15, 14, -80)], look: [new THREE.Vector3(18, 0, -132), new THREE.Vector3(24, 6, -116), new THREE.Vector3(27.9, 10.4, -106.5)] }
const FLY_S = 4.6, LOCK_S = 0.7, CLEAR_S = 1.5, FLY_EXPOSURE = 0.8
/** A wide lens for the overall view, narrowing to the tour's as the camera closes in. */
const FOV = 58, FLY_FOV = 74
const ease = (x: number) => x * x * (3 - 2 * x)

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
/**
 * Eye adaptation: the exposure at each tour stop, eased between stops as the camera moves. The helmet's visor takes a
 * little light off at the first stop; facing the sun at the forward window the eye stops down, so the sunlit floor
 * there keeps its tread plate instead of burning out.
 */
const EXPOSURE = [0.86, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 0.55, 1.1, 1.1]
const exposureAt = (p: number) => {
  const i = Math.min(Math.floor(p), EXPOSURE.length - 2), f = THREE.MathUtils.smoothstep(p - i, 0, 1)
  return THREE.MathUtils.lerp(EXPOSURE[i], EXPOSURE[i + 1], f)
}

/**
 * The triangles of `root` (in world space) whose bounds touch `box`, as one mesh to raycast against. Faces keep their
 * winding, so rays still pass through back faces as they do on the hall itself.
 */
function wallPatch(root: THREE.Object3D, box: THREE.Box3) {
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

/** Throws when WebGL is unavailable; the page shows its fallback then. */
export function createCabin(canvas: HTMLCanvasElement, opts: CabinOptions): CabinScene {
  const quality = pickQuality()
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' })
  const size = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight] as const
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1.5))
  renderer.setSize(...size(), false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = exposureAt(0)
  renderer.shadowMap.enabled = quality !== 'low'
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false // the hall is static and the crew drift slowly: refreshed every few frames in the loop
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#05080d')
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(windowEnvironment(), 0.02).texture // the metal reflects the bright window, not a studio
  scene.environmentIntensity = quality === 'low' ? 0.6 : 0.8 // low has no ambient occlusion to darken the crevices
  const camera = new THREE.PerspectiveCamera(FOV, size()[0] / size()[1], 0.08, 2000) // far enough for Earth and the stars
  const flare = createFlare(camera, SUN_AT)
  const post = createPost(renderer, scene, camera, ...size(), quality, [flare.pass])
  const { composer } = post

  /* ---------- lighting and the hall ---------- */
  const { alarm, crewKey, sunPool } = addLights(scene, quality)
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
      // only the stretch of wall the rays can reach: the whole hall is too many triangles to test 700 rays against
      const reachZ = 2.5 + PW / 2 + 0.1
      const near = wallPatch(hall, new THREE.Box3(
        new THREE.Vector3(side < 0 ? -HALF - 1 : 2, PY - PH / 2 - 0.1, PANELS[i].z - reachZ),
        new THREE.Vector3(side < 0 ? -2 : HALF + 1, PY + PH / 2 + 0.1, PANELS[i].z + reachZ)))
      const reach = (z: number) => { // the smallest |x| the wall reaches over a screen centred at z
        let min = HALF
        for (let a = 0; a <= 6; a++) for (let b = 0; b <= 4; b++) {
          ray.set(new THREE.Vector3(side * 2, PY - PH / 2 - 0.05 + (b / 4) * (PH + 0.1), z - PW / 2 - 0.05 + (a / 6) * (PW + 0.1)), dir)
          const hit = ray.intersectObject(near, false)[0]
          if (hit) min = Math.min(min, 2 + hit.distance)
        }
        return min
      }
      let best = { z: PANELS[i].z, x: reach(PANELS[i].z), score: -Infinity }
      for (let dz = -2.5; dz <= 2.5; dz += 0.25) {
        const z = PANELS[i].z + dz, x = reach(z), score = x - Math.abs(dz) * 0.08
        if (score > best.score) best = { z, x, score }
      }
      near.geometry.dispose()
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
  let focus: { pos: THREE.Vector3; look: THREE.Vector3; id: string } | null = null
  const camPos = posCurve.getPoint(0), camLook = lookCurve.getPoint(0)
  const drag = { on: false, moved: 0, x: 0, y: 0, yaw: 0, pitch: 0 }

  /* ---------- the arrival ---------- */
  const flyPos = new THREE.CatmullRomCurve3(FLY.pos, false, 'centripetal'), flyLook = new THREE.CatmullRomCurve3(FLY.look, false, 'centripetal')
  let intro: IntroPhase = 'off', introT0 = 0, skipAsked = false, flyU = 0, creep = 0
  const setIntro = (ph: IntroPhase, t: number) => { if (ph === 'fly') flyU = creep = 0; intro = ph; introT0 = t; opts.onIntro(ph) }
  const flashColor = reduced ? '#02070c' : ''
  if (opts.flash && flashColor) opts.flash.style.background = flashColor // reduced motion: a plain fade through dark
  const arriving = () => intro !== 'off'
  /** Any input during the flight asks to be let in: the glare starts once the hall is ready. */
  const skipIntro = () => { if (intro === 'fly' || intro === 'wait') skipAsked = true }

  const unfocus = () => { if (focus) { focus = null; opts.onPick(null) } }
  const goTo = (i: number) => { unfocus(); pTarget = THREE.MathUtils.clamp(i, 0, N - 1); if (reduced) p = pTarget }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (arriving()) { skipIntro(); return }
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
    if (arriving()) { if (e.key !== 'Escape') skipIntro(); return }
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
    focus = { pos: a.base.clone().addScaledVector(toCam, 2.6).add(new THREE.Vector3(0, 0.35, 0)), look: a.base.clone(), id }
    opts.onPick(id)
  }
  const onDown = (e: PointerEvent) => { drag.on = true; drag.moved = 0; drag.x = e.clientX; drag.y = e.clientY; canvas.classList.add('dragging') }
  const onUp = (e: PointerEvent) => {
    canvas.classList.remove('dragging')
    if (arriving()) { if (drag.on) skipIntro(); drag.on = false; drag.yaw = drag.pitch = 0; return }
    if (drag.on && drag.moved < 5) pick(e); drag.on = false
  }
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
    if (arriving()) { arrive(t, dt); finishFrame(t, dt, still); return }
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
    renderer.toneMappingExposure = exposureAt(p)
    const stop = Math.round(p)
    if (stop !== shown) { shown = stop; opts.onStop(stop) }
    finishFrame(t, dt, still)
  }
  function setFov(f: number) { if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix() } }
  /** Moves the camera through the arrival and drives its glare, mist and visor. */
  function arrive(t: number, dt: number) {
    const e = t - introT0
    if (intro === 'fly' && e >= (reduced ? 1 : FLY_S)) setIntro('wait', t)
    if (intro === 'wait' && ready && (skipAsked || reduced || t - introT0 > 0.4)) setIntro('lock', t)
    if (intro === 'fly' && skipAsked && ready) setIntro('lock', t)
    const k = t - introT0
    if (intro === 'lock' && k >= (reduced ? 0.3 : LOCK_S)) {
      // the cut, hidden by the glare: into the helmet at the door
      p = pTarget = 0; camPos.copy(posCurve.getPoint(0)); camLook.copy(lookCurve.getPoint(0)); shown = -1
      setIntro('clear', t)
      opts.visor?.classList.add('booting')
    }
    if (intro === 'clear' && k >= (reduced ? 0.5 : CLEAR_S)) {
      setIntro('off', t)
      opts.visor?.classList.remove('booting')
      if (opts.flash) opts.flash.style.opacity = '0'
      if (opts.mist) { opts.mist.style.opacity = '0'; opts.mist.style.backdropFilter = '' }
      return
    }
    const flash = opts.flash?.style, mist = opts.mist?.style
    if (intro === 'clear') {
      const c = Math.min(1, k / (reduced ? 0.5 : CLEAR_S)), helmetIn = ease(Math.min(1, c * 1.6)), fog = 1 - ease(c)
      if (flash) flash.opacity = String(1 - ease(Math.min(1, c * 2.4)))
      if (mist) { mist.opacity = String(reduced ? 0 : fog); mist.backdropFilter = reduced ? '' : `blur(${(fog * 12).toFixed(1)}px)` }
      if (opts.visor) { opts.visor.style.opacity = String(helmetIn); opts.visor.style.transform = `scale(${reduced ? 1 : 1 + (1 - helmetIn) * 0.45})` }
      camera.position.copy(camPos); camera.lookAt(camLook); setFov(FOV)
      renderer.toneMappingExposure = exposureAt(0)
      return
    }
    // out in space: no helmet yet
    if (opts.visor) { opts.visor.style.opacity = '0'; opts.visor.style.transform = 'scale(1.45)' }
    if (mist) mist.opacity = '0'
    if (!reduced && intro === 'fly') flyU = ease(Math.min(1, e / FLY_S)) // a skip freezes it where it is
    const pos = flyPos.getPoint(flyU), look = flyLook.getPoint(flyU)
    // after the flight the camera keeps creeping in toward the station, speeding up into the glare
    if (!reduced && intro !== 'fly') creep += dt * (0.8 + (intro === 'lock' ? k * 40 : 0))
    pos.addScaledVector(look.clone().sub(pos).normalize(), creep)
    camera.position.copy(pos); camera.lookAt(look)
    setFov(THREE.MathUtils.lerp(FLY_FOV, FOV, flyU))
    if (flash) flash.opacity = intro === 'lock' ? String(ease(Math.min(1, k / (reduced ? 0.3 : LOCK_S)))) : '0'
    renderer.toneMappingExposure = FLY_EXPOSURE + (intro === 'lock' ? k * 1.2 : 0)
  }
  function finishFrame(t: number, dt: number, still: number) {
    const live = new Map<string, CabinCrew>((data?.crew ?? []).map((c) => [c.id, c]))
    crew.animate(live, data?.focusId, focus?.id ?? data?.focusId, t, dt, still, reduced, camera, alarm, crewKey)
    if (data && t - lastDraw > 0.05) { // panels and tags at about 20 fps
      lastDraw = t
      for (const x of panels) if (x.ctx) { x.draw(x.ctx, data, t); x.tex.needsUpdate = true }
      crew.drawTags(live, t)
    }
    if (p > 5 || arriving()) eva.load()
    // the station shows from the forward window on, and all through the arrival
    space.update(t, still); beam.show(!arriving() || intro === 'clear'); beam.update(t, still); post.update(t, still); eva.update(still, arriving() && intro !== 'clear' ? N - 1 : p); flare.update(reduced)
    if (frameNo++ % 6 === 0) renderer.shadowMap.needsUpdate = true
    composer.render(dt)
    screens.render(camera, crew.holders().filter((h) => h.visible).map((h) => h.getWorldPosition(new THREE.Vector3())), dt)
    // step down once if the first seconds run slow (frame times are only trusted after the scene is ready)
    if (ready && !downgraded) {
      slow.n++; slow.sum += dt
      if (slow.n === 90) { downgraded = true; if (slow.sum / slow.n > 1 / 40) post.downgrade() }
    }
  }
  if (opts.intro) setIntro('fly', 0)
  frame()
  void Promise.all([hallLoaded, crew.loaded]).then(([hall]) => {
    if (disposed) return
    if (hall) { mount(hall); sunPool?.bake(renderer) }
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
    skipIntro,
    replayIntro() { unfocus(); skipAsked = false; setIntro('fly', clock.elapsedTime) },
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
      scene.environment?.dispose(); sunPool?.dispose(); pmrem.dispose(); composer.dispose(); renderer.dispose(); screens.dispose()
    },
  }
}
