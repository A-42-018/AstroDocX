import * as THREE from 'three'
import type { EmbedView } from '../shell/embedMode'

/*
 * The real console on the wall screens: each screen is an iframe of one console view (shell/Embed.tsx) laid over the
 * WebGL canvas and warped onto the screen's place in the scene. The warp is one CSS matrix3d per screen, worked out from the
 * same camera the scene is drawn with (a projective map of the iframe's rectangle onto the screen's four corners), so the page
 * sits exactly on the wall; unlike a CSS 3D scene, a single transformed element is hit-tested properly, which is what lets a
 * visitor tap, scroll and type in it once they step up to it. The canvas-drawn panel stays underneath as the screen seen from
 * afar; the live view fades in when the camera faces the screen and nobody floats in between, since DOM cannot be hidden
 * behind WebGL geometry.
 */

export interface ScreenSpec { view: EmbedView; px: [number, number] }
interface Screen {
  frame: HTMLIFrameElement; pos: THREE.Vector3; rotY: number; normal: THREE.Vector3; w: number; h: number; loaded: boolean; shown: number; off: boolean | null
  view: EmbedView; crew: string | null | undefined
  /** The CSS pixel size it is laid out at on the wall (`px`), the size now (wider while stepped up to, so the page has room), and whether it is in use. */
  px: [number, number]; cur: [number, number]; engaged: boolean; path: string; label: string
  /** Stepped up to on a narrow, tall window: the screen fills the view below this many pixels from the top, flat, instead of hanging on the wall. */
  flatTop: number | null
  /** The "Tap to use" chip under it, where it hangs, and how far it has faded in. */
  chipEl: HTMLButtonElement; chipAt: THREE.Vector3; chipShown: number
  /** The page it should load once the camera comes near (each screen is a whole console app), and not before when. */
  pending: string | null; notBefore: number
}
export interface ScreenEvents {
  /** The chip under screen `i` was tapped. */
  onUse?: (i: number) => void
  /** The page on screen `i` changed (path and its title), as reported by the frame. */
  onRoute?: (i: number, path: string, label: string) => void
  /** Esc was pressed inside screen `i` while it was in use. */
  onEscape?: (i: number) => void
}

/** The path a screen's own view opens at (shell/Embed.tsx). */
const homeOf = (view: EmbedView) => `/${view}`
/** The chip's size in CSS pixels (cabin.css .screen-chip) and how wide it hangs in the scene, as a fraction of its screen's width. */
const CHIP_PX: [number, number] = [520, 118], CHIP_W = 0.22

/**
 * The CSS matrix3d that lays a `px`-sized element (origin top left, y down) on the plane at `model` (x right, y up, `k` metres a
 * pixel), as seen by `camera` on a `vw` x `vh` screen. A point's screen position is its clip position divided by w, which a
 * matrix3d with a fourth row does the same way.
 */
const flat = new THREE.Matrix4(), toScreen = new THREE.Matrix4(), local = new THREE.Matrix4(), shift = new THREE.Matrix4()
function warp(out: THREE.Matrix4, camera: THREE.PerspectiveCamera, model: THREE.Matrix4, px: [number, number], k: number, vw: number, vh: number) {
  local.makeScale(k, -k, 1).multiply(shift.makeTranslation(-px[0] / 2, -px[1] / 2, 0))
  toScreen.set(vw / 2, 0, 0, vw / 2, 0, -vh / 2, 0, vh / 2, 0, 0, 1, 0, 0, 0, 0, 1) // z kept (as depth) so the matrix stays invertible: Chrome draws and hit-tests only those
  return out.copy(toScreen).multiply(flat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)).multiply(model).multiply(local)
}
const css = (m: THREE.Matrix4) => `matrix3d(${m.elements.map((n) => (Number.isFinite(n) ? n : 0).toPrecision(9)).join(',')})`

export function createScreens(host: HTMLElement, base: string, events: ScreenEvents = {}) {
  const el = document.createElement('div')
  el.className = 'cabin-screens'
  host.appendChild(el)
  const list: Screen[] = []
  const toCam = new THREE.Vector3(), seg = new THREE.Vector3(), q = new THREE.Vector3(), corner = new THREE.Vector3()
  const model = new THREE.Matrix4(), m = new THREE.Matrix4(), clip = new THREE.Vector4()
  let vw = 1, vh = 1

  /** A screen of `w` x `h` m, rendered at `px` CSS pixels. */
  function add(spec: ScreenSpec, w: number, h: number) {
    const frame = document.createElement('iframe')
    frame.title = `AstroDocX ${spec.view} screen`
    frame.tabIndex = -1
    frame.setAttribute('aria-hidden', 'true')
    frame.style.width = `${spec.px[0]}px`; frame.style.height = `${spec.px[1]}px`
    frame.style.pointerEvents = 'none' // the wheel, drag and clicks belong to the canvas beneath, until the screen is stepped up to
    // a chip under the screen: seen up close, it says the screen can be used, and a tap on it does that
    const chipEl = document.createElement('button')
    chipEl.type = 'button'; chipEl.className = 'screen-chip'; chipEl.textContent = 'Tap to use ▸'; chipEl.tabIndex = -1
    chipEl.setAttribute('aria-hidden', 'true')
    el.append(frame, chipEl)
    const s: Screen = {
      frame, pos: new THREE.Vector3(), rotY: 0, normal: new THREE.Vector3(0, 0, 1), w, h, loaded: false, shown: 0, off: null, view: spec.view, crew: undefined,
      px: spec.px, cur: [...spec.px], engaged: false, path: homeOf(spec.view), label: '', flatTop: null, chipEl, chipAt: new THREE.Vector3(), chipShown: 0, pending: null, notBefore: 0,
    }
    const index = list.length
    chipEl.addEventListener('click', (e) => { e.stopPropagation(); events.onUse?.(index) })
    frame.addEventListener('load', () => { s.off = null; if (frame.src) setTimeout(() => { s.loaded = true }, 900) }) // the app paints its data shortly after load
    list.push(s)
    return s
  }

  function place(i: number, pos: THREE.Vector3, rotY: number) {
    const s = list[i]
    s.pos.copy(pos); s.rotY = rotY
    s.normal.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
    s.chipAt.copy(pos).addScaledVector(s.normal, 0.06).y -= s.h / 2 + 0.32
  }

  /** Loads (or reloads, for a new crew member) the console view; iframes start one after another so the cabin stays smooth. */
  function load(i: number, crew: string | null, delay = 0) {
    const s = list[i]
    if (s.crew === crew) return
    s.crew = crew; s.loaded = false
    const url = `${base}${s.view}?embed=${s.view}${crew ? `&crew=${encodeURIComponent(crew)}` : ''}`
    s.path = homeOf(s.view); s.label = ''
    // a screen that has never loaded waits for the camera to come near it (render below): four console apps booting at
    // once, before anyone has walked to them, is what made the cabin stutter on slower laptops
    if (!s.frame.src) { s.pending = url; s.notBefore = performance.now() + delay; return }
    setTimeout(() => { s.frame.src = url }, delay)
  }
  /** Starts the waiting load of a screen the camera is near, one at a time (LOAD_GAP apart). */
  let nextLoad = 0
  const LOAD_GAP = 1200, LOAD_NEAR = 9
  function startLoads(cam: THREE.Vector3) {
    const now = performance.now()
    if (now < nextLoad) return
    const s = list.filter((x) => x.pending && now >= x.notBefore && (x.engaged || x.pos.distanceTo(cam) < LOAD_NEAR))
      .sort((a, b) => a.pos.distanceTo(cam) - b.pos.distanceTo(cam))[0]
    if (!s) return
    s.frame.src = s.pending!; s.pending = null; nextLoad = now + LOAD_GAP
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

  /** Is the point in front of the camera and inside (a little beyond) its view? A matrix3d on a plane crossing the camera's plane would draw garbage. */
  function inView(camera: THREE.PerspectiveCamera, p: THREE.Vector3) {
    clip.set(p.x, p.y, p.z, 1).applyMatrix4(flat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    return clip.w > 0.05
  }

  function render(camera: THREE.PerspectiveCamera, blockers: THREE.Vector3[], dt: number) {
    camera.updateMatrixWorld()
    startLoads(camera.position)
    for (const s of list) {
      toCam.copy(camera.position).sub(s.pos)
      const dist = toCam.length(), facing = toCam.divideScalar(dist).dot(s.normal)
      // a screen being used is always live; the others only when faced, near, and with nobody floating in front
      const want = s.loaded && (s.engaged || (facing > 0.62 && dist < 11 && !blocked(s, camera.position, blockers))) ? 1 : 0
      s.shown = THREE.MathUtils.damp(s.shown, want, 6, dt)
      if (s.shown < 0.01) s.shown = want ? s.shown : 0
      const shown = s.shown > 0 && (s.flatTop !== null || (facing > 0 && inView(camera, s.pos)))
      s.frame.style.opacity = s.shown.toFixed(3)
      s.frame.style.visibility = shown ? 'visible' : 'hidden' // kept in the DOM (so it loads), just not drawn
      if (shown && s.flatTop !== null) s.frame.style.transform = `translate(0px, ${s.flatTop}px)`
      else if (shown) {
        model.makeRotationY(s.rotY).setPosition(s.pos)
        s.frame.style.transform = css(warp(m, camera, model, s.cur, s.w / s.cur[0], vw, vh))
      }
      // a hidden screen pauses its own animation (live/usePaused.ts), which would otherwise run under every cabin frame
      const off = s.shown === 0
      if (off !== s.off) { s.off = off; s.frame.dataset.offstage = off ? '1' : '0'; s.frame.contentWindow?.postMessage({ offstage: off }, location.origin) }
      // the chip: close and facing, not in use
      const near = !s.engaged && s.loaded && facing > 0.7 && dist < 9 && s.shown > 0.5 ? 1 : 0
      s.chipShown = THREE.MathUtils.damp(s.chipShown, near, 6, dt)
      if (s.chipShown < 0.01) s.chipShown = near ? s.chipShown : 0
      const chip = s.chipShown > 0 && facing > 0
      s.chipEl.style.opacity = s.chipShown.toFixed(3)
      s.chipEl.style.visibility = chip ? 'visible' : 'hidden'
      if (chip) {
        model.makeRotationY(s.rotY).setPosition(s.chipAt)
        s.chipEl.style.transform = css(warp(m, camera, model, CHIP_PX, (s.w * CHIP_W) / CHIP_PX[0], vw, vh))
      }
    }
  }

  /** Lays screen `i` out at `width` CSS pixels (its shape kept) in the same place on the wall: more pixels, smaller type. */
  function setWidth(i: number, width: number, flat?: [number, number, number]) {
    const s = list[i], k = s.px[1] / s.px[0]
    s.flatTop = flat ? flat[2] : null
    s.cur = flat ? [flat[0], flat[1]] : [width, Math.round(width * k)]
    s.frame.style.width = `${s.cur[0]}px`; s.frame.style.height = `${s.cur[1]}px`
  }

  /**
   * Steps up to screen `i` (null: steps back from all): its frame takes the pointer, the keyboard and the wheel, is laid out
   * `width` px wide so the page has room (or, with `flat` [width, height, top], laid over the window below `top`: for a phone held upright),
   * and is told so it can scroll. Only one screen is in use at a time.
   */
  function engage(i: number | null, width?: number, flat?: [number, number, number]) {
    list.forEach((s, j) => {
      const on = j === i
      if (on === s.engaged) { if (on && width) setWidth(j, width, flat); return }
      s.engaged = on
      s.frame.style.pointerEvents = on ? 'auto' : 'none'
      s.frame.tabIndex = on ? 0 : -1
      if (on) s.frame.removeAttribute('aria-hidden'); else s.frame.setAttribute('aria-hidden', 'true')
      setWidth(j, on && width ? width : s.px[0], on ? flat : undefined)
      s.frame.contentWindow?.postMessage({ engaged: on }, location.origin)
      if (on) s.frame.focus({ preventScroll: true })
    })
  }
  /** Opens `path` on screen `i`, a page of the console. */
  const nav = (i: number, path: string) => { list[i].frame.contentWindow?.postMessage({ nav: path }, location.origin) }
  /** Back to the page the screen shows when nobody has touched it. */
  const home = (i: number) => { if (list[i].path !== homeOf(list[i].view)) nav(i, homeOf(list[i].view)) }

  // what the frames report: the page they are on, and Esc pressed inside them
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin) return
    const d = e.data as { adxScreen?: string; path?: string; label?: string } | null
    if (!d || typeof d.adxScreen !== 'string') return
    const i = list.findIndex((s) => s.frame.contentWindow === e.source)
    if (i < 0) return
    if (d.adxScreen === 'route' && typeof d.path === 'string') { list[i].path = d.path; list[i].label = d.label ?? ''; events.onRoute?.(i, d.path, list[i].label) }
    else if (d.adxScreen === 'escape') events.onEscape?.(i)
  }
  window.addEventListener('message', onMessage)

  return {
    add, place, load, render, engage, nav, home,
    path: (i: number) => list[i].path,
    label: (i: number) => list[i].label,
    /** How far screen `i`'s live view has faded in (1 = fully covering the panel beneath). */
    shown: (i: number) => list[i].shown,
    setSize: (w: number, h: number) => { vw = w; vh = h },
    dispose: () => { window.removeEventListener('message', onMessage); for (const s of list) s.frame.src = 'about:blank'; el.remove() },
  }
}
