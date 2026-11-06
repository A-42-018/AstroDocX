import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { angleDelta, dampQuat, smoothDamp, smoothDampV, type Spring } from './motion'

const run = (s: Spring, target: number, seconds: number, dt = 1 / 60, smooth = 0.5, max = Infinity) => {
  const xs: number[] = []
  for (let t = 0; t < seconds; t += dt) xs.push(smoothDamp(s, target, smooth, dt, max))
  return xs
}

describe('smoothDamp', () => {
  it('settles on the target without overshooting it', () => {
    const xs = run({ x: 0, v: 0 }, 5, 3)
    expect(Math.max(...xs)).toBeLessThanOrEqual(5.0001)
    expect(xs.at(-1)).toBeCloseTo(5, 2)
  })
  it('eases in and out: slow at first, fastest in the middle, slow at the end', () => {
    const xs = run({ x: 0, v: 0 }, 1, 1.5), step = xs.map((x, i) => x - (xs[i - 1] ?? 0))
    expect(step[1]).toBeLessThan(Math.max(...step) * 0.4)
    expect(step.at(-1)!).toBeLessThan(Math.max(...step) * 0.1)
  })
  it('takes the same path at 30 and 120 frames a second', () => {
    const after = (steps: number, dt: number) => { const s: Spring = { x: 0, v: 0 }; let x = 0; for (let i = 0; i < steps; i++) x = smoothDamp(s, 4, 0.5, dt); return x }
    expect(Math.abs(after(15, 1 / 30) - after(60, 1 / 120))).toBeLessThan(0.1) // half a second either way; the spring's polynomial is a close fit, not exact
  })
  it('keeps its speed when the target moves mid-flight (no jerk)', () => {
    const s = { x: 0, v: 0 }
    run(s, 10, 0.4)
    const before = s.v
    smoothDamp(s, 3, 0.5, 1 / 60)
    expect(Math.abs(s.v - before)).toBeLessThan(before * 0.35)
  })
  it('caps the travel speed so a long jump glides', () => {
    const s = { x: 0, v: 0 }
    const peak = Math.max(...run(s, 100, 1, 1 / 60, 0.5, 2).map((x, i, a) => (x - (a[i - 1] ?? 0)) * 60))
    expect(peak).toBeLessThan(2.3)
  })
})

describe('smoothDampV', () => {
  it('moves a vector to its target', () => {
    const cur = new THREE.Vector3(), vel = new THREE.Vector3(), to = new THREE.Vector3(2, -1, 3)
    for (let i = 0; i < 240; i++) smoothDampV(cur, vel, to, 0.4, 1 / 60)
    expect(cur.distanceTo(to)).toBeLessThan(0.01)
  })
})

describe('dampQuat and angleDelta', () => {
  it('turns toward the target by time, not by frame', () => {
    const target = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1)
    const a = new THREE.Quaternion(), b = new THREE.Quaternion()
    for (let i = 0; i < 30; i++) dampQuat(a, target, 6, 1 / 60)
    for (let i = 0; i < 60; i++) dampQuat(b, target, 6, 1 / 120)
    expect(a.angleTo(b)).toBeLessThan(0.01)
    expect(a.angleTo(target)).toBeLessThan(0.1)
  })
  it('takes the short way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6)
    expect(angleDelta(0, 0.5)).toBeCloseTo(0.5)
  })
})
