import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CabinData } from './data'
import { LEN } from './hall'

/*
 * The finale outside the forward window: a crew member on EVA, tethered to the ship, with the station
 * ("ISS" by uperesito, CC BY 4.0) beyond and Earth below. The station loads only when the tour gets close.
 */

/** Where the EVA crew member floats, and the camera that frames them with the station and Earth. */
export const EVA = { pos: [4.2, 0.1, -43] as [number, number, number], rot: [0.25, 2.6, -0.2] as [number, number, number] }
export const EVA_VIEW = { pos: new THREE.Vector3(2.4, 1.3, -36.5), look: new THREE.Vector3(-0.5, -2.2, -60) }
const ISS_AT = new THREE.Vector3(-17, 7.5, -88), ISS_SPAN = 34

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
  // safety tether: from a hard point on the hull beside the window, sagging a little, to the suit
  const hull = new THREE.Vector3(5.2, -0.6, -LEN - 0.3), suit = new THREE.Vector3(...EVA.pos).add(new THREE.Vector3(0, -0.15, 0.2))
  const mid = hull.clone().lerp(suit, 0.5).add(new THREE.Vector3(0.6, -1.4, 0))
  const tether = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([hull, mid, suit]), 64, 0.007, 5), new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.8 }))
  group.add(tether)

  let started = false
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
        m.envMapIntensity = 0.6; m.fog = false // out in space: the hall's haze does not reach it
        // the model's solar arrays are brown; real ones read deep blue with a gold sheen
        const c = meanColor(m.map)
        if (c && c[0] > c[2] * 1.35 && c[0] > c[1] * 1.1) { m.color.set('#4a68b8'); m.metalness = 0.6; m.roughness = 0.35 }
      })
      const holder = new THREE.Group().add(iss)
      holder.scale.setScalar(ISS_SPAN / Math.max(size.x, size.y, size.z))
      holder.position.copy(ISS_AT); holder.rotation.set(0.35, 0.9, 0.15)
      group.add(holder)
    }).catch((err) => console.warn('cabin: iss.glb failed', err))
  }

  return {
    load,
    /** The station drifts round very slowly. */
    update(still: number) { group.children[1]?.rotateY(0.0004 * still) },
  }
}
