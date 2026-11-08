import type { WearableKind } from '../data/types'
import {
  CMD_HISTORY, FrameReassembler, HISTORY_UNIT, NEWEST_HR_QUERY, TYPE_REPLY, decodeFrame,
  decodeHrHistory, decodeSleepPoints, decodeSpo2History, decodeStressHistory,
  historyCountQuery, historyReadQuery, isHistoryData, newestStress, parseHistoryCount, plausible,
  type Frame, type NewestHr, type Sample,
} from './frames'

/** Data service of the Haylou Solar 5 and its three characteristics (see research_notes). */
export const DATA_SERVICE = '00006006-0000-1000-8000-00805f9b34fb'
export const WRITE_CHAR = '00008001-0000-1000-8000-00805f9b34fb'
export const REPLY_CHAR = '00008002-0000-1000-8000-00805f9b34fb'
export const EVENT_CHAR = '00008004-0000-1000-8000-00805f9b34fb'
/** How often the "newest heart rate" query is repeated while connected. */
export const POLL_MS = 10_000
/** The stored stress history is read once after connecting, for this many hours back. */
export const HISTORY_HOURS = 24
/** Waiting for the count reply, then for the first data frame, then between data frames. */
export const COUNT_WAIT_MS = 2_000
export const FIRST_FRAME_WAIT_MS = 3_000
export const QUIET_MS = 1_500

/*
 * Just the slice of Web Bluetooth this module uses; the DOM lib does not ship these types.
 *
 * Safety: requestDevice() lists only DATA_SERVICE in optionalServices, so the browser itself refuses any access to the
 * watch's other service (the Sifli serial channel used for firmware updates). The single thing ever written is
 * NEWEST_HR_QUERY and the stored-stress count and read queries (all read queries), to WRITE_CHAR. Nothing here sends a command that changes the watch.
 */
export interface BtCharacteristic {
  startNotifications(): Promise<unknown>
  stopNotifications(): Promise<unknown>
  writeValueWithoutResponse(value: BufferSource): Promise<void>
  addEventListener(type: 'characteristicvaluechanged', l: (e: { target: { value?: DataView | null } }) => void): void
  removeEventListener(type: 'characteristicvaluechanged', l: (e: { target: { value?: DataView | null } }) => void): void
}
export interface BtService { getCharacteristic(uuid: string): Promise<BtCharacteristic> }
export interface BtServer { connected: boolean; connect(): Promise<BtServer>; disconnect(): void; getPrimaryService(uuid: string): Promise<BtService> }
export interface BtDevice {
  name?: string
  gatt?: BtServer
  addEventListener(type: 'gattserverdisconnected', l: () => void): void
  removeEventListener(type: 'gattserverdisconnected', l: () => void): void
}
export interface BtApi {
  requestDevice(o: { filters: { namePrefix: string }[]; optionalServices: string[] }): Promise<BtDevice>
}

/** Why a connect failed, in a form the UI can show. `cancelled` is the user closing the picker or no watch showing up. */
export class WatchError extends Error {
  readonly code: 'unsupported' | 'cancelled' | 'failed'
  constructor(code: WatchError['code'], message: string) {
    super(message)
    this.name = 'WatchError'
    this.code = code
  }
}

export function bluetoothApi(): BtApi | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as unknown as { bluetooth?: BtApi }).bluetooth
}

/** True in Chrome and Edge (desktop and Android) over https or localhost; false in Safari, Firefox and on iPhone. */
export const watchSupported = (api: BtApi | undefined = bluetoothApi()) =>
  !!api && (typeof window === 'undefined' || window.isSecureContext !== false)

export function explain(e: unknown): WatchError {
  if (e instanceof WatchError) return e
  const name = e instanceof Error ? e.name : ''
  if (name === 'NotFoundError') return new WatchError('cancelled', 'No watch was chosen. Wake the watch, keep it close, and pick “HAYLOU” in the list.')
  if (name === 'SecurityError' || name === 'NotAllowedError') return new WatchError('failed', 'Bluetooth access was blocked. Allow Bluetooth for this site in the browser, and for the browser in your system settings.')
  if (name === 'NetworkError') return new WatchError('failed', 'Could not connect. Close the Haylou app on your phone or turn off its Bluetooth, then try again.')
  return new WatchError('failed', 'The watch could not be connected.')
}

export interface WatchHandlers {
  /** A live sample pushed by the watch (heart rate, SpO₂ or stress). */
  onSample: (s: Sample) => void
  /** The reply to a newest-heart-rate query. */
  onNewest: (r: NewestHr) => void
  /** The newest non-zero stress reading the watch has stored (not live), with the watch's own timestamp in unix seconds. */
  onStoredStress?: (r: { value: number; at: number }) => void
  /** Stored history points decoded from the watch (HR, SpO2, stress, sleep). */
  onHistoryPoints?: (kind: WearableKind, points: { t: number; value: number }[]) => void
  /** Optional callback to look up the last saved timestamp in unix seconds for incremental backfill. */
  getHistoryStart?: (kind: WearableKind) => Promise<number | null> | number | null
  /** The link dropped (watch out of range, switched off, or disconnect() was called). */
  onDisconnect: () => void
}

/** One Bluetooth link to a Haylou Solar 5. Create one per connect attempt. */
export class HaylouWatch {
  private readonly api: BtApi | undefined
  private readonly handlers: WatchHandlers
  private device: BtDevice | null = null
  private write: BtCharacteristic | null = null
  private notifiers: { ch: BtCharacteristic; l: (e: { target: { value?: DataView | null } }) => void }[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private closed = false
  private readonly historyQueue: { kind: WearableKind; unit: number }[] = [
    { kind: 'stress', unit: HISTORY_UNIT.stress },
    { kind: 'hr', unit: HISTORY_UNIT.hr },
    { kind: 'spo2', unit: HISTORY_UNIT.spo2 },
    { kind: 'sleep', unit: HISTORY_UNIT.sleep },
  ]
  private queueIndex = 0
  private history: {
    kind: WearableKind
    unit: number
    startS: number
    endS: number
    phase: 'count' | 'read' | 'done'
    expected: number | null
    frames: Uint8Array[]
    timer: ReturnType<typeof setTimeout> | null
  } | null = null
  private readonly onGone = () => this.teardown()

  constructor(handlers: WatchHandlers, api: BtApi | undefined = bluetoothApi()) {
    this.handlers = handlers
    this.api = api
  }

  /** `onPicked` fires when the user has chosen a device and the connection itself starts. Resolves with the device name. */
  async connect(onPicked?: () => void): Promise<string> {
    if (!this.api) throw new WatchError('unsupported', 'This browser cannot talk to Bluetooth devices. Use Chrome or Edge.')
    try {
      const device = await this.api.requestDevice({ filters: [{ namePrefix: 'HAYLOU' }], optionalServices: [DATA_SERVICE] })
      this.device = device
      onPicked?.()
      device.addEventListener('gattserverdisconnected', this.onGone)
      const server = await device.gatt!.connect()
      const service = await server.getPrimaryService(DATA_SERVICE)
      const [write, reply, event] = await Promise.all([WRITE_CHAR, REPLY_CHAR, EVENT_CHAR].map((u) => service.getCharacteristic(u)))
      this.write = write
      await this.listen(reply)
      await this.listen(event)
      if (this.closed) throw new WatchError('failed', 'The watch disconnected while connecting.')
      void this.query()
      this.startHistory()
      this.timer = setInterval(() => void this.query(), POLL_MS)
      return device.name || 'HAYLOU watch'
    } catch (e) {
      this.teardown(false)
      throw explain(e)
    }
  }

  disconnect() { this.teardown() }

  private async listen(ch: BtCharacteristic) {
    const frames = new FrameReassembler()
    const l = (e: { target: { value?: DataView | null } }) => {
      const dv = e.target.value
      if (!dv) return
      for (const f of frames.push(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength))) {
        if (f.cmd === CMD_HISTORY && f.type === TYPE_REPLY) { this.onHistory(f); continue }
        const m = decodeFrame(f)
        if (!m) continue
        if (m.kind === 'newest') { if (plausible('hr', m.reading.bpm)) this.handlers.onNewest(m.reading) }
        else for (const s of m.samples) if (plausible(s.kind, s.value)) this.handlers.onSample(s)
      }
    }
    ch.addEventListener('characteristicvaluechanged', l)
    this.notifiers.push({ ch, l })
    await ch.startNotifications()
  }

  /** The one request this class ever writes. */
  private async query() {
    try { await this.write?.writeValueWithoutResponse(NEWEST_HR_QUERY as BufferSource) } catch { /* link gone or busy: the next poll retries */ }
  }

  private async send(frame: Uint8Array) {
    try { await this.write?.writeValueWithoutResponse(frame as BufferSource) } catch { /* link gone or busy */ }
  }

  /** Read-only: ask how many reply frames history has, then ask for data since last saved time. */
  private startHistory() {
    this.queueIndex = 0
    void this.runHistoryQueue()
  }
  private windowEnd() { return Math.floor(Date.now() / 1000) }

  private async runHistoryQueue() {
    if (this.closed || this.queueIndex >= this.historyQueue.length) {
      this.history = null
      return
    }
    const item = this.historyQueue[this.queueIndex]
    const endS = this.windowEnd()
    let startS = endS - HISTORY_HOURS * 3600
    if (this.handlers.getHistoryStart) {
      try {
        const custom = await this.handlers.getHistoryStart(item.kind)
        if (custom !== null && custom > 0) startS = custom
      } catch {
        /* fallback to default */
      }
    }
    if (this.closed) return
    const h = {
      kind: item.kind,
      unit: item.unit,
      startS,
      endS,
      phase: 'count' as const,
      expected: null as number | null,
      frames: [] as Uint8Array[],
      timer: null as ReturnType<typeof setTimeout> | null,
    }
    this.history = h
    h.timer = setTimeout(() => this.startRead(), COUNT_WAIT_MS)
    void this.send(historyCountQuery(item.unit, startS, endS))
  }

  private startRead() {
    const h = this.history
    if (!h || h.phase === 'done') return
    if (h.timer) clearTimeout(h.timer)
    if (h.expected === 0) return this.finishCurrentUnit()
    h.phase = 'read'
    h.timer = setTimeout(() => this.finishCurrentUnit(), FIRST_FRAME_WAIT_MS)
    void this.send(historyReadQuery(h.unit, h.startS, h.endS))
  }

  private onHistory(f: Frame) {
    const h = this.history
    if (!h || h.phase === 'done') return
    if (h.phase === 'count') {
      if (isHistoryData(f.payload)) return   // a stray data frame before we asked: ignore
      h.expected = parseHistoryCount(f.payload, h.unit)
      this.startRead()
      return
    }
    if (f.payload.length === 0) return this.finishCurrentUnit()   // the watch's "nothing stored" frame
    if (!isHistoryData(f.payload)) return
    h.frames.push(f.payload)
    if (h.expected !== null && h.frames.length >= h.expected) return this.finishCurrentUnit()
    if (h.timer) clearTimeout(h.timer)
    h.timer = setTimeout(() => this.finishCurrentUnit(), QUIET_MS)
  }

  private finishCurrentUnit() {
    const h = this.history
    if (!h || h.phase === 'done') return
    h.phase = 'done'
    if (h.timer) { clearTimeout(h.timer); h.timer = null }

    if (h.kind === 'stress') {
      const best = newestStress(h.frames)
      if (best && plausible('stress', best.value)) this.handlers.onStoredStress?.(best)
      const pts = h.frames.flatMap((f) => decodeStressHistory(f))
      const valid = pts.filter((p) => plausible('stress', p.stress)).map((p) => ({ t: p.t, value: p.stress }))
      if (valid.length > 0) this.handlers.onHistoryPoints?.('stress', valid)
    } else if (h.kind === 'hr') {
      const pts = h.frames.flatMap((f) => decodeHrHistory(f))
      const valid = pts.filter((p) => plausible('hr', p.hr)).map((p) => ({ t: p.t, value: p.hr }))
      if (valid.length > 0) this.handlers.onHistoryPoints?.('hr', valid)
    } else if (h.kind === 'spo2') {
      const pts = h.frames.flatMap((f) => decodeSpo2History(f))
      const valid = pts.filter((p) => plausible('spo2', p.spo2)).map((p) => ({ t: p.t, value: p.spo2 }))
      if (valid.length > 0) this.handlers.onHistoryPoints?.('spo2', valid)
    } else if (h.kind === 'sleep') {
      const pts = h.frames.flatMap((f) => decodeSleepPoints(f))
      const valid = pts.map((p) => ({ t: p.t, value: p.state }))
      if (valid.length > 0) this.handlers.onHistoryPoints?.('sleep', valid)
    }

    this.queueIndex++
    void this.runHistoryQueue()
  }

  private teardown(notify = true) {
    if (this.history?.timer) clearTimeout(this.history.timer)
    this.history = null
    this.queueIndex = this.historyQueue.length
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    const wasOpen = !this.closed
    this.closed = true
    for (const { ch, l } of this.notifiers) { ch.removeEventListener('characteristicvaluechanged', l); ch.stopNotifications().catch(() => {}) }
    this.notifiers = []
    this.write = null
    this.device?.removeEventListener('gattserverdisconnected', this.onGone)
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.device = null
    if (notify && wasOpen) this.handlers.onDisconnect()
  }
}
