/*
 * VITA's face on the Crew Doctor screen: a rigged 3D doctor on the holo pedestal (Microsoft Rocketbox "Medical_Female_02",
 * baked by tools/bake-doctor.mjs). Her body moves with motion-capture clips: breathing while idle, an attentive pose while
 * you ask, talking gestures while she speaks (a different one each time, from a random point) and a thoughtful pose while
 * she works. On top of the clips, in code: her head and eyes follow the pointer, she blinks, smiles a little, raises her
 * brows and nods on stressed words, and her lips form visemes from the words she says (lips.ts). Her body language is
 * layered on the clips too: she sweeps her gaze over the room as she talks, glances away at the start of a sentence, tilts
 * her head and leans in on stressed words and at questions, looks up and aside while she thinks, leans towards you while
 * you ask, and her gestures quicken with the energy of what she says. She materialises from the
 * feet up in a cyan scan line, a thin scan band passes over her every few seconds and a cyan rim lights her edges.
 * With reduced motion she stands still in her idle pose and only her lips and eyelids move. three.js is loaded on demand.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { VitaWord } from '../audio/voice'
import { isHidden } from '../live/usePaused'
import { babble, JAW, LEAD_MS, shapeAt, SNAP, startsOf, VISEMES, visemesOf, WEIGHT, wordIndexAt, type Viseme } from './lips'

export interface DoctorFigure {
  /** Talking gestures and moving lips while VITA speaks. */
  talk(on: boolean): void
  /** A thoughtful pose while VITA works something out. */
  think(on: boolean): void
  /** An attentive pose while the crew member asks. */
  listen(on: boolean): void
  /** A sentence VITA starts to say, with its estimated word timing: her lips and body keep time to it on their own. */
  line(words: VitaWord[]): void
  /** A word VITA starts to say, timed by the speech engine (not every engine does): puts her back on the real word. */
  word(w: VitaWord): void
  /** Stop drawing and free the GPU (call when the screen unmounts). */
  stop(): void
}

export interface FigureOptions {
  url: string
  reduced?: boolean
  /** The model is in and starts to appear. */
  onReady?: () => void
  /** No WebGL, or the model would not load: the caller shows its fallback. */
  onError?: (e: unknown) => void
}

const CYAN = new THREE.Color('#36e2f5')
const HEIGHT = 1.73
/** She is framed from the upper thighs to just above her head, so her face and hands read at console size; below the
    frame she fades into the pedestal's beam (doctor.css masks the canvas edges). Heights in metres from her feet. */
const FRAME = { lo: 0.8, hi: 1.84 }
const REVEAL_MS = 1500
const SCAN_EVERY = 6200, SCAN_MS = 1300
const TALKS = ['talk1', 'talk2', 'talk3']
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Holo { base: { value: number }; reveal: { value: number }; scan: { value: number }; glow: { value: number } }

/** The hologram look on top of the model's own PBR material: a clip line while she materialises, a scan band, a cyan rim. */
function holo(mat: THREE.MeshStandardMaterial, u: Holo) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uBase: u.base, uH: { value: HEIGHT - FRAME.lo }, uReveal: u.reveal, uScan: u.scan, uGlow: u.glow, uTint: { value: CYAN } })
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvY = (modelMatrix * vec4(transformed, 1.0)).y;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vY;\nuniform float uBase, uH, uReveal, uScan, uGlow;\nuniform vec3 uTint;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat hh = (vY - uBase) / uH;\nif (hh > uReveal) discard;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float front = smoothstep(0.05, 0.0, uReveal - hh) * step(uReveal, 0.999);
        float band = smoothstep(0.025, 0.0, abs(hh - uScan));
        float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        gl_FragColor.rgb += uTint * (front * 1.7 + band * 0.4 + rim * (0.16 + uGlow * 0.22));`)
  }
  mat.customProgramCacheKey = () => 'vita-holo-rig'
}

/** A spring: `x` chases `to` with stiffness `k` and damping `c`; a kick is a push to `v`. */
interface Spring { x: number; v: number }
const spring = (s: Spring, to: number, k: number, c: number, dt: number) => { s.v += (-k * (s.x - to) - c * s.v) * dt; s.x += s.v * dt }

export function createDoctorFigure(canvas: HTMLCanvasElement, { url, reduced = false, onReady, onError }: FigureOptions): DoctorFigure {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  } catch (e) {
    queueMicrotask(() => onError?.(e))
    return { talk() {}, think() {}, listen() {}, line() {}, word() {}, stop() {} }
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 0.6
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50)
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-1.6, 2.4, 3)
  const rimL = new THREE.DirectionalLight(CYAN, 3); rimL.position.set(2.2, 1.4, -2.4)
  const under = new THREE.PointLight(CYAN, 0.6, 3.2, 1.6); under.position.set(0, FRAME.lo - 0.15, 0.5)   // the beam, from below
  scene.add(key, rimL, under, new THREE.HemisphereLight('#bff6ff', '#06202c', 0.5))

  const rig = new THREE.Group()                  // her feet are at its origin
  scene.add(rig)
  const u: Holo = {
    base: { value: FRAME.lo },                   // she materialises and is scanned from the bottom of the frame up
    reveal: { value: reduced ? 1.2 : 0 }, scan: { value: -1 }, glow: { value: 0 } }

  let dead = false, live = false, raf = 0, start = 0, last = 0, dirty = true
  let talking = false, thinking = false, listening = false
  let mixer: THREE.AnimationMixer | null = null
  const actions = new Map<string, THREE.AnimationAction>()
  let current: THREE.AnimationAction | null = null, lastTalk = ''
  let infl: number[] = [], shape: Record<string, number> = {}
  const bone: Record<'spine1' | 'spine2' | 'neck' | 'head' | 'eyeL' | 'eyeR', THREE.Object3D | undefined> = { spine1: undefined, spine2: undefined, neck: undefined, head: undefined, eyeL: undefined, eyeR: undefined }
  let model: THREE.Object3D | null = null, hips: THREE.Object3D | undefined
  const hp = new THREE.Vector3(), drift = new THREE.Vector2(NaN, NaN)
  const eyeRest: [THREE.Object3D, THREE.Quaternion][] = []   // the clips leave the eyes alone, so they are reset each frame
  const look = { x: 0, y: 0 }, lookT = { x: 0, y: 0 }
  // body language: springs for the nod (head pitch), the tilt (head roll), the lean (spine pitch) and the glance (gaze), a
  // warmth that fades after a greeting or a smile, an energy that quickens her gestures and a calm talker's slow sweep
  const nod: Spring = { x: 0, v: 0 }, lean: Spring = { x: 0, v: 0 }, tilt: Spring = { x: 0, v: 0 }
  const gaze = { x: 0, y: 0 }, gazeT = { x: 0, y: 0 }, glanceUntil = { t: 0 }
  let tiltT = 0, energy = 0, warmth = 0, speech = 0, nextSaccade = 0, askFrom = -1e9, browDownT = 0
  let glow = 0, brow = 0, blinkAt = 0, blinkFrom = -1e9
  // the lips: the word being said, when it started, how long it lasts and how much it weighs; our own clock over the
  // sentence's script (re-synced when the engine reports a real word) and, with no script at all, a babble rhythm
  let shapes: Viseme[] = [], wordFrom = 0, wordMs = 0, wordPower = 0.25, nextBabble = 0, mouth = 0.85
  let script: VitaWord[] = [], starts: number[] = [], scriptFrom = 0, scriptIdx = -1, lineSeen = false
  const lips = new Float32Array(VISEMES.length)
  const disposables: { dispose(): void }[] = [pmrem, env, renderer]

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false)
    camera.aspect = w / h
    // thighs to head, with room for her hands when she gestures, whatever the canvas shape
    const fit = FRAME.hi - FRAME.lo, mid = (FRAME.hi + FRAME.lo) / 2, vfov = THREE.MathUtils.degToRad(camera.fov)
    const dist = Math.max(fit / 2 / Math.tan(vfov / 2), (0.86 / 2) / (Math.tan(vfov / 2) * camera.aspect))
    camera.position.set(0, mid, dist)
    camera.lookAt(0, mid, 0)
    camera.updateProjectionMatrix()
    dirty = true
  }
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  ro?.observe(canvas)
  resize()

  /** Cross-fade to a clip, optionally from a point inside it (the talking clips are half a minute long). */
  function play(name: string, fade: number, at = 0) {
    const next = actions.get(name)
    if (!next || next === current) return
    next.reset(); next.time = at; next.setEffectiveWeight(1); next.play()
    if (current) current.crossFadeTo(next, fade, false); else next.fadeIn(fade)
    current = next
  }
  /** Talking wins over thinking, thinking over listening, listening over idle. */
  function mood() {
    if (!live || reduced) { dirty = true; return }
    if (talking) {
      const pick = TALKS.filter((n) => n !== lastTalk)
      const name = pick[Math.floor(Math.random() * pick.length)]
      lastTalk = name
      const d = actions.get(name)?.getClip().duration ?? 0
      play(name, 0.5, Math.random() * Math.max(0, d - 10))
    } else if (thinking) play('think', 0.45)
    else if (listening) play('listen', 0.6, Math.random() * 6)
    else play('idle', 0.8)
  }

  const pq = new THREE.Quaternion(), qa = new THREE.Quaternion(), qw = new THREE.Quaternion(), eul = new THREE.Euler()
  /** Turn a bone by `pitch` (down is +), `yaw` (towards screen right is +) and `roll` (towards screen left is +) in world
      space, on top of its clip pose. */
  function turn(b: THREE.Object3D | undefined, pitch: number, yaw: number, roll = 0) {
    if (!b?.parent) return
    b.parent.getWorldQuaternion(pq)
    qw.setFromEuler(eul.set(pitch, yaw, roll, 'YXZ'))
    qa.copy(pq).invert().multiply(qw).multiply(pq)
    b.quaternion.premultiply(qa)
  }
  const setShape = (name: string, v: number) => { const i = shape[name]; if (i !== undefined) infl[i] = v }

  /** A word starts: her lips spell it, and her body gives it the weight it deserves. */
  function begin(w: VitaWord, t: number) {
    shapes = visemesOf(w.word); wordFrom = t; wordMs = w.ms; wordPower = w.power
    if (reduced) return
    const p = w.power, end = /[.!?]$/.test(w.word)
    energy = Math.min(1, energy + p * 0.45)
    if (p >= 0.85) { nod.v += 0.5 + p * 0.5; brow = Math.min(1, brow + 0.7); lean.v += 0.5 }
    else if (p >= 0.55) { nod.v += 0.22; lean.v += 0.18 }
    if (/\?$/.test(w.word)) { askFrom = t; brow = 1; tiltT = (Math.random() < 0.5 ? -1 : 1) * 0.14 }   // a question: brows up, head cocked
    else if (end) { tiltT = 0; lean.v -= 0.25; if (t - blinkFrom > 500) blinkAt = t + 160 }              // a sentence lands: settle, blink
    else if (p >= 0.85 && Math.abs(tiltT) < 0.02) tiltT = (Math.random() < 0.5 ? -1 : 1) * 0.07        // an idea: a slight tilt
  }
  /** The start of a sentence: a glance away to collect her thought, then back to the room. */
  function glance(t: number) {
    if (reduced || Math.random() < 0.3) return
    gazeT.x = (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 0.5); gazeT.y = -rand(0.05, 0.25)
    glanceUntil.t = t + rand(500, 900)
  }

  function draw(t: number) {
    const dt = clamp((t - last) / 1000, 0, 0.05)
    last = t
    if (!reduced) {
      look.x += (lookT.x - look.x) * 0.05; look.y += (lookT.y - look.y) * 0.05
      u.reveal.value = clamp((t - start) / REVEAL_MS, 0, 1.2)
      const phase = (t - start - REVEAL_MS) % SCAN_EVERY
      u.scan.value = t - start > REVEAL_MS && phase < SCAN_MS ? (phase / SCAN_MS) * 1.15 : -1
    }
    mixer?.update(reduced ? 0 : dt)
    // some talking clips shift her weight 15 cm to a side: follow her hips back over the pedestal's centre, slowly
    // enough (a few seconds) that the sway itself stays
    if (model && hips) {
      hips.getWorldPosition(hp)
      const hx = hp.x - model.position.x, hz = hp.z - model.position.z
      if (Number.isNaN(drift.x)) drift.set(hx, hz)
      const k = 1 - Math.exp(-dt / 2.5)
      drift.x += (hx - drift.x) * k; drift.y += (hz - drift.y) * k
      model.position.x = -drift.x; model.position.z = -drift.y
    }

    // body language: head and eyes on the pointer (less while she talks: she is addressing the room, so her gaze sweeps
    // slowly over it instead), springs for nods, tilts and leans on the words, gaze aversion while she thinks
    if (!reduced) {
      const secs = (t - start) / 1000
      speech += ((talking ? 1 : 0) - speech) * (1 - Math.exp(-dt / 0.5))
      energy *= Math.exp(-dt / 1.3)
      warmth *= Math.exp(-dt / 1.6)
      if (mixer) mixer.timeScale = talking ? 0.9 + energy * 0.22 : 1
      look.x += (lookT.x - look.x) * 0.05; look.y += (lookT.y - look.y) * 0.05
      spring(nod, 0, 70, 9, dt); spring(lean, listening && !talking ? 0.07 : 0, 38, 7, dt)
      spring(tilt, thinking && !talking ? 0.1 : listening && !talking ? -0.07 : tiltT, 16, 5, dt)
      if (!talking && Math.abs(tiltT) > 0.01) tiltT *= Math.exp(-dt / 0.8)
      // gaze: a glance, a look up and aside while thinking, a tiny saccade now and then, otherwise the pointer
      if (t > glanceUntil.t) {
        if (thinking && !talking) { gazeT.x = 0.34; gazeT.y = -0.2 }
        else { gazeT.x = 0; gazeT.y = 0 }
        if (t >= nextSaccade) { nextSaccade = t + rand(900, 2600); gazeT.x += rand(-0.05, 0.05); gazeT.y += rand(-0.03, 0.03) }
      }
      gaze.x += (gazeT.x - gaze.x) * (1 - Math.exp(-dt / 0.07)); gaze.y += (gazeT.y - gaze.y) * (1 - Math.exp(-dt / 0.07))
      const k = 1 - speech * 0.5, sweep = Math.sin(secs * 0.5) * 0.13 * speech + Math.sin(secs * 1.3) * 0.02 * speech
      turn(bone.spine1, lean.x * 0.45, sweep * 0.25, tilt.x * 0.2)
      turn(bone.spine2, lean.x * 0.55, sweep * 0.25)
      turn(bone.neck, look.y * 0.08 * k + gaze.y * 0.2, look.x * 0.16 * k + sweep * 0.3 + gaze.x * 0.18, tilt.x * 0.35)
      turn(bone.head, look.y * 0.12 * k + nod.x * 1.6 + gaze.y * 0.3, look.x * 0.24 * k + sweep * 0.5 + gaze.x * 0.3, tilt.x * 0.65)
      for (const [b, q] of eyeRest) b.quaternion.copy(q)
      turn(bone.eyeL, look.y * 0.12 * k + gaze.y, look.x * 0.22 * k + gaze.x * 0.8 + sweep * 0.4)
      turn(bone.eyeR, look.y * 0.12 * k + gaze.y, look.x * 0.22 * k + gaze.x * 0.8 + sweep * 0.4)
      rig.rotation.y = look.x * 0.06 * k
    }

    // lips: the sentence's script keeps time on its own (a real word from the engine re-syncs it); with no script at all
    // (a line that has not begun) she babbles at a natural rhythm
    if (talking && script.length) {
      const i = wordIndexAt(starts, t - scriptFrom)
      if (i > scriptIdx) { scriptIdx = i; begin(script[i], t) }
    } else if (talking && !lineSeen && t >= nextBabble) {
      const b = babble()
      shapes = b.shapes; wordFrom = t; wordMs = b.ms; wordPower = 0.25
      nextBabble = t + b.ms + (Math.random() < 0.18 ? 220 + Math.random() * 380 : 30 + Math.random() * 70)
    }
    const now: Viseme = talking ? shapeAt(shapes, wordMs, t - wordFrom + LEAD_MS) : 'sil'
    const edt = dt || 0.016
    mouth += ((0.78 + wordPower * 0.32) - mouth) * (1 - Math.exp(-edt / 0.08))   // a stressed word opens wider
    let jaw = 0
    VISEMES.forEach((v, i) => {
      const to = v === now ? WEIGHT[v] * mouth : 0
      lips[i] += (to - lips[i]) * (1 - Math.exp(-edt * (to > lips[i] ? (SNAP.has(v) ? 40 : 26) : 19)))
      setShape(`viseme_${v}`, lips[i])
      jaw += lips[i] * JAW[v]
    })
    setShape('jawOpen', Math.min(0.5, jaw * 0.38))   // the jaw drops on the open vowels, so it reads at a distance

    // blinks, a small smile, brows
    if (t >= blinkAt) { blinkFrom = t; blinkAt = t + 2200 + Math.random() * 4200 }
    const bt = (t - blinkFrom) / 1000
    const blink = bt < 0.07 ? bt / 0.07 : bt < 0.18 ? 1 - (bt - 0.07) / 0.11 : 0
    setShape('eyeBlinkLeft', blink); setShape('eyeBlinkRight', blink)
    brow *= Math.exp(-edt / (t - askFrom < 700 ? 0.9 : 0.35))   // a question keeps her brows up a little longer
    setShape('browOuterUpLeft', brow * 0.5); setShape('browOuterUpRight', brow * 0.5)
    setShape('browInnerUp', thinking ? 0.45 : listening && !talking ? 0.2 : brow * 0.3)
    browDownT += ((thinking && !talking ? 0.18 : 0) - browDownT) * (1 - Math.exp(-edt / 0.4))
    setShape('browDownLeft', browDownT); setShape('browDownRight', browDownT * 0.6)   // a furrow, a little uneven, while she works
    const smile = Math.min(0.55, (thinking ? 0.05 : talking ? 0.14 : 0.22) + warmth * 0.3)
    setShape('mouthSmileLeft', smile); setShape('mouthSmileRight', smile)
    setShape('eyeSquintLeft', smile * 0.4); setShape('eyeSquintRight', smile * 0.4)

    glow += ((talking || thinking ? 1 : 0) - glow) * 0.08
    u.glow.value = glow
    under.intensity = 0.6 + glow * 1.4
    renderer.render(scene, camera)
    dirty = false
  }

  const frame = (t: number) => {
    if (dead) return
    raf = requestAnimationFrame(frame)
    if (isHidden() || (reduced && !talking && !dirty && lips.every((v) => v < 0.01))) return
    draw(t)
  }

  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then((gltf) => {
    if (dead) return
    model = gltf.scene
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh
      if (o.name === 'Bip01') hips = o
      if (/Spine1$/.test(o.name)) bone.spine1 = o
      else if (/Spine2$/.test(o.name)) bone.spine2 = o
      else if (/Neck$/.test(o.name)) bone.neck = o
      else if (/Head$/.test(o.name)) bone.head = o
      else if (/LEye$/.test(o.name)) bone.eyeL = o
      else if (/REye$/.test(o.name)) bone.eyeR = o
      if (!m.isMesh) return
      m.frustumCulled = false                    // the clips move her beyond the bind-pose bounds
      disposables.push(m.geometry)
      if (m.morphTargetDictionary && m.morphTargetInfluences) { shape = m.morphTargetDictionary; infl = m.morphTargetInfluences }
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
        mat.envMapIntensity = 0.9
        holo(mat, u)
        disposables.push(mat)
        for (const tex of [mat.map, mat.normalMap]) if (tex) disposables.push(tex)
      }
    })
    for (const b of [bone.eyeL, bone.eyeR]) if (b) eyeRest.push([b, b.quaternion.clone()])
    rig.add(model)
    mixer = new THREE.AnimationMixer(model)
    for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip))
    const idle = actions.get('idle')
    idle?.play(); current = idle ?? null
    mixer.update(0)
    start = last = performance.now()
    blinkAt = start + 1800
    live = true
    mood()
    onReady?.()
    raf = requestAnimationFrame(frame)
  }).catch((e) => { if (!dead) onError?.(e) })

  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    lookT.x = clamp((e.clientX - r.left - r.width / 2) / 500)
    lookT.y = clamp((e.clientY - r.top - r.height * 0.22) / 500)   // her eyes are about a fifth of the way down
  }
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true })

  return {
    talk(on) {
      if (on === talking) return
      talking = on
      if (on) { lineSeen = false; script = []; scriptIdx = -1; nextBabble = performance.now() + 450; warmth = 1 }   // a greeting smile
      mood()
    },
    think(on) { if (on === thinking) return; thinking = on; mood() },
    listen(on) { if (on === listening) return; listening = on; mood() },
    line(words) {
      if (!talking || !live) return
      script = words; starts = startsOf(words); scriptFrom = performance.now(); scriptIdx = -1; lineSeen = true
      glance(scriptFrom)
    },
    word(w) {
      if (!talking || !live) return
      const t = performance.now(), i = script.findIndex((s) => s.at === w.at)
      if (i < 0) { begin(w, t); return }                // no script for it: just show the word
      scriptFrom = t - starts[i]                         // the engine is the clock; we ran ahead or behind
      if (i > scriptIdx) { scriptIdx = i; begin(script[i], t) }
    },
    stop() {
      dead = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('pointermove', onPointer)
      mixer?.stopAllAction()
      scene.environment = null
      for (const d of disposables) d.dispose()
      renderer.forceContextLoss()
    },
  }
}
