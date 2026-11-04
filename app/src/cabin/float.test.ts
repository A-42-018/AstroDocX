import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BODY, BOOST, PITCH_MAX, SPEED, anglesOf, constrain, dirOf, wanted, type HallBounds } from './float'

const open: HallBounds = { y0: -2.5, y1: 3.9, z0: -15, z1: 15, reach: () => null, half: 7.7 }
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

describe('view direction', () => {
  it('looks down the hall at zero, and turns left with positive yaw', () => {
    const d = dirOf(0, 0)
    expect([d.x, d.y, d.z].map((n) => +n.toFixed(6))).toEqual([0, 0, -1])
    expect(dirOf(Math.PI / 2, 0).x).toBeCloseTo(-1)
    expect(dirOf(0, 0.5).y).toBeGreaterThan(0)
  })
  it('anglesOf undoes dirOf, and clamps a straight-up look', () => {
    const a = anglesOf(dirOf(0.7, -0.4))
    expect(a.yaw).toBeCloseTo(0.7); expect(a.pitch).toBeCloseTo(-0.4)
    expect(anglesOf(v(0, 1, 0)).pitch).toBeCloseTo(PITCH_MAX)
  })
})

describe('wanted velocity', () => {
  const ahead = dirOf(0, 0)
  it('is cruise speed forward, boosted with Shift, and zero at rest', () => {
    expect(wanted(ahead, 1, 0, 0).length()).toBeCloseTo(SPEED)
    expect(wanted(ahead, 1, 0, 0, true).length()).toBeCloseTo(SPEED * BOOST)
    expect(wanted(ahead, 0, 0, 0).length()).toBe(0)
  })
  it('flies where you look, so looking up and going forward rises', () => {
    expect(wanted(dirOf(0, 0.8), 1, 0, 0).y).toBeGreaterThan(0)
  })
  it('strafes right of the view', () => {
    expect(wanted(ahead, 0, 1, 0).x).toBeGreaterThan(0)
    expect(wanted(dirOf(Math.PI / 2, 0), 0, 1, 0).z).toBeLessThan(0) // turned to face -x: its right is -z... away from the +x side
  })
  it('does not go faster along a diagonal', () => {
    expect(wanted(ahead, 1, 1, 1).length()).toBeCloseTo(SPEED)
  })
})

describe('constrain', () => {
  it('stops at the ceiling, floor and ends and takes that speed away', () => {
    const pos = v(0, 10, -40), vel = v(1, 3, -5)
    constrain(pos, vel, open, 0.016)
    expect(pos.y).toBeCloseTo(open.y1 - BODY); expect(pos.z).toBeCloseTo(open.z0 + BODY)
    expect(vel.y).toBe(0); expect(vel.z).toBe(0); expect(vel.x).toBe(1)
    const low = v(0, -9, 99); constrain(low, v(0, -1, 1), open, 0.016)
    expect(low.y).toBeCloseTo(open.y0 + BODY); expect(low.z).toBeCloseTo(open.z1 - BODY)
  })
  it('eases back from the plain walls, never beyond them', () => {
    const pos = v(9, 0, 0), vel = v(2, 0, 0)
    for (let i = 0; i < 120; i++) constrain(pos, vel, open, 0.016)
    expect(pos.x).toBeCloseTo(open.half - BODY, 1)
    expect(vel.x).toBe(0)
  })
  it('slides along a rib that reaches in, instead of through it', () => {
    // a rib 2 m wide along z, reaching in to |x| = 5 on the right wall
    const ribbed: HallBounds = { ...open, reach: (side, _y, z) => (side === 1 && z > 0 && z < 2 ? 5 : null) }
    const pos = v(7, 0, -1), vel = v(0, 0, 1)
    let widest = 0
    for (let i = 0; i < 300; i++) { pos.addScaledVector(vel, 0.016 * 2); constrain(pos, vel, ribbed, 0.016); if (pos.z > 0.2 && pos.z < 1.8) widest = Math.max(widest, pos.x) }
    expect(widest).toBeLessThan(5 - BODY + 0.35) // eased in beside the rib (a little lag as it eases, never through it)
    expect(pos.z).toBeGreaterThan(2)              // and still got past it
  })
  it('keeps the left wall to its own side', () => {
    const l: HallBounds = { ...open, reach: (side) => (side === -1 ? 3 : null) }
    const pos = v(-6, 0, 0), vel = v(-1, 0, 0)
    for (let i = 0; i < 200; i++) constrain(pos, vel, l, 0.016)
    expect(pos.x).toBeCloseTo(-(3 - BODY), 1)
  })
})
