import * as THREE from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CabinCrew, CabinData } from './data'
import { createConsoles } from './consoles'
import { createCrew } from './crew'
import { addDecor } from './decor'
import { createSpace, SUN_AT } from './earth'
import { createEva, EVA, evaCrewId } from './eva'
import { buildHall, FLOOR, HALF, LEN, SUN_LAYER, TOP } from './hall'
import { addLights, createFlare, createPost, createSunBeam, pickQuality, windowEnvironment } from './lighting'
import { C, SH, SW, drawAlerts, drawLiveVitals, drawStatusBoard, drawTrends } from './panels'
import { createRobots } from './robots'
import { createScreens, type ScreenSpec } from './screens'
import { BOOST, PITCH_MAX, SPEED, anglesOf, constrain, dirOf, wanted, type HallBounds } from './float'
import { dampQuat, smoothDamp, smoothDampV, type Spring } from './motion'
import { LOOK_D as LOOK_AHEAD, closeShot, fitStop, fovFor, layout, type ScreenAt, type Stop, type Walls } from './shots'
import { wallMap, wallProbe } from './wall'
import { learn } from '../shell/perf'

/*
 * The 3D cabin: the hall (hall.ts, lighting.ts) with its working consoles (consoles.ts), four wall screens running the real console (screens.ts), the crew
 * floating beside them (crew.ts, placed with the camera's stops in shots.ts), the robots VITA and MEDI walking the floor (robots.ts), and a scroll-driven camera touring ten stops from a helmet view at the
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
  /** VITA, the robot crew doctor, was clicked: the camera comes to her and she turns to listen. */
  onPickVita?: () => void
  /** The visor going up, sliding down, and the HUD booting, for sound. */
  onVisor?: (phase: 'raised' | 'dropping' | 'booting' | 'down') => void
  onReady: () => void
  /** Float mode went on or off (also when the scene ends it itself, e.g. a stop was picked). */
  onFloat?: (on: boolean) => void
  /** A wall screen was stepped up to (its index) or stepped back from (null). */
  onScreen?: (i: number | null) => void
  /** The page on a wall screen changed: its path and title. */
  onScreenPage?: (i: number, path: string, label: string) => void
  /** 0–1 as the models and textures arrive, for the loading screen. */
  onProgress?: (fraction: number) => void
}
export interface CabinScene {
  update: (d: CabinData) => void
  goTo: (i: number) => void
  /** Float mode: drift freely through the hall, kept inside it. Off flies back to the nearest stop. */
  setFloat: (on: boolean) => void
  /** Step up to wall screen `i` (0 Status Board, 1 Live Vitals, 2 Alerts, 3 Trends): the camera comes head-on and the screen takes touch, the wheel and keys. */
  stepUp: (i: number) => void
  /** Step back from the screen in use, to the stop or float pose it was entered from. */
  leaveScreen: () => void
  /** Open a console page (a path such as /doctor) on screen `i`. */
  screenNav: (i: number, path: string) => void
  /** The on-screen stick and lift buttons: strafe and forward in -1..1 (forward up is +1), lift -1..1. */
  move: (strafe: number, forward: number, lift?: number) => void
  /** Cut the arrival short (as soon as the hall is ready). */
  skipIntro: () => void
  replayIntro: () => void
  /** Play the helmet going on at the first stop: the visor slides down, then the HUD boots. */
  lowerVisor: () => void
  /** VITA is speaking (her face pulses, she stops and faces the camera), or has stopped (she walks on a moment later). */
  vitaTalk: (on: boolean) => void
  dispose: () => void
}

/*
 * The arrival: a timed flight from a wide view of Earth, the sun and the station in toward the station, kept behind the
 * hall (z < -20, looking away from it) since the hall is only modelled from inside. At the sun's glare the camera cuts
 * to the helmet stop, and the visor closes in, misted, as the glare fades.
 */
const FLY = { pos: [new THREE.Vector3(-45, 55, -40), new THREE.Vector3(-8, 26, -58), new THREE.Vector3(15, 14, -80)], look: [new THREE.Vector3(18, 0, -132), new THREE.Vector3(24, 6, -116), new THREE.Vector3(27.9, 10.4, -106.5)] }
const FLY_S = 4.6, LOCK_S = 0.7, CLEAR_S = 1.5, FLY_EXPOSURE = 0.8
/**
 * The helmet going on at the first stop (after the arrival, on coming back to it, on opening the cabin): the rim closes
 * in (RIM_S), the visor glass slides down over it (from VISOR_AT, for VISOR_S), then the HUD boots on the glass
 * (BOOT_S, the CSS stagger in cabin.css) and the caption lands. Off while the tour is away from the helmet.
 */
const RIM_S = 0.45, VISOR_AT = 0.25, VISOR_S = 0.7, BOOT_S = 1.0
/** A wide lens for the overall view, narrowing to the tour's as the camera closes in. */
const FOV = 58, FLY_FOV = 74
const ease = (x: number) => x * x * (3 - 2 * x)

const MODELS = `${import.meta.env.BASE_URL}models/`, TEXTURES = `${import.meta.env.BASE_URL}textures/`

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
/** The tour stop that shows each wall screen, to the screen's index: Enter steps up to it. */
const SCREEN_AT: Record<number, number> = { 2: 0, 3: 1, 5: 2, 6: 3 }
/** The bar across the top while a screen is in use (cabin.css .cabin-use), in pixels. */
const USE_BAR = 68
/**
 * Eye adaptation: the exposure at each tour stop, eased between stops as the camera moves. The helmet's visor takes a
 * little light off at the first stop; facing the sun at the forward window the eye stops down, so the sunlit floor
 * there keeps its tread plate instead of burning out, and it stays stopped down looking back down the sunlit hall.
 */
const EXPOSURE = [0.86, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 0.55, 0.7, 1.1]
const exposureAt = (p: number) => {
  const i = Math.min(Math.floor(p), EXPOSURE.length - 2), f = THREE.MathUtils.smoothstep(p - i, 0, 1)
  return THREE.MathUtils.lerp(EXPOSURE[i], EXPOSURE[i + 1], f)
}

/** Throws when WebGL is unavailable; the page shows its fallback then. */
export function createCabin(canvas: HTMLCanvasElement, opts: CabinOptions): CabinScene {
  const quality = pickQuality()
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' })
  const size = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight] as const
  // with 4x MSAA, 2x on a Retina screen looks the same and costs ~1.8x the pixels; below high, one pixel per CSS pixel
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 1))
  renderer.setSize(...size(), false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = exposureAt(0)
  renderer.shadowMap.enabled = quality !== 'low'
  renderer.shadowMap.type = quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap // soft filtering samples the map many times a pixel
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
  const { alarm, crewKey, sunPool, shrinkShadow } = addLights(scene, quality)
  const space = createSpace(scene, TEXTURES, quality !== 'low' && renderer.capabilities.maxTextureSize >= 4096, quality !== 'low')
  const beam = createSunBeam(scene)
  // the loaders all report to three's default manager; files keep joining the queue, so the loader never lets the bar go back
  const manager = THREE.DefaultLoadingManager, prevProgress = manager.onProgress
  manager.onProgress = (_url, loaded, total) => { if (!ready) opts.onProgress?.(total ? loaded / total : 0) }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const { maps, loaded: hallLoaded } = buildHall(scene, loader, MODELS, TEXTURES)

  /* ---------- wall screens ---------- */
  let data: CabinData | null = null
  const screens = createScreens(canvas.parentElement ?? document.body, import.meta.env.BASE_URL, {
    onUse: (i) => stepUp(i),
    onRoute: (i, path, label) => opts.onScreenPage?.(i, path, label),
    onEscape: () => leaveScreen(),
  })
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
    panels.forEach((p, i) => {
      const side = PANELS[i].side
      const reachZ = 2.5 + PW / 2 + 0.1
      const probe = wallProbe(hall, side, PY - PH / 2, PY + PH / 2, PANELS[i].z - reachZ, PANELS[i].z + reachZ)
      const reach = (z: number) => { // the smallest |x| the wall reaches over a screen centred at z
        let min = HALF
        for (let a = 0; a <= 6; a++) for (let b = 0; b <= 4; b++) {
          const r = probe.reach(PY - PH / 2 - 0.05 + (b / 4) * (PH + 0.1), z - PW / 2 - 0.05 + (a / 6) * (PW + 0.1))
          if (r !== null) min = Math.min(min, r)
        }
        return min
      }
      let best = { z: PANELS[i].z, x: reach(PANELS[i].z), score: -Infinity }
      for (let dz = -2.5; dz <= 2.5; dz += 0.25) {
        const z = PANELS[i].z + dz, x = reach(z), score = x - Math.abs(dz) * 0.08
        if (score > best.score) best = { z, x, score }
      }
      probe.dispose()
      p.g.position.set(side * Math.max(best.x - 0.11, 4.6), PY, best.z)
      p.g.updateMatrixWorld(); p.at()
    })
  }
  /* ---------- crew and tour: placed and framed in shots.ts ---------- */
  const screensAt = (): ScreenAt[] => panels.map((x) => ({ pos: x.pos.clone(), normal: x.normal.clone(), w: PW, h: PH }))
  let walls: Walls | null = null // the walls' depth maps, once the hall has loaded
  let inHall = 5
  let plan = layout(screensAt(), inHall)
  let SLOTS = plan.slots, STOPS: Stop[] = plan.stops
  /** The stops as the window's shape needs them (shots.ts fitStop): the camera backs off where a narrow window would cut the subjects off. */
  let FIT: Stop[] = STOPS, fitKey = 0
  function relayout(count: number) { inHall = count; plan = layout(screensAt(), count, walls); SLOTS = plan.slots; STOPS = plan.stops; buildPath() }
  let decor: ReturnType<typeof addDecor> | null = null
  const crew = createCrew(scene, loader, MODELS)
  const eva = createEva(scene, loader, MODELS)
  const consoles = createConsoles(scene, loader, MODELS)
  const robots = createRobots(scene, loader, MODELS)
  let placedKey = ''
  function place() {
    if (!data) return
    const out = evaCrewId(data)
    const order = [data.focusId, ...data.crew.map((c) => c.id).filter((id) => id !== data!.focusId && id !== out)]
    const key = `${data.focusId}|${out}|${data.crew.map((c) => c.id).join(',')}`
    if (key === placedKey || !crew.get(order[0])) return // not loaded yet
    placedKey = key
    if (order.length !== inHall) relayout(order.length)
    order.forEach((id, i) => {
      const a = crew.get(id), slot = SLOTS[i % SLOTS.length]
      if (!a) return
      a.base.set(...slot.pos); a.rot.set(...slot.rot)
    })
    const spacewalker = out ? crew.get(out) : null
    if (spacewalker) { spacewalker.base.set(...EVA.pos); spacewalker.rot.set(...EVA.rot) }
    crew.hideOthers(out ? [...order, out] : order)
  }

  /* ---------- the tour ---------- */
  let posCurve = new THREE.CatmullRomCurve3(), lookCurve = new THREE.CatmullRomCurve3()
  function buildPath() {
    FIT = STOPS.map((x) => fitStop(x, camera.aspect, walls)); fitKey = Math.round(camera.aspect * 4)
    posCurve = new THREE.CatmullRomCurve3(FIT.map((x) => x.pos.clone()), false, 'centripetal')
    lookCurve = new THREE.CatmullRomCurve3(FIT.map((x) => x.look.clone()), false, 'centripetal')
  }
  /** The lens along the tour, eased between stops like the exposure; a stop's own lens depends on the window's shape. */
  const fovAt = (q: number) => {
    const i = Math.min(Math.floor(q), FIT.length - 2), f = THREE.MathUtils.smoothstep(q - i, 0, 1)
    return THREE.MathUtils.lerp(fovFor(FIT[i], camera.aspect), fovFor(FIT[i + 1], camera.aspect), f)
  }
  buildPath()

  const N = STOP_COUNT, reduced = opts.reducedMotion
  let p = 0, pTarget = 0, snapTimer = 0, shown = -1
  let focus: { pos: THREE.Vector3; look: THREE.Vector3; id: string } | null = null
  /** The camera spring's smooth time: short on the path, long when it has to come in from elsewhere. */
  let camT = 0.12
  /** A wall screen being used: where the camera stands head-on to it, and where to return to. */
  interface Using { i: number; pos: THREE.Vector3; look: THREE.Vector3; fov: number; width: number; flat?: [number, number, number]; ready: boolean; leaving: boolean; back: { float: boolean; pos: THREE.Vector3; yaw: number; pitch: number } }
  let using: Using | null = null
  /** VITA talking, and until when she keeps facing the camera after a click or her last word. */
  let vitaTalking = false, vitaHold = 0
  const camPos = posCurve.getPoint(0), camLook = lookCurve.getPoint(0)
  /* the tour's springs: progress along the path, and the camera's position and look (so every move eases in and out) */
  const pSpring: Spring = { x: 0, v: 0 }, posVel = new THREE.Vector3(), lookVel = new THREE.Vector3()
  const aimM = new THREE.Matrix4(), aimQ = new THREE.Quaternion(), rollQ = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), origin = new THREE.Vector3()
  let aimed = false
  /** Turns the camera toward `dir` (rolled by `roll`), eased by time so a change of look never whips; `snap` cuts straight there. */
  function aim(dir: THREE.Vector3, roll: number, lambda: number, dt: number, snap: boolean) {
    aimM.lookAt(origin, dir, up)
    aimQ.setFromRotationMatrix(aimM).multiply(rollQ.setFromAxisAngle(zAxis, roll))
    if (snap || !aimed) camera.quaternion.copy(aimQ); else dampQuat(camera.quaternion, aimQ, lambda, dt)
    aimed = true
  }
  const drag = { on: false, moved: 0, x: 0, y: 0, yaw: 0, pitch: 0 }
  /* float mode: a free camera kept inside the hall (float.ts). The tour's own position (p) is parked while it runs. */
  const fl = { on: false, want: false, back: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, fov: FOV, exposure: 1.1, impulse: 0, tyaw: 0, tpitch: 0, vyaw: 0, vpitch: 0, goal: null as THREE.Vector3 | null, goalT: 0 }
  const keys = new Set<string>(), pad = { x: 0, y: 0, v: 0 }
  const hall = (): HallBounds => {
    const zs = STOPS.slice(0, N - 1).map((s) => s.pos.z)
    return {
      y0: FLOOR + 0.05, y1: TOP - 0.05, z0: Math.min(-LEN + 1.0, ...zs) - 0.2, z1: Math.max(LEN - 1.0, ...zs) + 0.2,
      reach: (side, y, z) => walls?.[side].reach(y, z) ?? null, half: HALF - 0.1,
    }
  }

  /* ---------- the arrival ---------- */
  const flyPos = new THREE.CatmullRomCurve3(FLY.pos, false, 'centripetal'), flyLook = new THREE.CatmullRomCurve3(FLY.look, false, 'centripetal')
  let intro: IntroPhase = 'off', introT0 = 0, skipAsked = false, flyU = 0, creep = 0
  const setIntro = (ph: IntroPhase, t: number) => { if (ph === 'fly') flyU = creep = 0; intro = ph; introT0 = t; opts.onIntro(ph) }
  const flashColor = reduced ? '#02070c' : ''
  if (opts.flash && flashColor) opts.flash.style.background = flashColor // reduced motion: a plain fade through dark
  const arriving = () => intro !== 'off'
  /* the visor: 'raised' (glass up, HUD off), 'dropping', 'booting', then 'down'; raised with no rim until the page lowers it */
  type VisorPhase = 'raised' | 'dropping' | 'booting' | 'down'
  const visor = { phase: (reduced ? 'down' : 'raised') as VisorPhase, away: false, t0: 0, rimIn: false, rim: reduced ? 1 : 0, drop: reduced ? 1 : 0, shown: 1 }
  const visorClass = (ph: VisorPhase) => { for (const c of ['raised', 'dropping', 'booting']) opts.visor?.classList.toggle(c, c === ph); opts.onVisor?.(ph) }
  const raiseVisor = (away: boolean) => { visor.away = away; if (reduced || visor.phase === 'raised') return; visor.phase = 'raised'; visor.drop = 0; visorClass('raised') }
  const lowerVisor = (t: number, rimIn: boolean) => {
    if (reduced) { visor.phase = 'down'; visor.rim = visor.drop = 1; visorClass('down'); return }
    Object.assign(visor, { phase: 'dropping', away: false, t0: t, rimIn, rim: rimIn ? 0 : 1, drop: 0 }); visorClass('dropping')
  }
  visorClass(visor.phase)
  function stepVisor(t: number) {
    const k = t - visor.t0
    if (visor.phase === 'dropping') {
      visor.rim = visor.rimIn ? ease(Math.min(1, k / RIM_S)) : 1
      visor.drop = ease(THREE.MathUtils.clamp((k - VISOR_AT) / VISOR_S, 0, 1))
      if (k >= VISOR_AT + VISOR_S) { visor.phase = 'booting'; visor.t0 = t; visorClass('booting') }
    } else if (visor.phase === 'booting' && k >= BOOT_S) { visor.phase = 'down'; visorClass('down') }
    opts.visor?.style.setProperty('--drop', visor.drop.toFixed(3))
    post.setVisor(visor.shown * visor.rim, visor.drop)
  }
  /** Any input during the flight asks to be let in: the glare starts once the hall is ready. */
  const skipIntro = () => { if (intro === 'fly' || intro === 'wait') skipAsked = true }

  const unfocus = () => { if (focus) { focus = null; fl.back = true; opts.onPick(null) } }
  /* one wheel gesture: a trackpad swipe with its momentum tail, or a run of mouse notches */
  const wheel = { on: false, anchor: 0, sum: 0, mag: 0, peak: 0 }
  // settle on a stop in the gesture's direction (not the last event's: a momentum tail ends on 0 or a twitch back)
  const settle = () => {
    clearTimeout(snapTimer)
    if (!wheel.on) return
    wheel.on = false
    pTarget = THREE.MathUtils.clamp(wheel.sum > 0 ? Math.ceil(pTarget - 0.05) : Math.floor(pTarget + 0.05), 0, N - 1)
    if (reduced) p = pTarget
  }
  /** Ends float mode: the camera flies on from where it is to the nearest stop in the hall (or on to the one asked for). */
  function leaveFloat() {
    const was = fl.on || fl.want
    fl.want = false
    if (fl.on) {
      fl.on = false; keys.clear(); fl.vel.set(0, 0, 0)
      camPos.copy(camera.position); camLook.copy(camera.position).addScaledVector(dirOf(fl.yaw, fl.pitch), 4)
      let best = 0, near = Infinity
      STOPS.slice(0, N - 1).forEach((s, i) => { const d = s.pos.distanceTo(camera.position); if (d < near) { near = d; best = i } })
      p = pTarget = best; fl.back = true; pSpring.v = 0; posVel.set(0, 0, 0); lookVel.set(0, 0, 0)
      float.last.copy(camPos)
    }
    if (was) opts.onFloat?.(false)
  }
  function beginFloat() {
    fl.want = false; fl.on = true; fl.back = false
    unfocus(); clearTimeout(snapTimer); wheel.on = false
    fl.pos.copy(camera.position); fl.vel.set(0, 0, 0)
    const a = anglesOf(camera.getWorldDirection(new THREE.Vector3()))
    // the helmet looks a little down the hall: start level, so W does not dive into the floor
    fl.yaw = fl.tyaw = a.yaw; fl.pitch = fl.tpitch = Math.abs(a.pitch) < 0.25 ? 0 : a.pitch
    fl.vyaw = fl.vpitch = 0; fl.goal = null
    drag.yaw = drag.pitch = 0
    fl.fov = camera.fov; fl.roll = 0; fl.exposure = renderer.toneMappingExposure
    if (p > 0.65) raiseVisor(true)
  }
  const setFloat = (on: boolean) => {
    if (using) { leaveScreen(); return }
    if (!on) { leaveFloat(); return }
    if (arriving() || fl.on || fl.want) return
    unfocus()
    opts.onFloat?.(true)
    // outside the station there is nothing to explore: come back in to the look from the window first
    if (p > N - 1.6) { fl.want = true; pTarget = N - 2 } else beginFloat()
  }
  const goTo = (i: number) => { if (using) endUse(); leaveFloat(); unfocus(); clearTimeout(snapTimer); wheel.on = false; pTarget = THREE.MathUtils.clamp(i, 0, N - 1); if (reduced) p = pTarget }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey) return // a trackpad pinch, not a scroll
    if (arriving()) { skipIntro(); return }
    if (using) return // the screen in use has its own scrolling
    if (fl.on) { fl.impulse = THREE.MathUtils.clamp(fl.impulse - e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.004, -4, 4); return } // scrolling flies you along your view
    unfocus()
    const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1), mag = Math.abs(d)
    if (!d) return
    // trackpads send pixel deltas (Chrome/Safari report wheelDeltaY as -3x); mice send notches
    const wd = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY
    const pad = e.deltaMode === 0 && (wd === undefined || wd === 0 || Math.abs(wd + 3 * e.deltaY) < 1)
    // a fresh swipe surging out of a decayed momentum tail is a new gesture
    if (wheel.on && pad && wheel.mag < wheel.peak * 0.5 && mag > wheel.mag * 2 && mag > 10) settle()
    if (!wheel.on) Object.assign(wheel, { on: true, anchor: Math.round(pTarget), sum: 0, mag: 0, peak: 0 })
    wheel.sum += d; wheel.mag = mag; wheel.peak = Math.max(wheel.peak, mag)
    // a trackpad swipe glides at most one stop: its momentum can't fling the camera down the hall
    const reach = pad ? 1 : N
    pTarget = THREE.MathUtils.clamp(wheel.anchor + wheel.sum * 0.0022, Math.max(0, wheel.anchor - reach), Math.min(N - 1, wheel.anchor + reach))
    clearTimeout(snapTimer)
    snapTimer = window.setTimeout(settle, 180)
    if (reduced) p = pTarget
  }
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) return
    if (arriving()) { if (e.key !== 'Escape') skipIntro(); return }
    if (using) return // Esc is the page's: it steps back
    if (e.key === 'Enter' && !fl.on) { // at a screen's stop, Enter steps up to it
      const k = SCREEN_AT[Math.round(pTarget)]
      if (k !== undefined) { e.preventDefault(); stepUp(k); return }
    }
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setFloat(!(fl.on || fl.want)); return }
    if (fl.on) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (['w', 'a', 's', 'd', 'q', 'e', 'c', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(k)) { e.preventDefault(); keys.add(k) }
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goTo(Math.round(pTarget) + 1) }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(Math.round(pTarget) - 1) }
  }
  const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key) }
  const onBlur = () => keys.clear()
  const ray = new THREE.Raycaster()
  const aimRay = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
  }
  /** What a click at `e` would hit: a screen's face, a crew member, or VITA. */
  const hitAt = (e: PointerEvent) => {
    aimRay(e)
    const vitaBody = robots.vita.object()
    return ray.intersectObjects([...panels.map((x) => x.face), ...crew.holders(), ...(vitaBody ? [vitaBody] : [])], true)[0]
  }
  const pick = (e: PointerEvent): boolean => {
    const hit = hitAt(e)
    if (!hit) return false
    if (hit.object.userData.vita) {
      const at = robots.vita.position()
      if (!at) return false
      leaveFloat()
      // come to her: 3 m off, at her face height, looking at the display
      const toCam = camera.position.clone().sub(at).setY(0).normalize()
      focus = { pos: at.clone().addScaledVector(toCam, 3).setY(at.y + 1.25), look: at.clone().setY(at.y + 1.0), id: '' }
      robots.vita.attend(focus.pos); vitaHold = clock.elapsedTime + 5
      opts.onPickVita?.()
      return true
    }
    const panel = hit.object.userData.panel as number | undefined
    if (panel !== undefined) { stepUp(panel); return true }
    const id = hit.object.userData.crew as string | undefined, a = id ? crew.find(id) : undefined
    if (!id || !a) return false
    leaveFloat()
    // beside a screen: from where both the astronaut and the screen are in frame; elsewhere, close on them
    const at = screensAt().filter((x) => x.pos.distanceTo(a.base) < 4.5).sort((x, y) => x.pos.distanceTo(a.base) - y.pos.distanceTo(a.base))[0]
    if (at) {
      const cs = closeShot(a.base.clone(), at, walls)
      focus = { pos: cs.stop.pos, look: cs.stop.look, id }
    } else {
      const toCam = camera.position.clone().sub(a.base).setY(0).normalize()
      focus = { pos: a.base.clone().addScaledVector(toCam, 3.2).add(new THREE.Vector3(0, 0.3, 0)), look: a.base.clone().add(new THREE.Vector3(0, 0.25, 0)), id }
    }
    opts.onPick(id)
    return true
  }
  /* touches down on the canvas, for the two-finger pinch; the last tap, for a double tap */
  const touches = new Map<number, { x: number; y: number }>()
  let pinchD = 0, lastTap = { t: 0, x: 0, y: 0 }, lastMove = { t: 0, dyaw: 0, dpitch: 0 }, hoverAt = 0
  const onDown = (e: PointerEvent) => {
    drag.on = true; drag.moved = 0; drag.x = e.clientX; drag.y = e.clientY; canvas.classList.add('dragging')
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); drag.moved = 999 }
    }
    fl.vyaw = fl.vpitch = 0
  }
  /** Float mode: turn to face the spot tapped twice and glide toward it, 3 m or until the hall stops you. */
  function glideToward(e: PointerEvent) {
    aimRay(e)
    const a = anglesOf(ray.ray.direction)
    fl.tyaw = a.yaw; fl.tpitch = THREE.MathUtils.clamp(a.pitch, -0.6, 0.6)
    fl.goal = fl.pos.clone().addScaledVector(ray.ray.direction, 3); fl.goalT = clock.elapsedTime + 2.8
  }
  const onUp = (e: PointerEvent) => {
    canvas.classList.remove('dragging')
    touches.delete(e.pointerId)
    if (arriving()) { if (drag.on) skipIntro(); drag.on = false; drag.yaw = drag.pitch = 0; return }
    const tap = drag.on && drag.moved < 5
    if (tap) {
      if (using) { if (!using.leaving) leaveScreen() } // a tap away from the screen steps back
      else if (!pick(e) && fl.on) { // empty space: a double tap there flies that way
        const now = performance.now()
        if (now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 28) { glideToward(e); lastTap.t = 0 } else lastTap = { t: now, x: e.clientX, y: e.clientY }
      }
    } else if (fl.on && !using && e.pointerType === 'touch' && drag.moved < 999 && performance.now() - lastMove.t < 70) {
      // a flick on a touch screen: the look carries on a moment, slowing
      fl.vyaw = lastMove.dyaw * 40; fl.vpitch = lastMove.dpitch * 40
    }
    drag.on = false
  }
  const onMove = (e: PointerEvent) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.size >= 2) { // a pinch: spreading flies forward, pinching back flies back
      const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y)
      if (fl.on && !using) fl.impulse = THREE.MathUtils.clamp(fl.impulse + (d - pinchD) * 0.012, -4, 4)
      pinchD = d; drag.moved = 999; drag.x = e.clientX; drag.y = e.clientY
      return
    }
    if (!drag.on) { // hover: the pointer says what can be used
      if (e.pointerType !== 'mouse' || e.target !== canvas || using || arriving()) { canvas.classList.remove('can-use'); return }
      const now = performance.now()
      if (now - hoverAt < 90) return
      hoverAt = now
      // cheap on purpose (a skinned body is slow to ray-test every few frames): screen faces, and spheres round the crew and VITA
      aimRay(e)
      const sphere = new THREE.Sphere(), on = ray.intersectObjects(panels.map((x) => x.face), false).length > 0
        || crew.holders().some((h) => h.visible && ray.ray.intersectsSphere(sphere.set(h.position, 1.2)))
        || (() => { const at = robots.vita.position(); return !!at && ray.ray.intersectsSphere(sphere.set(at, 0.8)) })()
      canvas.classList.toggle('can-use', on)
      return
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY
    if (using) return
    if (fl.on) { // float mode: a free look that stays where you leave it (the view eases to it)
      const dyaw = -dx * 0.003, dpitch = -dy * 0.003
      fl.tyaw += dyaw; fl.tpitch = THREE.MathUtils.clamp(fl.tpitch + dpitch, -PITCH_MAX, PITCH_MAX); fl.goal = null
      lastMove = { t: performance.now(), dyaw, dpitch }
      return
    }
    drag.yaw = THREE.MathUtils.clamp(drag.yaw - dx * 0.003, -0.9, 0.9)
    drag.pitch = THREE.MathUtils.clamp(drag.pitch - dy * 0.003, -0.6, 0.6)
  }

  /* ---------- stepping up to a wall screen ---------- */
  /** The pose that frames screen `i` head-on, with a little room round it, and the CSS width its page is laid out at to be legible there. */
  function screenPose(i: number) {
    const x = panels[i], fov = camera.aspect >= 1.3 ? 40 : 40 + Math.min(22, ((1.3 - camera.aspect) / 0.8) * 22)
    const tan = Math.tan((fov * Math.PI) / 360)
    const d = Math.max((PH * 1.14) / 2 / tan, (PW * 1.1) / 2 / (tan * camera.aspect))
    const n = x.normal.clone().setY(0).normalize()
    const dist = Math.min(d, Math.abs(x.pos.x) + HALF - 0.8) // never through the far wall
    const pos = x.pos.clone().addScaledVector(n, dist).setY(x.pos.y)
    // the screen's width on the glass in CSS pixels: the page is laid out at that many, so type is its true size
    const px = ((size()[1] * PW) / (2 * dist * tan))
    // upright on a phone the wall screen would be about a third of the window wide: it fills the window below the bar instead (the console has phone layouts)
    const [vw, vh] = size(), flat: [number, number, number] | undefined = camera.aspect < 0.9 ? [Math.round(vw), Math.round(vh - USE_BAR), USE_BAR] : undefined
    return { pos, look: x.pos.clone(), fov, width: THREE.MathUtils.clamp(Math.round(px), 640, 1700), flat }
  }
  const homeTimers: number[] = []
  function stepUp(i: number) {
    if (arriving() || !ready || !panels[i] || (using && using.i === i && !using.leaving)) return
    window.clearTimeout(homeTimers[i])
    const keep = using?.back
    const back = keep ?? { float: fl.on, pos: camera.position.clone(), yaw: fl.yaw, pitch: fl.pitch }
    if (using && using.i !== i) screens.engage(null)
    unfocus(); clearTimeout(snapTimer); wheel.on = false; keys.clear()
    if (!using) { // the tour's spring takes the camera over from where it stands
      camPos.copy(camera.position); camLook.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(LOOK_AHEAD))
      posVel.set(0, 0, 0); lookVel.set(0, 0, 0); float.last.copy(camPos); fl.vel.set(0, 0, 0); fl.goal = null
    }
    const pose = screenPose(i)
    using = { i, ...pose, ready: false, leaving: false, back }
    opts.onScreen?.(i)
    opts.onScreenPage?.(i, screens.path(i), screens.label(i)) // the page it is already showing
  }
  /** Steps back from the screen in use: to the stop it was entered from (the path's spring brings the camera home), or the float pose. */
  function leaveScreen() {
    const u = using
    if (!u || u.leaving) return
    screens.engage(null); opts.onScreen?.(null)
    window.clearTimeout(homeTimers[u.i]); homeTimers[u.i] = window.setTimeout(() => screens.home(u.i), 20_000) // unattended, it goes back to its own page
    if (u.back.float) { u.leaving = true; u.ready = false; u.pos = u.back.pos.clone(); u.look = u.back.pos.clone().addScaledVector(dirOf(u.back.yaw, u.back.pitch), LOOK_AHEAD); u.fov = FOV }
    else { using = null; fl.back = true }
  }
  /** Drops the screen in use at once (the tour was asked to go somewhere): it is let go of, the camera flies on from where it is. */
  function endUse() {
    const u = using
    if (!u) return
    if (!u.leaving) { screens.engage(null); opts.onScreen?.(null); window.clearTimeout(homeTimers[u.i]); homeTimers[u.i] = window.setTimeout(() => screens.home(u.i), 20_000) }
    using = null; fl.back = true
    if (fl.on) { fl.on = false; keys.clear(); fl.want = false; opts.onFloat?.(false) }
  }
  const onResize = () => {
    const [w, hh] = size()
    camera.aspect = w / hh; camera.updateProjectionMatrix()
    if (Math.round(camera.aspect * 4) !== fitKey) buildPath() // a different window shape: frame the stops for it
    if (using && !using.leaving) { const pose = screenPose(using.i); using.pos = pose.pos; using.look = pose.look; using.fov = pose.fov; using.width = pose.width; using.flat = pose.flat; if (using.ready) screens.engage(using.i, pose.width, pose.flat) }
    renderer.setSize(w, hh, false); composer.setSize(w, hh); screens.setSize(w, hh)
  }
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  window.addEventListener('resize', onResize)

  /* ---------- loop ---------- */
  const clock = new THREE.Clock()
  const up = new THREE.Vector3(0, 1, 0)
  /** The float at a stop: a slow push in once the camera settles, a gentle sway, and a bank into each move between stops. */
  const float = { push: 0, roll: 0, last: new THREE.Vector3(), fov: FOV }
  const fwd = new THREE.Vector3(), side = new THREE.Vector3()
  let raf = 0, lastDraw = 0, disposed = false, ready = false, readyAt = 0
  const frustum = new THREE.Frustum(), viewProj = new THREE.Matrix4()
  const seen = (o: THREE.Object3D) => frustum.intersectsObject(o)
  let frameNo = 0
  // at most 60 frames a second (30 once the governor gives up on 60): a 120 or 144 Hz laptop screen would otherwise
  // have the cabin draw two or more times the frames for no visible gain
  let cap = 60, lastFrame = -Infinity
  const frame = (now = performance.now()) => {
    raf = requestAnimationFrame(frame)
    const iv = 1000 / cap
    if (now - lastFrame < iv - 3.5) return
    lastFrame = Math.max(lastFrame + iv, now - iv) // on the beat, so 144 Hz still averages 60 rather than 48
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05), t = clock.elapsedTime, still = reduced ? 0 : 1
    govern(raw, t)
    if (arriving()) { arrive(t, dt); finishFrame(t, dt, still); return }
    if (fl.want && Math.abs(p - pTarget) < 0.05) beginFloat()
    if (fl.on && !using) { stepFloat(t, dt, still); finishFrame(t, dt, still); return }
    // a critically damped spring along the path: eases in, glides, eases out, and a new target mid-move does not jerk it
    if (reduced) { p = pTarget; pSpring.v = 0 } else { pSpring.x = p; p = smoothDamp(pSpring, pTarget, 0.62, dt, 2.2) }
    const u = p / (N - 1)
    // the camera follows the path tightly; after a pick, a screen or the float it springs in slowly instead
    const soft = !!focus || fl.back || !!using
    camT = reduced ? 0 : THREE.MathUtils.damp(camT, soft ? 0.7 : 0.12, 4, dt)
    const goalPos = using ? using.pos : focus ? focus.pos : posCurve.getPoint(u), goalLook = using ? using.look : focus ? focus.look : lookCurve.getPoint(u)
    if (reduced) { camPos.copy(goalPos); camLook.copy(goalLook) } else { smoothDampV(camPos, posVel, goalPos, camT, dt, 40); smoothDampV(camLook, lookVel, goalLook, camT, dt, 60) }
    if (using) {
      const near = camPos.distanceTo(using.pos) < 0.1 && posVel.length() < 0.2
      if (near && !using.leaving && !using.ready) { using.ready = true; screens.engage(using.i, using.width, using.flat) } // arrived: the screen takes over
      if (near && using.leaving) { // back at the float pose: drift on from here
        fl.pos.copy(using.pos); fl.vel.set(0, 0, 0); fl.yaw = fl.tyaw = using.back.yaw; fl.pitch = fl.tpitch = using.back.pitch; fl.roll = 0
        using = null
      }
    }
    if (fl.back && !focus && !using && camPos.distanceTo(posCurve.getPoint(u)) < 0.08 && Math.abs(pTarget - p) < 0.03) fl.back = false // landed on the tour again
    if (!drag.on) { drag.yaw *= Math.exp(-3.7 * dt); drag.pitch *= Math.exp(-3.7 * dt) }
    const helmet = THREE.MathUtils.clamp(1 - p * 1.6, 0, 1)
    fwd.copy(camLook).sub(camPos).normalize(); side.crossVectors(fwd, up).normalize()
    // settled on a stop (out of the helmet): ease 0.18 m in over a few seconds, let go quickly on the next move
    const settled = !focus && !using && !drag.on && Math.abs(pTarget - p) < 0.03 && p > 0.5
    float.push = THREE.MathUtils.damp(float.push, settled ? 0.18 : 0, settled ? 0.35 : 3, dt)
    // bank into the move: roll against the camera's sideways speed, at most 3 degrees, level again on arrival
    const lateral = dt > 0 ? camPos.clone().sub(float.last).dot(side) / dt : 0
    float.last.copy(camPos)
    float.roll = THREE.MathUtils.damp(float.roll, THREE.MathUtils.clamp(-lateral * 0.012, -0.05, 0.05), 3, dt)
    camera.position.copy(camPos).addScaledVector(fwd, float.push * still)
    // outside, a wider slow arc round the spacewalker, so the station drifts behind them
    const outside = THREE.MathUtils.clamp(p - (N - 2), 0, 1)
    const calm = using ? 0 : 1 // facing a screen to use it: the camera holds still
    camera.position.addScaledVector(side, Math.sin(t * 0.13) * (0.07 + 0.16 * outside) * (1 - helmet) * still * calm)
    camera.position.y += (Math.sin(t * 1.3) * 0.012 * helmet + Math.sin(t * 0.09) * 0.04 * (1 - helmet)) * still * calm
    const dir = camLook.clone().sub(camPos).normalize().applyAxisAngle(up, drag.yaw)
    dir.applyAxisAngle(new THREE.Vector3().crossVectors(dir, up).normalize(), drag.pitch)
    aim(dir, float.roll * still, 11, dt, reduced)
    const fovGoal = using ? using.fov : focus ? 42 : fovAt(p)
    float.fov = reduced ? fovGoal : THREE.MathUtils.damp(float.fov, fovGoal, 4, dt)
    setFov(float.fov)
    // away from the helmet the visor goes up; coming back to it, it comes down again
    if (p > 0.65) raiseVisor(true)
    else if (visor.phase === 'raised' && visor.away && p < 0.5 && pTarget < 0.5) lowerVisor(t, false)
    visor.shown = helmet
    if (opts.visor) { opts.visor.style.opacity = String(helmet * visor.rim); opts.visor.style.transform = `scale(${1 + (1 - helmet) * 0.25 + (1 - visor.rim) * 0.12})` }
    renderer.toneMappingExposure = exposureAt(p)
    const stop = Math.round(p)
    if (stop !== shown) { shown = stop; opts.onStop(stop) }
    finishFrame(t, dt, still)
  }
  const flDir = new THREE.Vector3(), flWant = new THREE.Vector3(), flGoal = new THREE.Vector3()
  /** One frame of float mode: keys, the stick and the wheel steer a drifting camera, kept inside the hall. */
  function stepFloat(t: number, dt: number, still: number) {
    const down = (k: string) => keys.has(k)
    const fwdIn = (down('w') || down('ArrowUp') ? 1 : 0) - (down('s') || down('ArrowDown') ? 1 : 0) + pad.y
    const strIn = (down('d') || down('ArrowRight') ? 1 : 0) - (down('a') || down('ArrowLeft') ? 1 : 0) + pad.x
    const liftIn = (down('e') || down(' ') ? 1 : 0) - (down('q') || down('c') ? 1 : 0) + pad.v
    // the view eases to where the drag put it, and a touch flick carries on a moment
    fl.tyaw += fl.vyaw * dt; fl.tpitch = THREE.MathUtils.clamp(fl.tpitch + fl.vpitch * dt, -PITCH_MAX, PITCH_MAX)
    const slow = Math.exp(-4 * dt); fl.vyaw *= slow; fl.vpitch *= slow
    if (reduced) { fl.yaw = fl.tyaw; fl.pitch = fl.tpitch } else { fl.yaw = THREE.MathUtils.damp(fl.yaw, fl.tyaw, 16, dt); fl.pitch = THREE.MathUtils.damp(fl.pitch, fl.tpitch, 16, dt) }
    dirOf(fl.yaw, fl.pitch, flDir)
    wanted(flDir, THREE.MathUtils.clamp(fwdIn, -1, 1), THREE.MathUtils.clamp(strIn, -1, 1), THREE.MathUtils.clamp(liftIn, -1, 1), down('Shift'), flWant)
    // a wheel notch is a push along the view that fades out, the way a pushed-off object keeps drifting
    flWant.addScaledVector(flDir, fl.impulse * (down('Shift') ? BOOST : 1)); fl.impulse *= Math.exp(-2.5 * dt)
    // a double tap sets a goal to glide to; any key or the stick takes the controls back
    if (fl.goal) {
      const to = flGoal.copy(fl.goal).sub(fl.pos), left = to.length()
      if (left < 0.25 || t > fl.goalT || fwdIn || strIn || liftIn) fl.goal = null
      else flWant.add(to.setLength(Math.min(SPEED * 1.1, left * 1.6)))
    }
    fl.vel.lerp(flWant, 1 - Math.exp(-(flWant.lengthSq() > 0.001 ? 4.5 : 2.6) * dt)) // gets going quickly, coasts to a stop
    if (reduced) fl.vel.copy(flWant)
    fl.pos.addScaledVector(fl.vel, dt)
    constrain(fl.pos, fl.vel, hall(), dt)
    camera.position.copy(fl.pos)
    // the slow drift of weightlessness, and a bank into sideways moves
    camera.position.y += Math.sin(t * 0.9) * 0.012 * still
    camera.lookAt(camera.position.clone().add(flDir))
    const side2 = new THREE.Vector3().crossVectors(flDir, up).normalize()
    fl.roll = THREE.MathUtils.damp(fl.roll, THREE.MathUtils.clamp(-fl.vel.dot(side2) * 0.012, -0.05, 0.05), 3, dt)
    camera.rotateZ(fl.roll * still)
    fl.fov = THREE.MathUtils.damp(fl.fov, FOV, 4, dt); setFov(fl.fov)
    // the helmet's HUD stays on the glass if you went exploring from the first stop
    const helmet = THREE.MathUtils.clamp(1 - p * 1.6, 0, 1)
    visor.shown = helmet
    if (opts.visor) { opts.visor.style.opacity = String(helmet * visor.rim); opts.visor.style.transform = `scale(${1 + (1 - helmet) * 0.25 + (1 - visor.rim) * 0.12})` }
    // facing the sun at the forward window the eye stops down, as it does on the tour
    const facing = THREE.MathUtils.clamp(-flDir.z, 0, 1), near = THREE.MathUtils.clamp(1 - (fl.pos.z + LEN) / 9, 0, 1)
    fl.exposure = THREE.MathUtils.damp(fl.exposure, 1.1 - 0.55 * near * facing, 3, dt)
    renderer.toneMappingExposure = fl.exposure
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
      p = pTarget = 0; pSpring.v = 0; posVel.set(0, 0, 0); lookVel.set(0, 0, 0); camT = 0.12; camPos.copy(posCurve.getPoint(0)); camLook.copy(lookCurve.getPoint(0)); float.last.copy(camPos); shown = -1; aimed = false
      setIntro('clear', t)
      lowerVisor(t, false) // the rim closes in with the glare fading, below
    }
    if (intro === 'clear' && k >= (reduced ? 0.5 : CLEAR_S)) {
      setIntro('off', t)
      if (opts.flash) opts.flash.style.opacity = '0'
      if (opts.mist) { opts.mist.style.opacity = '0'; opts.mist.style.backdropFilter = '' }
      return
    }
    const flash = opts.flash?.style, mist = opts.mist?.style
    if (intro === 'clear') {
      const c = Math.min(1, k / (reduced ? 0.5 : CLEAR_S)), helmetIn = ease(Math.min(1, c * 1.6)), fog = 1 - ease(c)
      if (flash) flash.opacity = String(1 - ease(Math.min(1, c * 2.4)))
      if (mist) { mist.opacity = String(reduced ? 0 : fog); mist.backdropFilter = reduced ? '' : `blur(${(fog * 12).toFixed(1)}px)` }
      visor.shown = helmetIn
      if (opts.visor) { opts.visor.style.opacity = String(helmetIn); opts.visor.style.transform = `scale(${reduced ? 1 : 1 + (1 - helmetIn) * 0.45})` }
      camera.position.copy(camPos); camera.lookAt(camLook); setFov(float.fov = FOV)
      renderer.toneMappingExposure = exposureAt(0)
      return
    }
    // out in space: no helmet yet
    raiseVisor(false); visor.shown = 0
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
    crew.animate(live, data?.focusId, focus?.id || data?.focusId, t, dt, still, reduced, camera, alarm, crewKey)
    // VITA faces the camera while she talks, and for a moment after a click before her first word
    if (vitaTalking || t < vitaHold) robots.vita.attend(camera.position); else robots.vita.release()
    if (data && t - lastDraw > 0.05) { // panels and tags at about 20 fps
      lastDraw = t
      camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      // only what is in view, and not under a live screen that has fully faded in over it
      panels.forEach((x, i) => { if (x.ctx && screens.shown(i) < 0.99 && seen(x.face)) { x.draw(x.ctx, data!, t); x.tex.needsUpdate = true } })
      decor?.draw(data, t, seen)
      crew.drawTags(live, t)
    }
    if (p > 5 || arriving()) eva.load()
    // the station shows from the forward window on, and all through the arrival
    decor?.update(t, still); consoles.update(t, still); robots.update(dt, still, t); space.update(t, still); beam.show(!arriving() || intro === 'clear'); beam.update(t, still); post.update(t, still); stepVisor(t); eva.update(still, arriving() && intro !== 'clear' ? N - 1 : p); flare.update(reduced)
    if (frameNo++ % 6 === 0) renderer.shadowMap.needsUpdate = true
    composer.render(dt)
    screens.render(camera, crew.holders().filter((h) => h.visible).map((h) => h.getWorldPosition(new THREE.Vector3())), dt)
  }
  /**
   * Steps down while frames stay slow (under ~50 fps over about a second): ambient occlusion off, the Retina extra
   * pixels, a smaller shadow map, bloom, antialiasing, then the resolution down to 0.7 of the screen's, and at last a
   * steady 30 fps rather than a jittery 40. Frame times count from a couple of seconds after the hall is ready, and
   * long stalls (a tab switch, a screen loading) are not the steady rate. How far it got is remembered (shell/perf.ts),
   * so the next visit starts there.
   */
  const gov = { n: 0, sum: 0, pr: renderer.getPixelRatio(), done: false }
  const setPr = (pr: number) => { gov.pr = pr; renderer.setPixelRatio(pr); composer.setPixelRatio(pr) }
  const ladder: (() => boolean)[] = [
    () => post.dropOcclusion() && (learn('mid'), true),
    () => gov.pr > 1 && (setPr(1), true),
    () => shrinkShadow(),
    () => post.dropBloom() && (learn('low'), true),
    () => post.dropAntialias() && (learn('low'), true),
    () => gov.pr > 0.85 && (setPr(0.85), true),
    () => gov.pr > 0.7 && (setPr(0.7), true),
  ]
  function govern(raw: number, t: number) {
    if (gov.done || !ready || t - readyAt < 2 || document.hidden || raw > 0.25) return
    gov.n++; gov.sum += raw
    if (gov.n < 45) return
    const avg = gov.sum / gov.n
    gov.n = gov.sum = 0
    if (avg < 1 / 50) return
    for (const step of ladder) if (step()) { renderer.shadowMap.needsUpdate = true; return }
    if (avg > 1 / 40) { cap = 30; learn('low') }
    gov.done = true
  }
  if (opts.intro) setIntro('fly', 0)
  frame()
  void Promise.all([hallLoaded, crew.loaded, consoles.loaded, robots.loaded]).then(([hall]) => {
    if (disposed) return
    if (hall) {
      mount(hall)
      const box = { y0: FLOOR + 0.12, y1: TOP - 0.15, z0: -LEN + 0.2, z1: LEN - 0.2 }
      walls = { [-1]: wallMap(renderer, scene, -1, SUN_LAYER, box), [1]: wallMap(renderer, scene, 1, SUN_LAYER, box) }
      relayout(inHall)
      const props = consoles.mount(hall)
      decor = addDecor(scene, renderer, maps, {
        quality, reduced, screenSize: [PW, PH],
        screens: panels.map((x, i) => ({ pos: x.pos.clone(), side: PANELS[i].side })),
        crew: SLOTS.map((s) => new THREE.Vector3(...s.pos)),
        path: Array.from({ length: 80 }, (_, i) => posCurve.getPoint(i / 79)),
        props, walls,
      })
      consoles.settle()
      robots.mount(hall)
      sunPool?.bake(renderer)
    }
    placedKey = ''; place(); renderer.shadowMap.needsUpdate = true; ready = true; readyAt = clock.elapsedTime; opts.onProgress?.(1); opts.onReady()
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
    stepUp,
    leaveScreen,
    screenNav: (i, path) => screens.nav(i, path),
    setFloat,
    move(strafe, forward, lift = 0) { pad.x = strafe; pad.y = forward; pad.v = lift },
    skipIntro,
    replayIntro() { endUse(); leaveFloat(); unfocus(); skipAsked = false; setIntro('fly', clock.elapsedTime) },
    lowerVisor() { if (!arriving() && pTarget < 0.5) lowerVisor(clock.elapsedTime, true) },
    vitaTalk(on) { vitaTalking = on; robots.vita.talk(on); if (!on) vitaHold = Math.max(vitaHold, clock.elapsedTime + 1.2) },
    dispose() {
      disposed = true
      manager.onProgress = prevProgress
      cancelAnimationFrame(raf); clearTimeout(snapTimer)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onResize)
      for (const h of homeTimers) window.clearTimeout(h)
      for (const s of [scene, flare.pass.scene]) s.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) { (mat as THREE.MeshBasicMaterial).map?.dispose(); mat.dispose() }
      })
      scene.environment?.dispose(); sunPool?.dispose(); pmrem.dispose(); composer.dispose(); renderer.dispose(); screens.dispose()
    },
  }
}
