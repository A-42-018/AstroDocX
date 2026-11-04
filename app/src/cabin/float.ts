import * as THREE from 'three'

/*
 * Float mode: a free camera that drifts through the hall, kept inside it. The hall's walls are read from the same depth maps
 * the tour's framing uses (wall.ts): at any height and place along the hall they say how far in the wall, a rib or a pipe reaches,
 * so the camera slides along them instead of through them. The pure maths lives here; scene.ts drives it each frame.
 */

/** A body's radius round the camera, metres. */
export const BODY = 0.45
/** Cruise speed in metres a second, and the boost with Shift. */
export const SPEED = 2.2, BOOST = 2
/** How far a look can tip up or down, radians. */
export const PITCH_MAX = 1.45

export interface HallBounds {
  y0: number; y1: number; z0: number; z1: number
  /** |x| of the wall on `side` (-1 left, +1 right) at height y, place z along the hall; null where open. */
  reach: (side: -1 | 1, y: number, z: number) => number | null
  /** The wall's plain distance from the middle when the depth maps are not there (yet). */
  half: number
}

/** The view direction for a yaw and pitch (radians). Positive yaw turns left, positive pitch looks up; zero looks down the hall (-z), like the tour's drag. */
export function dirOf(yaw: number, pitch: number, out = new THREE.Vector3()) {
  const cp = Math.cos(pitch)
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
}
/** The yaw and pitch of a view direction (dirOf's inverse). */
export function anglesOf(d: THREE.Vector3) {
  return { yaw: Math.atan2(-d.x, -d.z), pitch: THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), -PITCH_MAX, PITCH_MAX) }
}

/**
 * The velocity a held input asks for: `fwd` along the view (+1 forward), `strafe` to the right, `lift` up, in the units
 * of the speed (1 = cruise). Diagonals are not faster than straight lines.
 */
export function wanted(dir: THREE.Vector3, fwd: number, strafe: number, lift: number, boost = false, out = new THREE.Vector3()) {
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
  out.copy(dir).multiplyScalar(fwd).addScaledVector(right, strafe) // forward includes the pitch: you fly where you look
  out.y += lift
  const m = out.length()
  if (m > 1) out.divideScalar(m)
  return out.multiplyScalar(SPEED * (boost ? BOOST : 1))
}

/**
 * Keeps `pos` inside the hall. The ceiling, floor and ends stop it (and take the speed along that axis away); a side wall
 * eases it back, so a rib or pipe slides the camera along it with no snap. `vel` is changed in place.
 */
export function constrain(pos: THREE.Vector3, vel: THREE.Vector3, b: HallBounds, dt: number, r = BODY) {
  if (pos.y < b.y0 + r) { pos.y = b.y0 + r; if (vel.y < 0) vel.y = 0 }
  if (pos.y > b.y1 - r) { pos.y = b.y1 - r; if (vel.y > 0) vel.y = 0 }
  if (pos.z < b.z0 + r) { pos.z = b.z0 + r; if (vel.z < 0) vel.z = 0 }
  if (pos.z > b.z1 - r) { pos.z = b.z1 - r; if (vel.z > 0) vel.z = 0 }
  // the nearest the wall comes round the camera and a little way ahead along z, so a rib is slid round before it is reached
  const ahead = THREE.MathUtils.clamp(vel.z * 0.35, -1.2, 1.2)
  const nearest = (side: -1 | 1) => {
    let m = b.half
    for (const dz of [-r, 0, r, ahead]) for (const dy of [-0.3, 0, 0.3]) m = Math.min(m, b.reach(side, pos.y + dy, pos.z + dz) ?? b.half)
    return m - r
  }
  const left = nearest(-1), right = nearest(1)
  const lo = -Math.max(0.2, left), hi = Math.max(0.2, right)
  const k = 1 - Math.exp(-14 * dt)
  if (pos.x > hi) { pos.x += (hi - pos.x) * k; if (vel.x > 0) vel.x = 0 }
  if (pos.x < lo) { pos.x += (lo - pos.x) * k; if (vel.x < 0) vel.x = 0 }
}
