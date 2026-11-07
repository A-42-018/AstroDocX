/**
 * Wire format of the Haylou Solar 5 data service (service 6006), as recovered from the Haylou Fun app and
 * confirmed on a real watch. Pure functions only: no Bluetooth here, so everything is unit-testable.
 *
 *   6F | cmd | type | len lo | len hi | payload (len bytes) | 8F
 *
 * Requests go to characteristic 8001, replies arrive on 8002, and the watch pushes events on 8004.
 * A frame can be split across several notifications, so incoming bytes go through a FrameReassembler.
 */

export const FRAME_START = 0x6f
export const FRAME_END = 0x8f
/** A longer declared payload than this is treated as noise rather than waited for. */
const MAX_PAYLOAD = 4096

export const CMD_EVENT = 0xe0
export const CMD_NEWEST_HR = 0x62
export const TYPE_REPLY = 0x80

/**
 * The only request this app ever sends: "give me your newest heart rate reading" (a read query).
 * Frame: start, cmd 0x62, type 0x70 (read), length 1, payload 0x01, end.
 */
export const NEWEST_HR_QUERY: Readonly<Uint8Array> = Uint8Array.from([0x6f, 0x62, 0x70, 0x01, 0x00, 0x01, 0x8f])

export interface Frame { cmd: number; type: number; payload: Uint8Array }

/** Collects notification chunks and hands back whole frames, resynchronising on the start byte after noise. */
export class FrameReassembler {
  private buf: number[] = []

  push(chunk: ArrayLike<number>): Frame[] {
    for (let i = 0; i < chunk.length; i++) this.buf.push(chunk[i] & 0xff)
    const out: Frame[] = []
    for (;;) {
      while (this.buf.length && this.buf[0] !== FRAME_START) this.buf.shift()
      if (this.buf.length < 5) break
      const len = this.buf[3] | (this.buf[4] << 8)
      if (len > MAX_PAYLOAD) { this.buf.shift(); continue }
      const total = len + 6
      if (this.buf.length < total) break
      if (this.buf[total - 1] !== FRAME_END) { this.buf.shift(); continue }
      const bytes = this.buf.splice(0, total)
      out.push({ cmd: bytes[1], type: bytes[2], payload: Uint8Array.from(bytes.slice(5, 5 + len)) })
    }
    return out
  }

  reset() { this.buf = [] }
}

/** What a sample measures. */
export type SampleKind = 'hr' | 'spo2' | 'stress'
export interface Sample { kind: SampleKind; value: number }

/** Event value-unit types: heart rate 1 and 4, stress 2 and 5, SpO2 3 and 6 (the others are steps, calories and so on). */
const UNIT_KIND: Record<number, SampleKind> = { 1: 'hr', 4: 'hr', 2: 'stress', 5: 'stress', 3: 'spo2', 6: 'spo2' }

/** Little-endian unsigned integer from a few bytes. */
export function leUint(bytes: ArrayLike<number>): number {
  let v = 0
  for (let i = 0; i < bytes.length; i++) v += (bytes[i] & 0xff) * 2 ** (8 * i)
  return v
}

/** Event payload: a list of `[type][len][len bytes, little endian]` units. Unknown types are skipped. */
export function decodeUnits(payload: Uint8Array): Sample[] {
  const out: Sample[] = []
  let i = 0
  while (i + 2 < payload.length) {
    const type = payload[i], len = payload[i + 1]
    if (len === 0) { i += 2; continue }
    if (i + 2 + len > payload.length) break
    const kind = UNIT_KIND[type]
    if (kind) out.push({ kind, value: leUint(payload.subarray(i + 2, i + 2 + len)) })
    i += 2 + len
  }
  return out
}

/** The reply to the newest-heart-rate query: `bpm` taken at `at` (unix seconds, from the watch's clock). */
export interface NewestHr { bpm: number; at: number }

export type WatchMessage =
  | { kind: 'event'; samples: Sample[] }
  | { kind: 'newest'; reading: NewestHr }

export function decodeFrame(f: Frame): WatchMessage | null {
  if (f.cmd === CMD_EVENT) {
    const samples = decodeUnits(f.payload)
    return samples.length ? { kind: 'event', samples } : null
  }
  if (f.cmd === CMD_NEWEST_HR && f.type === TYPE_REPLY && f.payload.length >= 7) {
    return { kind: 'newest', reading: { bpm: f.payload[6], at: leUint(f.payload.subarray(2, 6)) } }
  }
  return null
}

/** Readings outside these are noise or "no measurement" and are dropped. */
export const PLAUSIBLE: Record<'hr' | 'spo2', [number, number]> = { hr: [30, 230], spo2: [50, 100] }

export function plausible(kind: SampleKind, value: number): boolean {
  if (kind === 'stress') return value >= 0
  const [lo, hi] = PLAUSIBLE[kind]
  return value >= lo && value <= hi
}
