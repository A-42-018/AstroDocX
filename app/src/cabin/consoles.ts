import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR, HALF, shades } from './hall'
import { wallPatch, wallProbe } from './wall'

/*
 * The med bay's working consoles, all CC BY 4.0 from Sketchfab: the twin-screen operator desk ("Sci-Fi Computer Desk
 * Console" by Inditrion Dradnon) on the deck at the forward window, with the crew either side of it; the three-screen
 * ops alcove ("Large Wall-Mounted Computer Console", same author) in the port wall; and the data core ("Sci-fi
 * Supercomputer" by Jungle Jim) on the starboard wall. Each is sized in metres, stood on the deck and, on a wall,
 * backed against the wall's nearest part like the screens are.
 */

interface Spec {
  file: string
  /** Width across its front, metres. */
  width: number
  /** The turn that brings the model's front round to +z. */
  turn: number
  /** 0 stands free facing the hall (+z); -1 and +1 are the port and starboard walls. */
  side: -1 | 0 | 1
  /** Where to start looking along the hall; on a wall the flattest stretch within `slide` is taken. */
  z: number
  slide?: number
}
const SPECS: Spec[] = [
  { file: 'desk-console', width: 2.8, turn: 0, side: 0, z: -12.3 },
  { file: 'ops-console', width: 3.4, turn: Math.PI, side: -1, z: 4.4, slide: 1.2 },
  { file: 'data-core', width: 3.8, turn: 0, side: 1, z: -0.4, slide: 1.2 },
]

export interface Consoles {
  /** Resolves once the models are in (missing ones are skipped). */
  loaded: Promise<void>
  /** Stands each console on the deck and against its wall; returns the room they take, for the decor to keep clear of. */
  mount: (hall: THREE.Object3D) => THREE.Box3[]
  /** Casts shadows and joins the sun layer: after the decor has mapped the bare walls. */
  settle: () => void
  /** The screens' slow shimmer. */
  update: (t: number, still: number) => void
}

export function createConsoles(scene: THREE.Scene, loader: GLTFLoader, models: string): Consoles {
  const items: { spec: Spec; g: THREE.Group; size: THREE.Vector3 }[] = []
  const screens: { m: THREE.MeshStandardMaterial; base: number; ph: number }[] = []
  const loaded = Promise.all(SPECS.map((spec) => loader.loadAsync(`${models}${spec.file}.glb`).then((gltf) => {
    const root = gltf.scene
    root.rotation.y = spec.turn
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3())
    const s = spec.width / size.x
    // centred on its footprint, standing on y = 0, front to +z
    root.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
    const fit = new THREE.Group(); fit.add(root); fit.scale.setScalar(s)
    const g = new THREE.Group(); g.add(fit); g.visible = false; scene.add(g)
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (!(o as THREE.Mesh).isMesh || !m?.isMeshStandardMaterial) return
      // the screens are their emissive maps: kept under the window's glare so the bloom stays on the sun
      if (m.emissiveMap) { m.emissiveIntensity = Math.min(m.emissiveIntensity, 1) * 0.85; screens.push({ m, base: m.emissiveIntensity, ph: screens.length * 1.7 }) }
    })
    items.push({ spec, g, size: size.multiplyScalar(s) })
  }).catch((err) => console.warn(`cabin: ${spec.file}.glb failed`, err)))).then(() => undefined)

  /** The deck's height under (x, z), from a ray straight down onto the hall. */
  function deckAt(hall: THREE.Object3D, x: number, z: number) {
    const patch = wallPatch(hall, new THREE.Box3(new THREE.Vector3(x - 0.3, FLOOR - 1, z - 0.3), new THREE.Vector3(x + 0.3, FLOOR + 1.5, z + 0.3)))
    const hit = new THREE.Raycaster(new THREE.Vector3(x, FLOOR + 1.5, z), new THREE.Vector3(0, -1, 0)).intersectObject(patch, false)[0]
    patch.geometry.dispose()
    return hit ? hit.point.y : FLOOR
  }

  function mount(hall: THREE.Object3D) {
    hall.updateMatrixWorld(true)
    return items.map(({ spec, g, size }) => {
      const { side } = spec
      let x = 0, z = spec.z
      if (side) {
        // the stretch where the wall's nearest part stands furthest back over the console's height and width
        const slide = spec.slide ?? 0, w = size.x / 2 + 0.05
        const probe = wallProbe(hall, side, FLOOR + 0.3, FLOOR + size.y, spec.z - slide - w, spec.z + slide + w)
        const reach = (zc: number) => {
          let min = HALF
          for (let a = 0; a <= 8; a++) for (let b = 0; b <= 5; b++) {
            const r = probe.reach(FLOOR + 0.3 + (b / 5) * (size.y - 0.3), zc - w + (a / 8) * 2 * w)
            if (r !== null) min = Math.min(min, r)
          }
          return min
        }
        let best = { z, r: reach(z), score: -Infinity }
        for (let dz = -slide; dz <= slide + 1e-6; dz += 0.2) {
          const zc = spec.z + dz, r = reach(zc), score = r - Math.abs(dz) * 0.08
          if (score > best.score) best = { z: zc, r, score }
        }
        probe.dispose()
        z = best.z
        x = side * Math.max(best.r - size.z / 2 - 0.03, 4.4) // never out into the walkway
        g.rotation.y = -side * (Math.PI / 2)
      }
      g.position.set(x, deckAt(hall, x, z) + 0.005, z)
      g.visible = true
      g.updateMatrixWorld(true)
      return new THREE.Box3().setFromObject(g)
    })
  }

  return {
    loaded,
    mount,
    settle: () => { for (const { g } of items) g.traverse((o) => { if ((o as THREE.Mesh).isMesh) shades(o) }) },
    update(t, still) {
      for (const s of screens) s.m.emissiveIntensity = s.base * (1 + 0.06 * Math.sin(t * 1.3 + s.ph) * still)
    },
  }
}
