import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CabinCrew } from './data'
import { CREW_KEY } from './lighting'
import { C, TAG_H, TAG_W, drawTag } from './panels'

/** One astronaut in the room: the model, its live name tag and the ring shown when off-nominal. */
export interface Astro { holder: THREE.Group; mixer: THREE.AnimationMixer | null; base: THREE.Vector3; rot: THREE.Euler; ctx: CanvasRenderingContext2D | null; tagTex: THREE.CanvasTexture; tag: THREE.Sprite; ring: THREE.Mesh }

/** Height of a suited astronaut in the scene, metres: a touch over life size, so the crew hold their own beside 3 m screens in a 15 m hall. */
export const HEIGHT = 2.1
/** The sun visor: gold film over the helmet, a mirror for the cabin and the sun. */
const VISOR = new THREE.MeshPhysicalMaterial({ color: '#ffcf6e', metalness: 1, roughness: 0.07, envMapIntensity: 4.5, clearcoat: 1, clearcoatRoughness: 0.03 })

/** The crew: loads the astronaut ("Animated Floating Astronaut in Space Suit Loop" by LasquetiSpice, CC BY 4.0) once, clones one per crew member on demand and animates them each frame. */
export function createCrew(scene: THREE.Scene, loader: GLTFLoader, models: string) {
  const astros = new Map<string, Astro>()
  let template: THREE.Object3D | null = null
  let clip: THREE.AnimationClip | null = null
  const loaded = loader.loadAsync(`${models}astronaut-float.glb`).then((gltf) => {
    const root = gltf.scene, box = new THREE.Box3().setFromObject(root)
    // the model's visor is its one untextured, dark grey material
    root.traverse((o) => {
      const mesh = o as THREE.Mesh, m = mesh.material as THREE.MeshStandardMaterial | undefined
      if (mesh.isMesh && m?.isMeshStandardMaterial && !m.map && m.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.25) mesh.material = VISOR
    })
    const s = HEIGHT / box.getSize(new THREE.Vector3()).y
    root.position.sub(box.getCenter(new THREE.Vector3()))
    template = new THREE.Group().add(root); template.scale.setScalar(s)
    clip = gltf.animations[0] ?? null
  }).catch((err) => console.warn('cabin: astronaut-float.glb failed', err))

  /** The astronaut for `id`, made on first use; null until the model has loaded. */
  function get(id: string): Astro | null {
    const have = astros.get(id)
    if (have || !template) return have ?? null
    const holder = new THREE.Group(); holder.add(skeletonClone(template))
    // the float loop moves limbs outside the bind-pose bounds, so skinned parts are never culled
    holder.traverse((o) => { o.userData.crew = id; o.castShadow = true; if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.frustumCulled = false })
    let mixer: THREE.AnimationMixer | null = null
    if (clip) { mixer = new THREE.AnimationMixer(holder); const act = mixer.clipAction(clip); act.play(); act.time = (astros.size * 1.7) % clip.duration } // out of step with each other
    scene.add(holder)
    const c = document.createElement('canvas'); c.width = TAG_W; c.height = TAG_H
    const tagTex = new THREE.CanvasTexture(c); tagTex.colorSpace = THREE.SRGBColorSpace
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, transparent: true, toneMapped: false }))
    tag.scale.set(1.25, 0.37, 1); tag.renderOrder = 10; scene.add(tag)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.008, 8, 64), new THREE.MeshBasicMaterial({ color: C.watch, toneMapped: false, transparent: true }))
    ring.rotation.x = Math.PI / 2; scene.add(ring)
    const a: Astro = { holder, mixer, base: new THREE.Vector3(), rot: new THREE.Euler(), ctx: c.getContext('2d'), tagTex, tag, ring }
    astros.set(id, a)
    return a
  }

  /** Hides everyone not in `keep` (a crew member who left the roster). */
  function hideOthers(keep: string[]) {
    for (const [id, a] of astros) if (!keep.includes(id)) { a.holder.visible = false; a.tag.visible = false; a.ring.visible = false }
  }

  const toCam = new THREE.Vector3(), side = new THREE.Vector3()
  /**
   * Float, tag fade and status ring for each crew member; lights `alarm` on the focus member when off-nominal, and aims
   * `key` at `keyId` (the member picked, else the focus): from the camera's side, a little off to the hall's middle and above.
   */
  function animate(crew: Map<string, CabinCrew>, focusId: string | undefined, keyId: string | undefined, t: number, dt: number, still: number, reduced: boolean, camera: THREE.Camera, alarm: THREE.PointLight, key: THREE.SpotLight) {
    let i = 0
    alarm.intensity = 0
    key.intensity = 0 // off, not hidden (that would recompile every shader), unless its member is here
    for (const [id, a] of astros) {
      const m = crew.get(id)
      if (!m) continue
      a.mixer?.update(dt * still * 0.8)
      a.holder.position.set(a.base.x + Math.sin(t * 0.37 + i) * 0.03 * still, a.base.y + Math.sin(t * 0.55 + i * 2) * 0.06 * still, a.base.z)
      a.holder.rotation.set(a.rot.x + Math.sin(t * 0.3 + i) * 0.05 * still, a.rot.y + Math.sin(t * 0.21 + i) * 0.08 * still, a.rot.z + Math.sin(t * 0.27 + i) * 0.05 * still)
      a.tag.position.copy(a.holder.position).add(new THREE.Vector3(0, HEIGHT / 2 + 0.3, 0))
      ;(a.tag.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.clamp((camera.position.distanceTo(a.tag.position) - 3.0) / 1.0, 0, 1)
      const off = m.status !== 'nominal'
      a.ring.visible = off
      if (off) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 * still + (reduced ? Math.PI / 2 : 0))
        const ring = a.ring.material as THREE.MeshBasicMaterial
        ring.color.set(m.status === 'act' ? C.act : C.watch); ring.opacity = 0.18 + pulse * 0.32 // a quiet halo: the tag carries the alert
        a.ring.position.copy(a.holder.position); a.ring.scale.setScalar(1 + pulse * 0.08)
        if (id === focusId) { alarm.color.set(ring.color); alarm.position.copy(a.holder.position).add(new THREE.Vector3(0, 0.6, 0.8)); alarm.intensity = 0.1 + pulse * 0.4 } // a hint of red: the hall fill is low, more would dye the suit
      }
      if (id === keyId && a.holder.visible) {
        const at = a.holder.position
        toCam.copy(camera.position).sub(at).setY(0).normalize()
        side.set(-toCam.z, 0, toCam.x)
        if (side.x * at.x > 0) side.negate() // toward the middle of the hall, never into a wall
        key.position.copy(at).addScaledVector(toCam, 2.2).addScaledVector(side, 1.4).add(new THREE.Vector3(0, 2.2, 0))
        key.target.position.copy(at)
        key.intensity = CREW_KEY
      }
      i++
    }
  }

  /** Redraws every visible tag from the live data. */
  function drawTags(crew: Map<string, CabinCrew>, t: number) {
    for (const [id, a] of astros) { const m = crew.get(id); if (m && a.ctx) { drawTag(a.ctx, m, t); a.tagTex.needsUpdate = true } }
  }

  return { loaded, get, hideOthers, animate, drawTags, holders: () => [...astros.values()].map((a) => a.holder), find: (id: string) => astros.get(id) }
}
