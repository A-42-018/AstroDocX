import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { LOOK_D, fitStop, fovFor, layout, type ScreenAt, type Stop } from './shots'

/** The four wall screens as scene.ts hangs them: Status Board and Alerts on the left, Live Vitals and Trends on the right. */
const screens = (): ScreenAt[] => [[-6.2, 9], [6.2, 5], [-6.2, -1], [6.2, -5.5]].map(([x, z]) => ({
  pos: new THREE.Vector3(x, 0.2, z), normal: new THREE.Vector3(-Math.sign(x), 0, 0), w: 3.2, h: 1.875,
}))
const SCREEN_STOPS = [2, 3, 5, 6]

/** Where a point lands in the frame (-1..1 each way) for a stop at `aspect`, through the lens the tour would use there. */
function ndc(s: Stop, aspect: number, q: THREE.Vector3) {
  const cam = new THREE.PerspectiveCamera(fovFor(s, aspect), aspect, 0.08, 100)
  cam.position.copy(s.pos); cam.lookAt(s.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix()
  return q.clone().project(cam)
}

describe('layout', () => {
  const { stops, slots } = layout(screens(), 8)
  it('has ten stops and a place for each of the eight crew slots', () => {
    expect(stops).toHaveLength(10); expect(slots).toHaveLength(8)
  })
  it('puts every look the same distance ahead of its camera, so the path turns the view evenly', () => {
    for (const s of stops) expect(s.pos.distanceTo(s.look)).toBeCloseTo(LOOK_D, 4)
  })
  it('keeps every crew member clear of the tour camera', () => {
    for (const s of stops) for (const c of slots) expect(s.pos.distanceTo(new THREE.Vector3(...c.pos))).toBeGreaterThan(0.9)
  })
})

describe('screen stops hold the screen and the astronaut in frame', () => {
  for (const aspect of [16 / 9, 4 / 3]) it(`at ${aspect.toFixed(2)}:1`, () => {
    const { stops } = layout(screens(), 8)
    for (const i of SCREEN_STOPS) {
      const stop = fitStop(stops[i], aspect)
      expect(stop.pts?.length).toBeGreaterThan(4)
      for (const q of stop.pts!) {
        const p = ndc(stop, aspect, q)
        expect(Math.abs(p.x), `stop ${i} x`).toBeLessThan(0.97)
        expect(Math.abs(p.y), `stop ${i} y`).toBeLessThan(0.97)
        expect(p.z, `stop ${i} in front of the lens`).toBeLessThan(1)
      }
    }
  })
})

describe('the close-up (stop 4) holds the astronaut and the Live Vitals screen', () => {
  it('has the screen and the astronaut both inside the frame, the astronaut to the right', () => {
    const { stops } = layout(screens(), 8)
    const close = stops[4], vitals = screens()[1]
    const aspect = 16 / 9
    expect(close.pts?.length).toBeGreaterThan(4)
    for (const q of close.pts!) expect(Math.abs(ndc(close, aspect, q).x)).toBeLessThan(0.98)
    const screenX = ndc(close, aspect, vitals.pos).x
    expect(Math.abs(screenX)).toBeLessThan(0.95)
  })
})

describe('fitStop', () => {
  it('leaves a stop alone where the window is wide enough', () => {
    const stop = layout(screens(), 8).stops[3]
    expect(fitStop(stop, 16 / 9)).toBe(stop)
  })
  it('backs the camera off in a narrow window instead of widening the lens past 66 degrees', () => {
    const stop = layout(screens(), 8).stops[3], fitted = fitStop(stop, 0.9)
    expect(fitted.pos.distanceTo(stop.pos)).toBeGreaterThan(0.3)
    expect(fovFor(fitted, 0.9)).toBeLessThan(fovFor(stop, 0.9) + 0.01)
  })
})

describe('on a phone held upright', () => {
  for (const aspect of [9 / 16, 375 / 812]) it(`each wall screen fills most of the width, above the caption, at ${aspect.toFixed(2)}:1`, () => {
    const { stops } = layout(screens(), 8)
    for (const i of SCREEN_STOPS) {
      const stop = fitStop(stops[i], aspect)
      expect(stop.pos.distanceTo(stop.look)).toBeCloseTo(LOOK_D, 4)
      const p = stop.core!.map((q) => ndc(stop, aspect, q))
      const xs = p.map((q) => q.x), ys = p.map((q) => q.y)
      for (const q of p) { expect(Math.abs(q.x), `stop ${i} x`).toBeLessThan(0.99); expect(q.z).toBeLessThan(1) }
      expect(Math.max(...xs) - Math.min(...xs), `stop ${i} width`).toBeGreaterThan(1.4) // over 70% of the window across
      expect((Math.max(...ys) + Math.min(...ys)) / 2, `stop ${i} sits above the middle`).toBeGreaterThan(0.05)
      expect(Math.min(...ys), `stop ${i} clear of the caption`).toBeGreaterThan(-0.4)
    }
  })
  it('the close-up holds the whole astronaut between the top bar and the caption', () => {
    const aspect = 375 / 812, stop = fitStop(layout(screens(), 8).stops[4], aspect)
    for (const q of stop.core!) {
      const p = ndc(stop, aspect, q)
      expect(Math.abs(p.x)).toBeLessThan(0.99); expect(p.y).toBeLessThan(0.88); expect(p.y).toBeGreaterThan(-0.45)
    }
  })
  it('the fixed stops open the lens up so a phone sees more of the hall', () => {
    const helmet = layout(screens(), 8).stops[0]
    expect(fovFor(helmet, 16 / 9)).toBe(helmet.fov)
    expect(fovFor(helmet, 375 / 812)).toBeGreaterThan(helmet.fov + 5)
  })
})
