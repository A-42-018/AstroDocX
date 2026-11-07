import { describe, expect, it } from 'vitest'
import { isSkin, judge, measureFrame, newTracker } from './roi'

const W = 128, H = 96

/** A grey wall with a skin-coloured face block, offset horizontally by `dx` (fraction of the width). */
function frame(skin: [number, number, number] | null = [190, 130, 110], dx = 0, wall: [number, number, number] = [80, 80, 92]) {
  const px = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / W - dx, fy = y / H
      const inFace = skin && fx >= 0.22 && fx <= 0.78 && fy >= 0.08 && fy <= 0.92
      const c = inFace ? skin : wall
      const i = (y * W + x) * 4
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255
    }
  }
  return px
}

describe('skin test', () => {
  it('accepts skin tones from light to dark and rejects walls, sky and grass', () => {
    for (const c of [[224, 172, 150], [190, 130, 110], [141, 85, 70], [100, 62, 50]]) expect(isSkin(c[0], c[1], c[2]), c.join()).toBe(true)
    for (const c of [[80, 80, 92], [60, 120, 200], [60, 160, 70], [240, 240, 240], [20, 20, 20]]) expect(isSkin(c[0], c[1], c[2]), c.join()).toBe(false)
  })
})

describe('measureFrame', () => {
  it('reads the mean skin colour of the patches', () => {
    const m = measureFrame(frame([190, 130, 110]), W, H)
    expect(m.skin).toBeGreaterThan(0.95)
    expect(m.r).toBeCloseTo(190, 0); expect(m.g).toBeCloseTo(130, 0); expect(m.b).toBeCloseTo(110, 0)
    expect(m.cx).toBeCloseTo(0.5, 1)
  })

  it('finds no skin on an empty wall', () => {
    const m = measureFrame(frame(null), W, H)
    expect(m.skin).toBe(0)
    expect(m.cx).toBeNull()
  })

  it('averages only the skin pixels when part of a patch is hair or a shadow', () => {
    const px = frame([190, 130, 110])
    // black out the left half of the forehead patch
    for (let y = Math.floor(0.2 * H); y < Math.ceil(0.3 * H); y++) for (let x = Math.floor(0.38 * W); x < Math.floor(0.5 * W); x++) { const i = (y * W + x) * 4; px[i] = px[i + 1] = px[i + 2] = 10 }
    const m = measureFrame(px, W, H)
    expect(m.skin).toBeLessThan(0.9)
    expect(m.r).toBeCloseTo(190, 0)
  })
})

describe('judge', () => {
  const run = (px: Uint8ClampedArray, frames = 12) => {
    const tr = newTracker(); let v = judge(measureFrame(px, W, H), 0, tr)
    for (let i = 1; i < frames; i++) v = judge(measureFrame(px, W, H), i * 33, tr)
    return v
  }

  it('passes a steady, well-lit face', () => expect(run(frame())).toBe('ok'))
  it('says no-face for an empty wall', () => expect(run(frame(null))).toBe('no-face'))
  it('says too-dark in the dark', () => expect(run(frame(null, 0, [10, 10, 12]))).toBe('too-dark'))
  it('says too-dark for a dim face', () => expect(run(frame([60, 40, 33]))).toBe('too-dark'))
  it('says too-bright for a blown-out face', () => expect(run(frame([255, 235, 215]))).toBe('too-bright'))

  it('says motion when the face keeps moving, and ok once it is still again', () => {
    const tr = newTracker()
    let v = judge(measureFrame(frame(), W, H), 0, tr)
    for (let i = 1; i <= 12; i++) v = judge(measureFrame(frame([190, 130, 110], (i % 2 ? 1 : -1) * 0.04), W, H), i * 33, tr)
    expect(v).toBe('motion')
    for (let i = 13; i <= 40; i++) v = judge(measureFrame(frame(), W, H), i * 33, tr)
    expect(v).toBe('ok')
  })

  it('does not call a slow natural sway motion', () => {
    const tr = newTracker()
    let v = judge(measureFrame(frame(), W, H), 0, tr)
    for (let i = 1; i <= 60; i++) v = judge(measureFrame(frame([190, 130, 110], 0.01 * Math.sin(i / 10)), W, H), i * 33, tr)
    expect(v).toBe('ok')
  })
})
