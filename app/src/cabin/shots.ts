import * as THREE from 'three'
import { HEIGHT } from './crew'
import { EVA_VIEW } from './eva'
import type { WallMap } from './wall'

/*
 * The tour's framing: where each crew member floats and where the camera stands at each stop. The wall screens are
 * shot at a three-quarter angle with a crew member floating just past one edge, never in front (the live console view
 * hides when anyone is between it and the camera, screens.ts). Each shot is searched for: a camera angle the hall's
 * ribs and pillars do not block (read from the walls' depth maps, wall.ts), then the crew spot nearest the screen that keeps every line to it clear, then the
 * look and field of view that hold both.
 */

export type V3 = [number, number, number]
export interface Slot { pos: V3; rot: V3 }
/** A tour stop. `fov` is the vertical field of view, widened where `span` (degrees across, degrees up) needs more at the window's aspect. */
export interface Stop { pos: THREE.Vector3; look: THREE.Vector3; fov: number; span?: [number, number] }
export interface ScreenAt { pos: THREE.Vector3; normal: THREE.Vector3; w: number; h: number }
/** The two walls' depth maps: left (-1) and right (+1). */
export type Walls = Record<-1 | 1, WallMap>

const DEG = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0)
/** Half the body's width, and half its height. */
const BODY_R = 0.5, BODY_H = HEIGHT / 2
/** Clearance between a crew member and any line from the camera to the screen: screens.ts hides at 0.75. */
const CLEAR = 0.95
/** Room left round the subjects at the frame's edges, degrees. */
const MARGIN = 8

/** The vertical field of view a stop needs at `aspect` (width / height). */
export function fovFor(s: Stop, aspect: number) {
  if (!s.span) return s.fov
  const fromW = 2 * Math.atan(Math.tan((s.span[0] * DEG) / 2) / aspect) / DEG
  return THREE.MathUtils.clamp(Math.max(s.fov, fromW, s.span[1]), 30, 72)
}

/** How far the wall on `p`'s side reaches in at `p`; Infinity where it is open or out of the map. */
function reach(walls: Walls, p: THREE.Vector3) {
  return walls[p.x < 0 ? -1 : 1].reach(p.y, p.z) ?? Infinity
}
/** Does the wall (a rib, a pillar) cut the segment from `a` to `b`, short of `b` by `stop`? */
function cuts(walls: Walls | null, a: THREE.Vector3, b: THREE.Vector3, stop = 0.15) {
  if (!walls) return false
  const len = a.distanceTo(b), q = new THREE.Vector3()
  for (let i = 1; i < 32; i++) {
    const t = (i / 32) * Math.max(0, len - stop) / len
    q.lerpVectors(a, b, t)
    if (Math.abs(q.x) > reach(walls, q) - 0.02) return true
  }
  return false
}
/** Would a body at `c` touch the wall? Its sides, at knees, waist and chest. */
function collides(walls: Walls | null, c: THREE.Vector3) {
  if (!walls) return false
  for (const dy of [-BODY_H * 0.6, 0, BODY_H * 0.6]) for (const dz of [-BODY_R, 0, BODY_R])
    if (Math.abs(c.x) + BODY_R > reach(walls, new THREE.Vector3(c.x, c.y + dy, c.z + dz))) return true
  return false
}
/** Distance from `p` to the segment from `a` to `b`. */
function toSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1)
  return a.clone().addScaledVector(ab, t).distanceTo(p)
}

/**
 * Aims a camera at `cam` to hold all of `pts` in frame: the look sits in the middle of their spread across and up,
 * and the span is that spread plus a margin each side.
 */
function frame(cam: THREE.Vector3, ref: THREE.Vector3, pts: THREE.Vector3[]): Pick<Stop, 'look' | 'span'> {
  const yaw0 = Math.atan2(ref.x - cam.x, ref.z - cam.z)
  let y0 = Infinity, y1 = -Infinity, p0 = Infinity, p1 = -Infinity
  for (const q of pts) {
    const dx = q.x - cam.x, dz = q.z - cam.z
    const yaw = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw0), Math.cos(Math.atan2(dx, dz) - yaw0))
    const pitch = Math.atan2(q.y - cam.y, Math.hypot(dx, dz))
    y0 = Math.min(y0, yaw); y1 = Math.max(y1, yaw); p0 = Math.min(p0, pitch); p1 = Math.max(p1, pitch)
  }
  const yaw = yaw0 + (y0 + y1) / 2, pitch = (p0 + p1) / 2
  const look = cam.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(5))
  return { look, span: [(y1 - y0) / DEG + MARGIN * 2, (p1 - p0) / DEG + MARGIN * 2] }
}

/**
 * A wall screen at a three-quarter angle from the door side, with (`withCrew`) a crew member floating just past
 * whichever edge keeps the shot tighter.
 */
function screenShot(s: ScreenAt, withCrew: boolean, walls: Walls | null): { stop: Stop; crew: Slot | null } {
  const n = s.normal.clone().setY(0).normalize(), a = new THREE.Vector3(0, 0, 1) // along the wall, toward the door
  const at = (k: number, m: number, y: number) => s.pos.clone().addScaledVector(n, k).addScaledVector(a, m).setY(y)
  const right = new THREE.Vector3().crossVectors(UP, n).normalize() // the screen's own right, as screens.ts samples it
  const samples = [[0, 0], [-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]].map(([x, y]) =>
    s.pos.clone().addScaledVector(right, x * s.w).add(new THREE.Vector3(0, y * s.h, 0)))
  const corners = [-1, 1].flatMap((x) => [-1, 1].map((y) =>
    s.pos.clone().addScaledVector(right, x * (s.w / 2 + 0.08)).add(new THREE.Vector3(0, y * (s.h / 2 + 0.08), 0))))
  const camY = s.pos.y + 0.1, crewY = s.pos.y - 0.5
  let fallback: { stop: Stop; crew: Slot | null } | null = null

  for (const deg of [24, 16, 32, 8]) for (const d of [4.0, 4.6, 3.6]) {
    const th = deg * DEG, cam = at(d * Math.cos(th), d * Math.sin(th), camY)
    const sees = !samples.some((q) => cuts(walls, cam, q))
    let best: { c: THREE.Vector3; span: number; f: ReturnType<typeof frame> } | null = null
    if (withCrew) for (const side of [-1, 1]) for (const k of [1.1, 1.4, 1.7, 2.0]) {
      for (let m = s.w / 2 + 0.3; m <= s.w / 2 + 2.6; m += 0.1) {
        const c = at(k, side * m, crewY)
        if (samples.some((q) => toSegment(c, cam, q) < CLEAR)) continue
        if (collides(walls, c) || cuts(walls, cam, c, BODY_R)) break // the wall closes in further along: try further out
        const side2 = new THREE.Vector3().crossVectors(UP, c.clone().sub(cam)).normalize().multiplyScalar(BODY_R)
        const f = frame(cam, s.pos, [...corners, c.clone().add(side2), c.clone().sub(side2), c.clone().setY(c.y + BODY_H), c.clone().setY(c.y - BODY_H)])
        if (!best || f.span![0] < best.span) best = { c, span: f.span![0], f }
        break
      }
    }
    const shot = (): { stop: Stop; crew: Slot | null } => {
      if (!best) return { stop: { pos: cam, ...frame(cam, s.pos, corners), fov: 44 }, crew: null }
      const c = best.c, face = Math.atan2(cam.x - c.x, cam.z - c.z)
      return { stop: { pos: cam, ...best.f, fov: 44 }, crew: { pos: c.toArray() as V3, rot: [0.1, face + 0.45, 0.07] } }
    }
    if (!fallback) fallback = shot()
    if (sees && (best || !withCrew)) return shot()
  }
  return fallback!
}

/**
 * The close-up on the crew member the console follows: from the hall side of them at their chest height, 4.2 m
 * off (name tag to boots in frame), with them on the frame's right third (the caption card sits bottom left).
 */
function closeShot(c: THREE.Vector3, s: ScreenAt, walls: Walls | null): { stop: Stop; rot: V3 } {
  const n = s.normal.clone().setY(0).normalize(), a = new THREE.Vector3(0, 0, 1)
  let dir = n.clone().multiplyScalar(0.85).addScaledVector(a, 0.55).normalize()
  for (const turn of [0, 0.4, -0.4, 0.8]) {
    const d = dir.clone().applyAxisAngle(UP, turn)
    if (!cuts(walls, c.clone().addScaledVector(d, 4.2).setY(c.y + 0.45), c, BODY_R)) { dir = d; break }
  }
  // the float loop carries the body ~0.5 m above `c`, and the name tag rides above the helmet: aim high enough for both
  const pos = c.clone().addScaledVector(dir, 4.2).setY(c.y + 0.45)
  const left = new THREE.Vector3().crossVectors(dir, UP).normalize() // the camera's left, as it looks back along -dir
  const look = c.clone().setY(c.y + 0.6).addScaledVector(left, 0.75)
  return { stop: { pos, look, fov: 46 }, rot: [0.06, Math.atan2(dir.x, dir.z) - 0.4, 0.05] }
}

/**
 * The crew's places and the tour's ten stops for a roster of `count` in the hall. The focus member (slot 0) floats
 * beside Live Vitals and gets the close-up; two work the forward desk at different depths, one upside down; one
 * floats high in the middle of the hall where the overview and the look back both see them; the Status Board gets
 * the next; larger crews fill Alerts, Trends and the aft end.
 */
export function layout(screens: ScreenAt[], count: number, walls: Walls | null = null) {
  const crewAt = [3, 0, 5, 6] // the slot that floats beside each screen
  const shots = screens.map((s, i) => screenShot(s, crewAt[i] < Math.max(count, 1), walls))
  const focus = shots[1].crew ?? { pos: screens[1].pos.clone().addScaledVector(screens[1].normal, 1.6).toArray() as V3, rot: [0, 0, 0] }
  const close = closeShot(new THREE.Vector3(...focus.pos), screens[1], walls)
  const slots: Slot[] = [
    { pos: focus.pos, rot: close.rot },
    { pos: [2.1, -1.0, -10.4], rot: [0.12, -0.5, -0.22] }, // forward desk, near and low, under the station's line
    { pos: [-2.0, 0.6, -12.4], rot: [Math.PI - 0.35, -0.6, 0.12] }, // forward desk, far and high, upside down
    shots[0].crew ?? { pos: [-2.2, -0.6, 8.5], rot: [0.1, 0.9, 0.06] },
    { pos: [0.9, 2.1, -1.5], rot: [0.45, -0.5, 1.1] }, // high in the middle of the hall, on their side
    shots[2].crew ?? { pos: [-2.2, -0.6, -2], rot: [0.1, 0.8, 0.06] },
    shots[3].crew ?? { pos: [2.2, -0.6, -6.5], rot: [0.1, -0.8, -0.06] },
    { pos: [-1.4, 1.6, 11.5], rot: [-0.3, 2.6, -0.5] },
  ]
  const v = (x: V3) => new THREE.Vector3(...x)
  const stops: Stop[] = [
    { pos: v([0, 0.4, 14]), look: v([0, -0.6, 0]), fov: 58 }, // the helmet: the HUD is laid out for this lens
    { pos: v([3.2, 1.9, 13]), look: v([-0.4, -0.3, -2]), fov: 62 },
    shots[0].stop, shots[1].stop, close.stop, shots[2].stop, shots[3].stop,
    { pos: v([0, 0.4, -5.5]), look: v([0, 0.1, -16]), fov: 54 },
    { pos: v([0, 2.0, -13.6]), look: v([0, -0.6, 10]), fov: 64 },
    // a metre further back than eva.ts frames it: room for the taller suit and the slow arc round it
    { pos: EVA_VIEW.pos.clone().addScaledVector(EVA_VIEW.pos.clone().sub(EVA_VIEW.look).normalize(), 1.0), look: EVA_VIEW.look.clone(), fov: 58 },
  ]
  return { slots, stops }
}
