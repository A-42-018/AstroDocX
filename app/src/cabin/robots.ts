import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR, shades } from './hall'

/** Height of a robot, metres: the model's own 1.6 m, a head under the floating crew. */
const H = 1.6
/** The hinge, as baked by tools/bake-cabin.mjs: the slabs swing from 0.62 of the height. */
const HINGE = 0.62, LEG = HINGE * H
/** The swing at full stride, radians; the gait's pace, radians of phase a second; the turn at each end, radians a second. */
const SWING = 0.3, PACE = 2.6, TURN = 1.1
/** The routes, on the floor: each robot walks a to b and back, turning on the spot and standing a moment at each end. */
const ROUTES: { a: [number, number]; b: [number, number]; rest: number }[] = [
  { a: [3.4, 10.5], b: [3.4, -8.5], rest: 1.6 },
  { a: [-1.2, -9.5], b: [-1.2, 6.5], rest: 2.4 },
]

type Mode = 'walk' | 'turn' | 'rest' | 'attend'
interface Robot { holder: THREE.Group; slabs: THREE.Object3D[]; a: THREE.Vector3; b: THREE.Vector3; rest: number; to: 'a' | 'b'; phase: number; mode: Mode; wait: number; yaw: number; swing: number; face: Face | null }

/** The two robots: VITA, the crew doctor (the first route), and MEDI, her silent helper. */
const NAMES = [{ name: 'VITA', color: '#36e2f5', glow: 'rgba(54, 226, 245, 0.9)' }, { name: 'MEDI', color: '#d9622b', glow: 'rgba(217, 98, 43, 0.6)' }] as const

/*
 * The face display: the model's decal is the robot's name set vertically with braille-like dots beside it, on a
 * transparent 512² texture. Each robot gets its own canvas in that layout, so the hall's robots read VITA and MEDI.
 * VITA's dots breathe slowly, and pulse like a voice meter while she talks.
 */
const DOTS: [number, number][] = [[276, 62], [322, 103], [366, 103], [318, 182], [276, 226], [320, 226], [366, 226], [270, 332], [276, 400], [326, 400], [326, 448], [376, 448]]
interface Face { tex: THREE.CanvasTexture; draw: (t: number, talking: boolean) => void }
function makeFace(name: string, color: string, glow: string): Face | null {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')
  if (!g) return null
  const tex = new THREE.CanvasTexture(c)
  tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace // as glTF textures are
  const draw = (t: number, talking: boolean) => {
    g.clearRect(0, 0, 512, 512)
    g.save(); g.translate(150, 256); g.rotate(-Math.PI / 2)
    g.font = '600 150px "Space Grotesk", "Inter", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.shadowColor = glow; g.shadowBlur = 18; g.fillStyle = color
    g.fillText(name, 0, 0)
    g.restore()
    DOTS.forEach(([x, y], i) => {
      const k = talking ? 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + i * 1.7) * Math.sin(t * 2.3 + i)) : 0.8 + 0.2 * Math.sin(t * 1.4 + i * 0.6)
      g.globalAlpha = k; g.shadowColor = glow; g.shadowBlur = 12; g.fillStyle = color
      g.beginPath(); g.arc(x, y, 21, 0, Math.PI * 2); g.fill()
    })
    g.globalAlpha = 1; g.shadowBlur = 0
    tex.needsUpdate = true
  }
  draw(0, false)
  void document.fonts?.ready.then(() => draw(0, false)) // the display face may still be loading on the first draw
  return { tex, draw }
}

/** VITA's name tag: a camera-facing label above her, brighter while she talks. */
function makeTag(): THREE.Sprite | null {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const g = c.getContext('2d')
  if (!g) return null
  const paint = () => {
  g.clearRect(0, 0, 512, 128)
  g.fillStyle = 'rgba(4, 16, 24, 0.72)'; g.strokeStyle = 'rgba(54, 226, 245, 0.85)'; g.lineWidth = 3
  g.beginPath(); g.roundRect(6, 10, 500, 108, 18); g.fill(); g.stroke()
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(54, 226, 245, 0.9)'; g.shadowBlur = 14
  g.fillStyle = '#9ff4ff'; g.font = '700 54px "Space Grotesk", "Inter", system-ui, sans-serif'; g.fillText('VITA', 256, 52)
  g.shadowBlur = 0; g.fillStyle = 'rgba(214, 238, 250, 0.9)'; g.font = '600 22px "JetBrains Mono", ui-monospace, monospace'; g.fillText('CREW DOCTOR · CLICK ME', 256, 94)
  }
  paint()
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 }))
  sprite.scale.set(0.84, 0.21, 1); sprite.position.y = H + 0.32; sprite.renderOrder = 10
  void document.fonts?.ready.then(() => { paint(); tex.needsUpdate = true })
  return sprite
}

/**
 * The robots ("TARS Interstellar (Improved)" by THAD, CC BY 4.0, renamed VITA and MEDI) walk the hall the way the
 * film's robot does: the outer slab pair and the inner pair swing against each other from the hinge, the body vaulting
 * over whichever pair is planted, so the feet never slide. At each end of its route a robot stands a moment, then
 * turns on the spot. VITA stops and turns to face you while she talks (`vita.attend`), then walks on.
 */
export function createRobots(scene: THREE.Scene, loader: GLTFLoader, models: string) {
  const robots: Robot[] = []
  let tag: THREE.Sprite | null = null
  let talking = false, attendAt: THREE.Vector3 | null = null, faceAt = 0
  let template: THREE.Object3D | null = null
  const loaded = loader.loadAsync(`${models}tars.glb`).then((gltf) => {
    template = gltf.scene; template.scale.setScalar(H)
    template.traverse((o) => {
      const mesh = o as THREE.Mesh, m = mesh.material as THREE.MeshStandardMaterial | undefined
      if (!mesh.isMesh) return
      shades(mesh)
      if (m?.transparent && m.map) { m.emissive.set('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = 1.2 } // the face display glows
    })
  }).catch((err) => console.warn('cabin: tars.glb failed', err))

  /** Stands the robots at the start of their routes, on the deck where the hall's floor plates sit above FLOOR. */
  function mount(hall: THREE.Object3D | null) {
    if (!template) return
    const down = new THREE.Raycaster(), dir = new THREE.Vector3(0, -1, 0)
    const deck = (x: number, z: number) => {
      if (!hall) return FLOOR
      down.set(new THREE.Vector3(x, FLOOR + 1, z), dir); down.far = 1.5
      return down.intersectObject(hall, true)[0]?.point.y ?? FLOOR
    }
    ROUTES.forEach((r, i) => {
      const holder = new THREE.Group(); holder.add(template!.clone()); scene.add(holder)
      const who = NAMES[i] ?? NAMES[1]
      const face = makeFace(who.name, who.color, who.glow)
      holder.traverse((o) => {
        const mesh = o as THREE.Mesh, m = mesh.material as THREE.MeshStandardMaterial | undefined
        if (!mesh.isMesh) return
        if (who.name === 'VITA') mesh.userData.vita = true // picking: a click on any part of her
        if (face && m?.transparent && m.map) { // the face decal, on its own material per robot
          const own = m.clone(); own.map = face.tex; own.emissiveMap = face.tex; own.emissive.set('#ffffff'); own.emissiveIntensity = who.name === 'VITA' ? 1.6 : 1.1
          mesh.material = own
        }
      })
      if (who.name === 'VITA') { tag = makeTag(); if (tag) { tag.userData.vita = true; holder.add(tag) } }
      const slabs = [0, 1, 2, 3].map((k) => holder.getObjectByName(`slab${k}`)!)
      const a = new THREE.Vector3(r.a[0], deck(...r.a), r.a[1]), b = new THREE.Vector3(r.b[0], deck(...r.b), r.b[1])
      const robot: Robot = { holder, slabs, a, b, rest: r.rest, to: 'b', phase: i * 1.3, mode: 'walk', wait: 0, yaw: 0, swing: 0, face }
      robot.yaw = heading(a, b); holder.position.copy(a).lerp(b, 0.15 + i * 0.3)
      robots.push(robot)
    })
  }

  const heading = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(-(to.z - from.z), to.x - from.x) // the model faces +x
  const step = new THREE.Vector3()
  /** Walks, rests and turns every robot; with reduced motion they stand still. VITA attends while asked to. */
  function update(dt: number, still: number, t = 0) {
    const vita = robots[0]
    if (vita) {
      if (attendAt && vita.mode !== 'attend') vita.mode = 'attend'
      if (!attendAt && vita.mode === 'attend') { vita.mode = 'turn' } // walks on: turns back to its goal first
      // her face: a voice meter at about 15 fps while she talks, a slow breath otherwise
      if (vita.face && t - faceAt > (talking ? 0.066 : 0.5)) { faceAt = t; vita.face.draw(still ? t : 0, talking) }
      if (tag) {
        const m = tag.material
        m.opacity += ((talking ? 1 : 0.78) - m.opacity) * Math.min(1, dt * 6)
        const k = talking && still ? 1 + 0.04 * Math.sin(t * 6) : 1
        tag.scale.set(0.84 * k, 0.21 * k, 1)
      }
    }
    for (const r of robots) {
      const goal = r.to === 'a' ? r.a : r.b
      let swing = still ? 0 : r.swing
      if (r.mode === 'attend' && attendAt) {
        // the stride settles, and she comes round to face whoever is listening (at once under reduced motion)
        swing = still ? r.swing * Math.exp(-6 * dt) : 0
        const want = heading(r.holder.position, attendAt)
        const d = Math.atan2(Math.sin(want - r.yaw), Math.cos(want - r.yaw))
        r.yaw = still ? r.yaw + Math.sign(d) * Math.min(Math.abs(d), TURN * 1.6 * dt) : want
      } else if (still && r.mode === 'walk') {
        // the planted pair is the one swinging back: the body moves as far as its foot would have
        const dPhase = PACE * dt, th = SWING * Math.sin(r.phase)
        const ds = LEG * Math.cos(th) * SWING * Math.abs(Math.cos(r.phase)) * dPhase
        r.phase += dPhase
        step.copy(goal).sub(r.holder.position).setY(0)
        const left = step.length()
        if (left <= ds) {
          r.holder.position.x = goal.x; r.holder.position.z = goal.z
          r.mode = 'rest'; r.wait = r.rest
        } else r.holder.position.addScaledVector(step.divideScalar(left), ds)
        swing = SWING * Math.sin(r.phase)
      } else if (still && r.mode === 'rest') {
        // the stride settles back to standing, then it waits
        swing = r.swing * Math.exp(-6 * dt)
        r.wait -= dt
        if (r.wait <= 0) { r.to = r.to === 'a' ? 'b' : 'a'; r.mode = 'turn' }
      } else if (still && r.mode === 'turn') {
        // a shuffle on the spot while it comes round
        const want = heading(r.holder.position, r.to === 'a' ? r.a : r.b)
        const d = Math.atan2(Math.sin(want - r.yaw), Math.cos(want - r.yaw))
        const k = Math.min(Math.abs(d), TURN * dt)
        r.yaw += Math.sign(d) * k
        r.phase += PACE * 1.4 * dt
        swing = SWING * 0.25 * Math.sin(r.phase) * Math.min(1, Math.abs(d) * 3)
        if (Math.abs(d) < 0.01) { r.yaw = want; r.mode = 'walk'; r.phase = 0 }
      }
      r.swing = swing
      r.slabs[0].rotation.z = r.slabs[3].rotation.z = swing
      r.slabs[1].rotation.z = r.slabs[2].rotation.z = -swing
      r.holder.rotation.y = r.yaw
      // the body drops as the pairs open: both feet lift by the same amount, so the lower one stays on the deck
      const y = THREE.MathUtils.lerp(r.a.y, r.b.y, 0.5)
      r.holder.position.y = y - LEG * (1 - Math.cos(swing))
    }
  }

  const vita = {
    /** Stop and face `at` (the camera) until `release`. */
    attend(at: THREE.Vector3) { attendAt = (attendAt ?? new THREE.Vector3()).copy(at) },
    release() { attendAt = null },
    talk(on: boolean) { talking = on; faceAt = -1 },
    /** Where she is, for the camera to come to her. */
    position: () => robots[0]?.holder.position ?? null,
    object: () => robots[0]?.holder ?? null,
  }
  return { loaded, mount, update, vita }
}
