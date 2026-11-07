import { describe, expect, it } from 'vitest'
import { FrameReassembler, NEWEST_HR_QUERY, decodeFrame, decodeUnits, leUint, plausible } from './frames'

/** Frames captured from a real Haylou Solar 5 (see research_notes/haylou-solar5-ble-protocol.md). */
const hex = (s: string) => Uint8Array.from(s.trim().split(/\s+/).map((h) => parseInt(h, 16)))
const REPLY = hex('6f 62 80 07 00 01 05 f3 fd ee 6a 57 8f')   // newest heart rate: 87 bpm at 2026-11-07 10:31:15 UTC
const EVENT = hex('6f e0 71 03 00 01 01 45 8f')               // pushed heart rate: 69 bpm

describe('FrameReassembler', () => {
  it('returns a whole frame in one chunk', () => {
    const [f, ...rest] = new FrameReassembler().push(REPLY)
    expect(rest).toEqual([])
    expect(f.cmd).toBe(0x62)
    expect(f.type).toBe(0x80)
    expect([...f.payload]).toEqual([0x01, 0x05, 0xf3, 0xfd, 0xee, 0x6a, 0x57])
  })

  it('joins a frame split across two notifications', () => {
    const r = new FrameReassembler()
    expect(r.push(REPLY.subarray(0, 8))).toEqual([])
    const out = r.push(REPLY.subarray(8))
    expect(out).toHaveLength(1)
    expect(decodeFrame(out[0])).toEqual({ kind: 'newest', reading: { bpm: 87, at: 1794047475 } })
  })

  it('joins a frame split at every possible byte', () => {
    for (let cut = 1; cut < EVENT.length; cut++) {
      const r = new FrameReassembler()
      expect(r.push(EVENT.subarray(0, cut))).toEqual([])
      expect(r.push(EVENT.subarray(cut))).toHaveLength(1)
    }
  })

  it('returns two frames that arrive in one chunk, in order', () => {
    const both = Uint8Array.from([...EVENT, ...REPLY])
    const out = new FrameReassembler().push(both)
    expect(out.map((f) => f.cmd)).toEqual([0xe0, 0x62])
  })

  it('skips noise before the start byte', () => {
    const out = new FrameReassembler().push(Uint8Array.from([0x00, 0x13, 0xff, ...EVENT]))
    expect(out).toHaveLength(1)
  })

  it('recovers from a corrupt frame (wrong end byte) and still reads the next one', () => {
    const bad = Uint8Array.from(EVENT); bad[bad.length - 1] = 0x00
    const out = new FrameReassembler().push(Uint8Array.from([...bad, ...EVENT]))
    expect(out).toHaveLength(1)
    expect(decodeFrame(out[0])).toEqual({ kind: 'event', samples: [{ kind: 'hr', value: 69 }] })
  })

  it('does not wait forever on an absurd length', () => {
    const r = new FrameReassembler()
    expect(r.push(Uint8Array.from([0x6f, 0x62, 0x80, 0xff, 0xff]))).toEqual([])
    expect(r.push(EVENT)).toHaveLength(1)
  })

  it('reset drops a half-received frame', () => {
    const r = new FrameReassembler()
    r.push(REPLY.subarray(0, 6)); r.reset()
    expect(r.push(EVENT)).toHaveLength(1)
  })
})

describe('decodeFrame', () => {
  it('reads the captured newest-heart-rate reply as 87 bpm at 2026-11-07 10:31:15 UTC', () => {
    const [f] = new FrameReassembler().push(REPLY)
    const m = decodeFrame(f)
    expect(m).toEqual({ kind: 'newest', reading: { bpm: 87, at: 1794047475 } })
    expect(new Date(1794047475 * 1000).toISOString()).toBe('2026-11-07T10:31:15.000Z')
  })

  it('reads the captured pushed event as 69 bpm', () => {
    const [f] = new FrameReassembler().push(EVENT)
    expect(decodeFrame(f)).toEqual({ kind: 'event', samples: [{ kind: 'hr', value: 69 }] })
  })

  it('ignores replies it does not know and events with nothing to show', () => {
    const [bindState] = new FrameReassembler().push(hex('6f 94 80 01 00 01 8f'))
    expect(decodeFrame(bindState)).toBeNull()
    const [steps] = new FrameReassembler().push(hex('6f e0 71 04 00 07 02 10 27 8f'))   // steps unit only
    expect(decodeFrame(steps)).toBeNull()
  })

  it('ignores a newest-heart-rate reply that is too short', () => {
    const [f] = new FrameReassembler().push(hex('6f 62 80 02 00 01 05 8f'))
    expect(decodeFrame(f)).toBeNull()
  })
})

describe('decodeUnits', () => {
  it('maps heart rate (1, 4), stress (2, 5) and SpO2 (3, 6), little endian', () => {
    const units = decodeUnits(Uint8Array.from([4, 1, 88, 6, 1, 97, 5, 1, 30, 1, 2, 0x2c, 0x01]))
    expect(units).toEqual([
      { kind: 'hr', value: 88 }, { kind: 'spo2', value: 97 }, { kind: 'stress', value: 30 }, { kind: 'hr', value: 300 },
    ])
  })

  it('skips unknown units and empty units, and stops at a truncated one', () => {
    expect(decodeUnits(Uint8Array.from([9, 2, 1, 0, 0, 0, 1, 1, 70]))).toEqual([{ kind: 'hr', value: 70 }])
    expect(decodeUnits(Uint8Array.from([1, 1, 70, 3, 4, 97]))).toEqual([{ kind: 'hr', value: 70 }])
  })
})

describe('helpers', () => {
  it('leUint reads little endian', () => {
    expect(leUint([0xf3, 0xfd, 0xee, 0x6a])).toBe(1794047475)
    expect(leUint([])).toBe(0)
  })

  it('plausible drops readings no body produces', () => {
    expect(plausible('hr', 69)).toBe(true)
    expect(plausible('hr', 0)).toBe(false)
    expect(plausible('hr', 255)).toBe(false)
    expect(plausible('spo2', 97)).toBe(true)
    expect(plausible('spo2', 101)).toBe(false)
    expect(plausible('stress', 0)).toBe(true)
  })

  it('the one query we send is the read-only newest heart rate frame', () => {
    expect([...NEWEST_HR_QUERY]).toEqual([0x6f, 0x62, 0x70, 0x01, 0x00, 0x01, 0x8f])
  })
})
