import * as THREE from 'three'
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import type { EmbedView } from '../shell/Embed'

/*
 * The real console on the wall screens: each screen is an iframe of one console view (shell/Embed.tsx) placed in
 * the scene with CSS3DRenderer, on a layer above the WebGL canvas. The canvas-drawn panel stays underneath as the
 * screen seen from afar; the live view fades in when the camera faces the screen and nobody floats in between,
 * since DOM cannot be hidden behind WebGL geometry.
 */

export interface ScreenSpec { view: EmbedView; px: [number, number] }
interface Screen { obj: CSS3DObject; frame: HTMLIFrameElement; pos: THREE.Vector3; normal: THREE.Vector3; w: number; h: number; loaded: boolean; shown: number; off: boolean | null; view: EmbedView; crew: string | null | undefined }

export function createScreens(host: HTMLElement, base: string) {
  const css = new CSS3DRenderer()
  const el = css.domElement
  el.className = 'cabin-screens'
  host.appendChild(el)
  const scene = new THREE.Scene()
  const list: Screen[] = []
  const toCam = new THREE.Vector3(), seg = new THREE.Vector3(), q = new THREE.Vector3(), corner = new THREE.Vector3()

  /** A screen of `w` x `h` m facing `normal` at `pos`, rendered at `px` CSS pixels. */
  function add(spec: ScreenSpec, w: number, h: number) {
    const frame = document.createElement('iframe')
    frame.title = `AstroDocX ${spec.view} screen`
    frame.tabIndex = -1
    frame.setAttribute('aria-hidden', 'true')
    frame.style.width = `${spec.px[0]}px`; frame.style.height = `${spec.px[1]}px`
    const obj = new CSS3DObject(frame)
    obj.scale.setScalar(w / spec.px[0])
    scene.add(obj)
    const s: Screen = { obj, frame, pos: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), w, h, loaded: false, shown: 0, off: null, view: spec.view, crew: undefined }
    frame.addEventListener('load', () => { s.off = null; if (frame.src) setTimeout(() => { s.loaded = true }, 900) }) // the app paints its data shortly after load
    list.push(s)
    return s
  }

  function place(i: number, pos: THREE.Vector3, rotY: number) {
    const s = list[i]
    s.pos.copy(pos); s.obj.position.copy(pos); s.obj.rotation.set(0, rotY, 0)
    s.normal.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
  }

  /** Loads (or reloads, for a new crew member) the console view; iframes start one after another so the cabin stays smooth. */
  function load(i: number, crew: string | null, delay = 0) {
    const s = list[i]
    if (s.crew === crew) return
    s.crew = crew; s.loaded = false
    const url = `${base}${s.view === 'alerts' || s.view === 'trends' ? s.view : 'board'}?embed=${s.view}${crew ? `&crew=${encodeURIComponent(crew)}` : ''}`
    setTimeout(() => { s.frame.src = url }, delay)
  }

  /** Is anyone (spheres of radius r around `blockers`) between the camera and the screen? */
  function blocked(s: Screen, cam: THREE.Vector3, blockers: THREE.Vector3[]) {
    const right = new THREE.Vector3(s.normal.z, 0, -s.normal.x)
    for (const [a, b] of [[0, 0], [-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]]) {
      corner.copy(s.pos).addScaledVector(right, a * s.w).add(new THREE.Vector3(0, b * s.h, 0))
      seg.copy(corner).sub(cam)
      const len = seg.length(); seg.divideScalar(len)
      for (const p of blockers) {
        const t = q.copy(p).sub(cam).dot(seg)
        if (t < 0.3 || t > len - 0.15) continue
        if (q.copy(cam).addScaledVector(seg, t).distanceTo(p) < 0.75) return true
      }
    }
    return false
  }

  function render(camera: THREE.PerspectiveCamera, blockers: THREE.Vector3[], dt: number) {
    for (const s of list) {
      toCam.copy(camera.position).sub(s.pos)
      const dist = toCam.length(), facing = toCam.divideScalar(dist).dot(s.normal)
      const want = s.loaded && facing > 0.62 && dist < 11 && !blocked(s, camera.position, blockers) ? 1 : 0
      s.shown = THREE.MathUtils.damp(s.shown, want, 6, dt)
      if (s.shown < 0.01) s.shown = want ? s.shown : 0
      s.frame.style.opacity = s.shown.toFixed(3)
      s.frame.style.visibility = s.shown > 0 ? 'visible' : 'hidden' // kept in the DOM (CSS3DRenderer only attaches visible objects) so it loads
      // a hidden screen pauses its own animation (live/usePaused.ts), which would otherwise run under every cabin frame
      const off = s.shown === 0
      if (off !== s.off) { s.off = off; s.frame.dataset.offstage = off ? '1' : '0'; s.frame.contentWindow?.postMessage({ offstage: off }, location.origin) }
    }
    css.render(scene, camera)
  }

  return {
    add, place, load, render,
    /** How far screen `i`'s live view has faded in (1 = fully covering the panel beneath). */
    shown: (i: number) => list[i].shown,
    setSize: (w: number, h: number) => css.setSize(w, h),
    dispose: () => { for (const s of list) s.frame.src = 'about:blank'; el.remove() },
  }
}
