import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR, shades } from './hall'

/** Height of a robot, metres: TARS's own 1.6 m, a head under the floating crew. */
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

interface Robot { holder: THREE.Group; slabs: THREE.Object3D[]; a: THREE.Vector3; b: THREE.Vector3; rest: number; to: 'a' | 'b'; phase: number; mode: 'walk' | 'turn' | 'rest'; wait: number; yaw: number; swing: number }

/**
 * TARS robots ("TARS Interstellar (Improved)" by THAD, CC BY 4.0) walking the hall the way the film's TARS does: the
 * outer slab pair and the inner pair swing against each other from the hinge, the body vaulting over whichever pair is
 * planted, so the feet never slide. At each end of its route a robot stands a moment, then turns on the spot.
 */
export function createRobots(scene: THREE.Scene, loader: GLTFLoader, models: string) {
  const robots: Robot[] = []
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
      const slabs = [0, 1, 2, 3].map((k) => holder.getObjectByName(`slab${k}`)!)
      const a = new THREE.Vector3(r.a[0], deck(...r.a), r.a[1]), b = new THREE.Vector3(r.b[0], deck(...r.b), r.b[1])
      const robot: Robot = { holder, slabs, a, b, rest: r.rest, to: 'b', phase: i * 1.3, mode: 'walk', wait: 0, yaw: 0, swing: 0 }
      robot.yaw = heading(a, b); holder.position.copy(a).lerp(b, 0.15 + i * 0.3)
      robots.push(robot)
    })
  }

  const heading = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(-(to.z - from.z), to.x - from.x) // the model faces +x
  const step = new THREE.Vector3()
  /** Walks, rests and turns every robot; with reduced motion they stand still. */
  function update(dt: number, still: number) {
    for (const r of robots) {
      const goal = r.to === 'a' ? r.a : r.b
      let swing = still ? 0 : r.swing
      if (still && r.mode === 'walk') {
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

  return { loaded, mount, update }
}
