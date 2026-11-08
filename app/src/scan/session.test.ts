import { describe, expect, it } from 'vitest'
import { SCAN_SECONDS } from './rppg'
import { ScanSession } from './session'
import type { FrameMeasure } from './roi'
import { whyNot } from './store'

const STEP = 1000 / 30

/** A frame as the measuring step would report it: a face with a 72 bpm pulse in the colour. */
function face(t: number, over: Partial<FrameMeasure> = {}): FrameMeasure {
  const beat = Math.sin(2 * Math.PI * 1.2 * (t / 1000))
  return { r: 182 * (1 + 0.005 * beat), g: 121 * (1 + 0.012 * beat), b: 104 * (1 + 0.007 * beat), skin: 0.95, luma: 140, clipped: 0, cx: 0.5, cy: 0.5, ...over }
}
const wall = (): Partial<FrameMeasure> => ({ skin: 0, cx: null, cy: null })

/** Run frames from `from` to `to` ms; `over` picks per-frame overrides. */
function run(s: ScanSession, from: number, to: number, over: (t: number) => Partial<FrameMeasure> = () => ({})) {
  for (let t = from; t < to; t += STEP) s.feed(face(t, over(t)), t)
}

describe('ScanSession', () => {
  it('starts aiming with the face-alignment hint', () => {
    const s = new ScanSession()
    expect(s.state.phase).toBe('aiming')
    s.feed(face(0, wall()), 0)
    expect(s.state.verdict).toBe('no-face')
    expect(s.state.hint).toMatch(/oval/)
  })

  it('waits for a steady face before starting the clock', () => {
    const s = new ScanSession()
    run(s, 0, 1000)
    expect(s.state.phase).toBe('aiming')
    run(s, 1000, 2000)
    expect(s.state.phase).toBe('measuring')
  })

  it('reads a full scan to a heart rate near the true one', () => {
    const s = new ScanSession()
    run(s, 0, 1700 + SCAN_SECONDS * 1000 + 200)
    expect(s.state.phase).toBe('done')
    expect(s.state.progress).toBe(1)
    const f = s.state.final!
    expect(f.reliable).toBe(true)
    expect(Math.abs(f.bpm! - 72)).toBeLessThan(2)
    expect(whyNot(f)).toBeNull()
  })

  it('shows a live heart rate from about 10 s in', () => {
    const s = new ScanSession()
    run(s, 0, 1700 + 9000)
    expect(s.state.live).toBeNull()
    run(s, 1700 + 9000, 1700 + 13000)
    expect(s.state.live?.reliable).toBe(true)
    expect(s.state.trace.length).toBeGreaterThan(30)
  })

  it('forgives a brief glitch but not a long loss of signal', () => {
    const s = new ScanSession()
    run(s, 0, 8000)
    expect(s.state.phase).toBe('measuring')
    run(s, 8000, 8400, wall) // 0.4 s: skipped, run carries on
    run(s, 8400, 9000)
    expect(s.state.phase).toBe('measuring')
    expect(s.state.restarts).toBe(0)
    run(s, 9000, 10500, wall) // 1.5 s: gone
    expect(s.state.phase).toBe('aiming')
    expect(s.state.restarts).toBe(1)
    expect(s.state.seconds).toBe(0)
  })

  it('tells the person what to fix', () => {
    const s = new ScanSession()
    s.feed(face(0, { luma: 20, skin: 0.9 }), 0)
    expect(s.state.hint).toMatch(/dark/)
    s.feed(face(33, { luma: 240, clipped: 0.3 }), 33)
    expect(s.state.hint).toMatch(/bright/)
  })

  it('ignores frames once done', () => {
    const s = new ScanSession()
    run(s, 0, 1700 + SCAN_SECONDS * 1000 + 200)
    const before = s.state
    expect(s.feed(face(60000), 60000)).toBe(false)
    expect(s.state).toBe(before)
  })
})
