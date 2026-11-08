import { FrameReassembler, NEWEST_HR_QUERY, decodeFrame, plausible, type NewestHr, type Sample } from './frames'

/** Data service of the Haylou Solar 5 and its three characteristics (see research_notes). */
export const DATA_SERVICE = '00006006-0000-1000-8000-00805f9b34fb'
export const WRITE_CHAR = '00008001-0000-1000-8000-00805f9b34fb'
export const REPLY_CHAR = '00008002-0000-1000-8000-00805f9b34fb'
export const EVENT_CHAR = '00008004-0000-1000-8000-00805f9b34fb'
/** How often the "newest heart rate" query is repeated while connected. */
export const POLL_MS = 10_000

/*
 * Just the slice of Web Bluetooth this module uses; the DOM lib does not ship these types.
 *
 * Safety: requestDevice() lists only DATA_SERVICE in optionalServices, so the browser itself refuses any access to the
 * watch's other service (the Sifli serial channel used for firmware updates). The single thing ever written is
 * NEWEST_HR_QUERY, a read query, to WRITE_CHAR. Nothing here sends a command that changes the watch.
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

  private teardown(notify = true) {
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
