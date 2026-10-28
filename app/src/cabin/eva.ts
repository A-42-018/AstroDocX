import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CabinData } from './data'

/*
 * The finale outside the forward window: a crew member on EVA in the foreground, tethered to the station
 * ("ISS" by uperesito, CC BY 4.0) beyond, the sun breaking past its arrays and Earth's horizon below. The
 * station loads only when the tour gets close.
 */

/** Where the EVA crew member floats, and the camera that frames them with the station and Earth. */
export const EVA = { pos: [4.75, 0.87, -38.47] as [number, number, number], rot: [0.2, -0.5, 0.22] as [number, number, number] }
/** Looking about 20 degrees right of the sun and slightly down: station and sun upper left, astronaut right, Earth below. */
export const EVA_VIEW = { pos: new THREE.Vector3(2.4, 1.3, -36.5), look: new THREE.Vector3(12.38, -0.1, -53.78) }
const ISS_AT = new THREE.Vector3(27.9, 10.4, -106.5), ISS_SPAN = 34

/** Mean colour of a texture, from an 8 x 8 thumbnail; null when it cannot be read. */
function meanColor(t: THREE.Texture | null): [number, number, number] | null {
  const img = t?.image as CanvasImageSource | undefined
  if (!img) return null
  try {
    const c = document.createElement('canvas'); c.width = c.height = 8
    const g = c.getContext('2d', { willReadFrequently: true }); if (!g) return null
    g.drawImage(img, 0, 0, 8, 8)
    const d = g.getImageData(0, 0, 8, 8).data, s = [0, 0, 0]
    for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2] }
    return s.map((v) => v / 64 / 255) as [number, number, number]
  } catch { return null }
}

/** The Mission Specialist goes outside; nobody does if they are the crew member the panels follow. */
export function evaCrewId(d: CabinData): string | null {
  const id = d.crew.find((c) => c.role === 'Mission Specialist')?.id
  return id && id !== d.focusId ? id : null
}

export function createEva(scene: THREE.Scene, loader: GLTFLoader, models: string) {
  const group = new THREE.Group(); scene.add(group)
  // safety tether: from the suit, in a loose loop up and back to a hard point on the station's truss
  const suit = new THREE.Vector3(...EVA.pos).add(new THREE.Vector3(-0.2, -0.1, 0.05)), anchor = ISS_AT.clone().add(new THREE.Vector3(-3, -1.5, 4))
  const lift = (k: number, y: number) => suit.clone().lerp(anchor, k).add(new THREE.Vector3(0, y, 0))
  const path = new THREE.CatmullRomCurve3([suit, suit.clone().add(new THREE.Vector3(-0.9, 0.5, -1.6)), lift(0.12, 1.4), lift(0.45, 2.2), lift(0.8, 1.0), anchor])
  const tether = new THREE.Mesh(new THREE.TubeGeometry(path, 240, 0.012, 5), new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.6, fog: false }))
  tether.visible = false; group.add(tether)

  // sunlight on the station and the spacewalker, from the upper left; narrow spots aimed and ranged so none reach the hall
  const issKey = new THREE.SpotLight('#fff0d8', 7, 140, 0.4, 0.5, 0)
  issKey.position.copy(ISS_AT).add(new THREE.Vector3(-30, 35, 45)); issKey.target.position.copy(ISS_AT)
  const suitKey = new THREE.SpotLight('#ffe8c8', 6, 10, 0.5, 0.6, 1)
  suitKey.position.copy(suit).add(new THREE.Vector3(-2.5, 3, 3.5)); suitKey.target.position.copy(suit)
  const suitRim = new THREE.SpotLight('#ffc98a', 10, 9, 0.5, 0.6, 1) // the sun behind, edging the suit
  suitRim.position.copy(suit).add(new THREE.Vector3(-1.5, 1.5, -4.5)); suitRim.target.position.copy(suit)
  for (const l of [issKey, suitKey, suitRim]) group.add(l, l.target)

  let started = false, station: THREE.Group | null = null
  /** Starts loading the station; safe to call every frame. */
  function load() {
    if (started) return
    started = true
    loader.loadAsync(`${models}iss.glb`).then((gltf) => {
      const iss = gltf.scene, box = new THREE.Box3().setFromObject(iss), size = box.getSize(new THREE.Vector3())
      iss.position.sub(box.getCenter(new THREE.Vector3()))
      iss.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (!m?.isMeshStandardMaterial) return
        m.envMapIntensity = 0.8; m.fog = false // out in space: the hall's haze does not reach it
        m.metalness = 0.35; m.roughness = 0.42 // bare metal and blankets that catch the sun
        // the model's solar arrays are brown; real ones read deep blue with a gold sheen
        const c = meanColor(m.map)
        if (c && c[0] > c[2] * 1.35 && c[0] > c[1] * 1.1) { m.color.set('#3d5fc0'); m.metalness = 0.75; m.roughness = 0.22; m.emissive.set('#2a1a06'); m.emissiveIntensity = 0.6 }
      })
      const holder = new THREE.Group().add(iss); station = holder
      holder.scale.setScalar(ISS_SPAN / Math.max(size.x, size.y, size.z))
      holder.position.copy(ISS_AT); holder.rotation.set(0.35, 0.9, 0.15)
      group.add(holder)
    }).catch((err) => console.warn('cabin: iss.glb failed', err))
  }

  return {
    load,
    /** The station drifts round very slowly; it and the tether show from the forward window on (`p` is the tour position). */
    update(still: number, p: number) {
      if (!station) return
      station.rotateY(0.0004 * still)
      station.visible = tether.visible = p > 6
    },
  }
}
