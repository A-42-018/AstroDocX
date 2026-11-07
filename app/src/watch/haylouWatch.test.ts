import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COUNT_WAIT_MS, DATA_SERVICE, EVENT_CHAR, FIRST_FRAME_WAIT_MS, HaylouWatch, POLL_MS, QUIET_MS, REPLY_CHAR, WRITE_CHAR, WatchError, explain, type BtApi, type BtCharacteristic, type BtDevice, type WatchHandlers } from './haylouWatch'

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
  const handlers: WatchHandlers = { onSample: vi.fn(), onNewest: vi.fn(), onDisconnect: vi.fn() }
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

  it('writes only read queries to 8001: newest heart rate once now and every 10 s, plus the stress history count and read', async () => {
    const r = rig()
    await r.watch.connect()
    const query = [0x6f, 0x62, 0x70, 0x01, 0x00, 0x01, 0x8f]
    const hr = () => r.chars[WRITE_CHAR].writes.filter((w) => w[1] === 0x62)
    expect(hr()).toEqual([query])
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(hr()).toEqual([query, query, query, query])
    // Everything written is a type-0x70 read request: the HR query or a 0xBE history query for the units (3, 4, 5, 6), nothing else.
    for (const w of r.chars[WRITE_CHAR].writes) {
      expect(w[2]).toBe(0x70)
      expect([0x62, 0xbe]).toContain(w[1])
      if (w[1] === 0xbe) expect([3, 4, 5, 6]).toContain(w[6])
    }
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

const REAL_STRESS = [0x6f, 0xbe, 0x80, 0x35, 0x00, 0x00, 0xbd, 0x94, 0xbc, 0xd7, 0x06, 0x0a, 0x00, 0x01, 0x01, 0x0a, 0x00, 0x01, 0x02, 0x0a, 0x00, 0x01, 0x03, 0x0a, 0x00, 0x01, 0x04, 0x0a, 0x00, 0x01, 0x04, 0x0a, 0x00, 0x01, 0x05, 0x0a, 0x00, 0x01, 0x06, 0x0a, 0x00, 0x01, 0x07, 0x0a, 0x00, 0x01, 0x08, 0x0a, 0x00, 0x01, 0x08, 0x0a, 0x00, 0x01, 0x96, 0x04, 0x0a, 0x22, 0x8f]
const ZEROS = [0x6f, 0xbe, 0x80, 0x0c, 0x00, 0x00, 0xbd, 0x94, 0xbc, 0xd7, 0x06, 0x0a, 0x00, 0x01, 0x01, 0x0a, 0x00, 0x8f]
const countReply = (n: number) => [0x6f, 0xbe, 0x80, 0x04, 0x00, 0x05, 0x02, n, 0x00, 0x8f]
const stressWrites = (r: ReturnType<typeof rig>) => r.chars[WRITE_CHAR].writes.filter((w) => w[1] === 0xbe && w[6] === 5)
const emit = (r: ReturnType<typeof rig>, b: number[]) => r.chars[REPLY_CHAR].emit(dv(...b))

describe('stored stress history', () => {
  it('sends the count, then the read, and reports the newest non-zero stress once all counted frames are in', async () => {
    const r = rig()
    const onStored = vi.fn()
    r.handlers.onStoredStress = onStored
    await r.watch.connect()
    expect(stressWrites(r)).toHaveLength(1)
    expect(stressWrites(r)[0].slice(0, 8)).toEqual([0x6f, 0xbe, 0x70, 0x0b, 0x00, 0x00, 0x05, 0x08])   // count, unit 5
    emit(r, countReply(2))
    await vi.advanceTimersByTimeAsync(0)
    expect(stressWrites(r)).toHaveLength(2)
    expect(stressWrites(r)[1].slice(0, 8)).toEqual([0x6f, 0xbe, 0x70, 0x0b, 0x00, 0x05, 0x05, 0x08])   // read, unit 5
    emit(r, ZEROS)
    expect(onStored).not.toHaveBeenCalled()
    emit(r, REAL_STRESS)
    expect(onStored).toHaveBeenCalledTimes(1)
    expect(onStored).toHaveBeenCalledWith({ value: 34, at: Date.UTC(2026, 10, 7, 11, 32, 35) / 1000 })
  })

  it('stops waiting after a quiet gap when fewer frames come than counted', async () => {
    const r = rig()
    const onStored = vi.fn()
    r.handlers.onStoredStress = onStored
    await r.watch.connect()
    emit(r, countReply(5))
    emit(r, REAL_STRESS)
    expect(onStored).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(QUIET_MS + 10)
    expect(onStored).toHaveBeenCalledWith(expect.objectContaining({ value: 34 }))
  })

  it('reads anyway when the count reply never comes, and stays silent when nothing is stored', async () => {
    const r = rig()
    const onStored = vi.fn()
    r.handlers.onStoredStress = onStored
    await r.watch.connect()
    await vi.advanceTimersByTimeAsync(COUNT_WAIT_MS + 10)
    expect(stressWrites(r)).toHaveLength(2)
    emit(r, [0x6f, 0xbe, 0x80, 0x00, 0x00, 0x8f])   // the watch's empty "nothing stored" frame
    await vi.advanceTimersByTimeAsync(FIRST_FRAME_WAIT_MS + 10)
    expect(onStored).not.toHaveBeenCalled()
  })

  it('does not read when the count is zero', async () => {
    const r = rig()
    await r.watch.connect()
    emit(r, countReply(0))
    await vi.advanceTimersByTimeAsync(10)
    expect(stressWrites(r)).toHaveLength(1)
  })

  it('cancels the history wait on disconnect', async () => {
    const r = rig()
    const onStored = vi.fn()
    r.handlers.onStoredStress = onStored
    await r.watch.connect()
    emit(r, countReply(1))
    r.watch.disconnect()
    emit(r, REAL_STRESS)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onStored).not.toHaveBeenCalled()
  })

  it('calls onHistoryPoints for decoded history points across units', async () => {
    const r = rig()
    const onHistory = vi.fn()
    r.handlers.onHistoryPoints = onHistory
    await r.watch.connect()
    emit(r, countReply(1))
    emit(r, REAL_STRESS)
    expect(onHistory).toHaveBeenCalledWith('stress', [{ t: Date.UTC(2026, 10, 7, 11, 32, 35) / 1000, value: 34 }])
  })
})

describe('explain', () => {
  it('turns browser errors into plain advice', () => {
    expect(explain(new DOMException('', 'NetworkError')).message).toMatch(/Haylou app/)
    expect(explain(new DOMException('', 'SecurityError')).message).toMatch(/blocked/)
    expect(explain(new Error('boom'))).toBeInstanceOf(WatchError)
  })
})
