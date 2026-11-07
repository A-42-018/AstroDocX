import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DATA_SERVICE, EVENT_CHAR, HaylouWatch, POLL_MS, REPLY_CHAR, WRITE_CHAR, WatchError, explain, type BtApi, type BtCharacteristic, type BtDevice, type WatchHandlers } from './haylouWatch'

type Listener = (e: { target: { value?: DataView | null } }) => void
const dv = (...b: number[]) => new DataView(Uint8Array.from(b).buffer)

class FakeChar implements BtCharacteristic {
  listeners = new Set<Listener>()
  writes: number[][] = []
  started = false
  startNotifications = vi.fn(async () => { this.started = true })
  stopNotifications = vi.fn(async () => { this.started = false })
  writeValueWithoutResponse = vi.fn(async (v: BufferSource) => { this.writes.push([...new Uint8Array(v as Uint8Array)]) })
  addEventListener(_t: 'characteristicvaluechanged', l: Listener) { this.listeners.add(l) }
  removeEventListener(_t: 'characteristicvaluechanged', l: Listener) { this.listeners.delete(l) }
  emit(v: DataView) { this.listeners.forEach((l) => l({ target: { value: v } })) }
}

function rig(opts: { requestError?: Error } = {}) {
  const chars: Record<string, FakeChar> = { [WRITE_CHAR]: new FakeChar(), [REPLY_CHAR]: new FakeChar(), [EVENT_CHAR]: new FakeChar() }
  const asked: string[] = []
  let onGone: (() => void) | null = null
  const server = {
    connected: true,
    connect: async () => server,
    disconnect: vi.fn(() => { server.connected = false; onGone?.() }),
    getPrimaryService: async (uuid: string) => {
      asked.push(uuid)
      if (uuid !== DATA_SERVICE) throw new DOMException('not allowed', 'SecurityError')
      return { getCharacteristic: async (c: string) => chars[c] }
    },
  }
  const device: BtDevice = {
    name: 'HAYLOU Solar 5', gatt: server,
    addEventListener: (_t, l) => { onGone = l },
    removeEventListener: () => { onGone = null },
  }
  const requestDevice = vi.fn(async (_o: Parameters<BtApi['requestDevice']>[0]) => { if (opts.requestError) throw opts.requestError; return device })
  const api: BtApi = { requestDevice }
  const handlers = { onSample: vi.fn(), onNewest: vi.fn(), onDisconnect: vi.fn() } satisfies WatchHandlers
  return { chars, asked, server, requestDevice, api, handlers, watch: new HaylouWatch(handlers, api) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('HaylouWatch', () => {
  it('only asks the browser for the data service, so the firmware-update service is out of reach', async () => {
    const r = rig()
    await r.watch.connect()
    expect(r.requestDevice).toHaveBeenCalledWith({ filters: [{ namePrefix: 'HAYLOU' }], optionalServices: [DATA_SERVICE] })
    expect(r.asked).toEqual([DATA_SERVICE])
  })

  it('subscribes to replies and events, and resolves with the device name', async () => {
    const r = rig()
    await expect(r.watch.connect()).resolves.toBe('HAYLOU Solar 5')
    expect(r.chars[REPLY_CHAR].started).toBe(true)
    expect(r.chars[EVENT_CHAR].started).toBe(true)
    expect(r.chars[WRITE_CHAR].started).toBe(false)
  })

  it('writes only the read-only newest-heart-rate query to 8001: once now, then every 10 s', async () => {
    const r = rig()
    await r.watch.connect()
    const query = [0x6f, 0x62, 0x70, 0x01, 0x00, 0x01, 0x8f]
    expect(r.chars[WRITE_CHAR].writes).toEqual([query])
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(r.chars[WRITE_CHAR].writes).toEqual([query, query, query, query])
    expect(r.chars[REPLY_CHAR].writeValueWithoutResponse).not.toHaveBeenCalled()
    expect(r.chars[EVENT_CHAR].writeValueWithoutResponse).not.toHaveBeenCalled()
  })

  it('passes decoded events and replies to the handlers, including a frame split over two notifications', async () => {
    const r = rig()
    await r.watch.connect()
    r.chars[EVENT_CHAR].emit(dv(0x6f, 0xe0, 0x71, 0x03, 0x00, 0x01, 0x01, 0x45, 0x8f))
    expect(r.handlers.onSample).toHaveBeenLastCalledWith({ kind: 'hr', value: 69 })
    r.chars[REPLY_CHAR].emit(dv(0x6f, 0x62, 0x80, 0x07, 0x00, 0x01, 0x05, 0xf3))
    expect(r.handlers.onNewest).not.toHaveBeenCalled()
    r.chars[REPLY_CHAR].emit(dv(0xfd, 0xee, 0x6a, 0x57, 0x8f))
    expect(r.handlers.onNewest).toHaveBeenCalledWith({ bpm: 87, at: 1794047475 })
  })

  it('drops readings no body produces', async () => {
    const r = rig()
    await r.watch.connect()
    r.chars[EVENT_CHAR].emit(dv(0x6f, 0xe0, 0x71, 0x03, 0x00, 0x01, 0x01, 0x00, 0x8f))   // 0 bpm
    r.chars[EVENT_CHAR].emit(dv(0x6f, 0xe0, 0x71, 0x03, 0x00, 0x03, 0x01, 0xff, 0x8f))   // 255 % SpO2
    expect(r.handlers.onSample).not.toHaveBeenCalled()
  })

  it('stops polling and listening on disconnect, and tells the caller once', async () => {
    const r = rig()
    await r.watch.connect()
    r.watch.disconnect()
    expect(r.handlers.onDisconnect).toHaveBeenCalledTimes(1)
    expect(r.server.disconnect).toHaveBeenCalled()
    const before = r.chars[WRITE_CHAR].writes.length
    await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    expect(r.chars[WRITE_CHAR].writes.length).toBe(before)
    expect(r.chars[EVENT_CHAR].listeners.size).toBe(0)
    r.watch.disconnect()
    expect(r.handlers.onDisconnect).toHaveBeenCalledTimes(1)
  })

  it('reports a dropped link', async () => {
    const r = rig()
    await r.watch.connect()
    r.server.disconnect()
    expect(r.handlers.onDisconnect).toHaveBeenCalledTimes(1)
  })

  it('says "cancelled" when the picker is closed, and does not poll', async () => {
    const r = rig({ requestError: new DOMException('closed', 'NotFoundError') })
    await expect(r.watch.connect()).rejects.toMatchObject({ code: 'cancelled' })
    expect(r.chars[WRITE_CHAR].writes).toEqual([])
  })

  it('refuses without Web Bluetooth', async () => {
    const w = new HaylouWatch({ onSample() {}, onNewest() {}, onDisconnect() {} }, undefined)
    await expect(w.connect()).rejects.toMatchObject({ code: 'unsupported' })
  })
})

describe('explain', () => {
  it('turns browser errors into plain advice', () => {
    expect(explain(new DOMException('', 'NetworkError')).message).toMatch(/Haylou app/)
    expect(explain(new DOMException('', 'SecurityError')).message).toMatch(/blocked/)
    expect(explain(new Error('boom'))).toBeInstanceOf(WatchError)
  })
})
