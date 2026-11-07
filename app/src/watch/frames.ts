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
    // Unit 17 is SpO2 with a timestamp: `[percent][unix seconds, 4 bytes LE]` (DataManager.java case 17). Synthetic until seen live.
    if (type === 17 && len === 5) out.push({ kind: 'spo2', value: payload[i + 2] })
    else if (kind) out.push({ kind, value: leUint(payload.subarray(i + 2, i + 2 + len)) })
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

/* ---- Stored history (read-only queries, cmd 0xBE) -------------------------------------------------------------
 * Same request shape as the heart-rate history that was confirmed on a real watch; the stress and sleep variants come
 * from GetStressNumForLS / GetStressForLS / GetSleepNumForLS / GetSleepPointsForLS in the Haylou Fun app. Their frames
 * and key numbers (stress 10, sleep stage 13) are NOT yet seen on a real watch: the tests below use synthetic bytes.
 * The app does not send these queries yet; the probe page does.
 */
export const CMD_HISTORY = 0xbe
/** History "unit" numbers used in both the count and the read query. */
export const HISTORY_UNIT = { sleep: 3, hr: 4, stress: 5, spo2: 6 } as const
/** Key numbers inside a history reply: 0, 1, 2 carry the timestamp; the rest carry the reading. */
export const HISTORY_KEY = { hr: 7, stress: 10, spo2: 11, sleepStage: 13 } as const

const le4 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

/** "How many points are stored between these two unix-second times?" Read-only. */
export function historyCountQuery(unit: number, startS: number, endS: number): Uint8Array {
  return Uint8Array.from([0x6f, CMD_HISTORY, 0x70, 0x0b, 0x00, 0x00, unit, 0x08, ...le4(startS), ...le4(endS), 0x8f])
}
/** "Send me the stored points between these two times." Read-only. */
export function historyReadQuery(unit: number, startS: number, endS: number): Uint8Array {
  return Uint8Array.from([0x6f, CMD_HISTORY, 0x70, 0x0b, 0x00, unit, unit, 0x08, ...le4(startS), ...le4(endS), 0x8f])
}

/** Reads one LEB128 varint (little-endian base 128) and returns it with the next index. */
function varint(b: Uint8Array, i: number): [number, number] {
  let v = 0, shift = 0
  while (i < b.length) { const x = b[i++]; v += (x & 0x7f) * 2 ** shift; if (x < 0x80) break; shift += 7 }
  return [v, i]
}

/** One stored point: unix seconds `t` plus whatever readings came with it, keyed by key number. */
export interface HistoryPoint { t: number; keys: Record<number, number> }

/** A history reply is a run of (key, value) varint pairs: key 0 absolute time (the anchor), 1 = anchor + value, 2 = anchor - value. Deltas are measured from the last key-0 time, not from the previous point (same as GetHeartratesForLS.makePoints). */
export function decodeHistoryPoints(payload: Uint8Array): HistoryPoint[] {
  const pts: HistoryPoint[] = []
  let anchor = 0, cur: HistoryPoint | null = null, key = 0, isKey = true
  for (let i = 0; i < payload.length;) {
    const [v, n] = varint(payload, i); i = n
    if (isKey) key = v
    else if (key === 0) { anchor = v; cur = { t: v, keys: {} }; pts.push(cur) }
    else if (key === 1) { cur = { t: anchor + v, keys: {} }; pts.push(cur) }
    else if (key === 2) { cur = { t: anchor - v, keys: {} }; pts.push(cur) }
    else if (cur) cur.keys[key] = v
    isKey = !isKey
  }
  return pts
}

/** Stored stress readings (key 10). The app ignores a stress of 0 (no measurement). */
export function decodeStressHistory(payload: Uint8Array): { t: number; stress: number }[] {
  return decodeHistoryPoints(payload)
    .filter((p) => p.keys[HISTORY_KEY.stress] > 0)
    .map((p) => ({ t: p.t, stress: p.keys[HISTORY_KEY.stress] }))
}

/** Sleep point states (SleepPointState.java). A point's state holds from its time until the next point. */
export const SLEEP_STATE = { deep: 0, light: 1, awake: 2, pre: 3, rem: 5, enter: 16, exit: 17 } as const
export interface SleepPoint { t: number; state: number }

export function decodeSleepPoints(payload: Uint8Array): SleepPoint[] {
  return decodeHistoryPoints(payload)
    .filter((p) => p.keys[HISTORY_KEY.sleepStage] !== undefined)
    .map((p) => ({ t: p.t, state: p.keys[HISTORY_KEY.sleepStage] }))
}

/** One night (or nap) from an Enter point to an Exit point. Durations in seconds. */
export interface SleepSession {
  start: number; end: number
  deep: number; light: number; rem: number; awake: number
  /** Time actually asleep: deep + light + REM (what the Haylou app calls "available sleep"). */
  asleep: number
  /** Under two hours the Haylou app files it as a nap. */
  nap: boolean
}

/** Port of Sleep.addUp: time between two points is credited to the earlier point's state; Enter opens, Exit closes. */
export function summarizeSleep(points: SleepPoint[]): SleepSession[] {
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const out: SleepSession[] = []
  let cur: SleepSession | null = null
  let state: number = SLEEP_STATE.awake, prev = 0
  for (const p of sorted) {
    if (p.state === SLEEP_STATE.enter) {
      cur = { start: p.t, end: p.t, deep: 0, light: 0, rem: 0, awake: 0, asleep: 0, nap: false }
      state = SLEEP_STATE.awake
    } else if (cur) {
      const dt = Math.max(0, p.t - prev)
      if (state === SLEEP_STATE.deep) cur.deep += dt
      else if (state === SLEEP_STATE.light) cur.light += dt
      else if (state === SLEEP_STATE.awake) cur.awake += dt
      else if (state === SLEEP_STATE.rem) cur.rem += dt
      state = p.state
      if (p.state === SLEEP_STATE.exit) {
        cur.end = p.t
        if (cur.end > cur.start) {
          cur.asleep = cur.deep + cur.light + cur.rem
          cur.nap = cur.end - cur.start < 7200
          out.push(cur)
        }
        cur = null
      }
    }
    prev = p.t
  }
  return out
}

/** A count reply carries `[unit][len][count LE]`. The count is the number of reply FRAMES that will follow, not of points (confirmed on the watch). */
export function parseHistoryCount(payload: Uint8Array, unit: number): number | null {
  for (let i = 0; i + 2 <= payload.length;) {
    const t = payload[i], len = payload[i + 1]
    if (i + 2 + len > payload.length) return null
    if (t === unit && len > 0) return leUint(payload.subarray(i + 2, i + 2 + len))
    i += 2 + len
  }
  return null
}

/** A history data frame always opens with key 0 (the anchor time); a count reply opens with its unit number (never 0). */
export const isHistoryData = (payload: Uint8Array) => payload.length > 0 && payload[0] === 0

/** The newest non-zero stress reading across several history frames, or null. `t` is unix seconds on the watch's clock. */
export function newestStress(payloads: Uint8Array[]): { value: number; at: number } | null {
  let best: { value: number; at: number } | null = null
  for (const p of payloads) for (const r of decodeStressHistory(p)) if (!best || r.t > best.at) best = { value: r.stress, at: r.t }
  return best
}
