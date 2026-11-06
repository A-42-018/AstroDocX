import * as THREE from 'three'

/*
 * Motion helpers for the cabin's camera: a critically damped spring (it eases in and out, and a target that moves
 * mid-flight does not jerk it) and a time-based slerp. Pure, so they test without a renderer.
 */

/** A scalar with the velocity it is travelling at. */
export interface Spring { x: number; v: number }

/**
 * Critically damped spring toward `target` (Unity's SmoothDamp): reaches it in about `smoothTime` seconds without
 * overshooting, whatever the frame time. `maxSpeed` caps the travel in units a second, so a long jump glides rather than streaks.
 */
export function smoothDamp(s: Spring, target: number, smoothTime: number, dt: number, maxSpeed = Infinity) {
  const st = Math.max(0.0001, smoothTime), w = 2 / st, x = w * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const limit = maxSpeed * st
  const change = THREE.MathUtils.clamp(s.x - target, -limit, limit)
  const to = s.x - change
  const tmp = (s.v + w * change) * dt
  s.v = (s.v - w * tmp) * e
  let out = to + (change + tmp) * e
  if (target - s.x > 0 === out > target) { out = target; s.v = (out - target) / Math.max(dt, 1e-6) } // never past the target
  s.x = out
  return out
}

/** The same spring for a vector, one scalar spring a component. */
export function smoothDampV(cur: THREE.Vector3, vel: THREE.Vector3, target: THREE.Vector3, smoothTime: number, dt: number, maxSpeed = Infinity) {
  const sx = { x: cur.x, v: vel.x }, sy = { x: cur.y, v: vel.y }, sz = { x: cur.z, v: vel.z }
  cur.set(smoothDamp(sx, target.x, smoothTime, dt, maxSpeed), smoothDamp(sy, target.y, smoothTime, dt, maxSpeed), smoothDamp(sz, target.z, smoothTime, dt, maxSpeed))
  vel.set(sx.v, sy.v, sz.v)
  return cur
}

/** Slerps `q` toward `target` by time, not by frame: `lambda` is how quickly (about 1 / seconds to settle). */
export function dampQuat(q: THREE.Quaternion, target: THREE.Quaternion, lambda: number, dt: number) {
  return q.slerp(target, 1 - Math.exp(-lambda * dt))
}

/** The shortest signed turn from angle `a` to angle `b`, radians. */
export function angleDelta(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a))
}
