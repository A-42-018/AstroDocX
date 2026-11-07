import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WatchHandlers } from './haylouWatch'
import { TTL_MS, createWatchStore } from './store'

const NOW = Date.UTC(2026, 10, 7, 10, 31, 20)

function rig(supported = true) {
  let handlers!: WatchHandlers
  const link = { connect: vi.fn(async (picked?: () => void) => { picked?.(); return 'HAYLOU Solar 5' }), disconnect: vi.fn() }
  let clock = NOW
  const store = createWatchStore({ makeLink: (h) => { handlers = h; return link }, now: () => clock, supported: () => supported })
  return { store, link, h: () => handlers, advance: (ms: number) => { clock += ms; vi.advanceTimersByTime(ms) } }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('watch store', () => {
  it('starts unsupported where there is no Web Bluetooth, and connect does nothing', async () => {
    const r = rig(false)
    expect(r.store.getState().status).toBe('unsupported')
    await r.store.getState().connect()
    expect(r.link.connect).not.toHaveBeenCalled()
  })

  it('goes idle → picking → connecting → connected', async () => {
    const r = rig()
    const seen: string[] = [r.store.getState().status]
    r.store.subscribe((s) => { if (seen.at(-1) !== s.status) seen.push(s.status) })
    await r.store.getState().connect()
    expect(seen).toEqual(['idle', 'picking', 'connecting', 'connected'])
    expect(r.store.getState().name).toBe('HAYLOU Solar 5')
  })

  it('shows a pushed heart rate, then lets it go stale when the watch stops sending', async () => {
    const r = rig()
    await r.store.getState().connect()
    r.h().onSample({ kind: 'hr', value: 69 })
    expect(r.store.getState().hr).toBe(69)
    r.advance(TTL_MS.hr - 1000)
    expect(r.store.getState().hr).toBe(69)
    r.advance(3000)
    expect(r.store.getState().hr).toBeNull()
  })

  it('keeps SpO2 longer than heart rate, since it arrives less often', async () => {
    const r = rig()
    await r.store.getState().connect()
    r.h().onSample({ kind: 'hr', value: 70 }); r.h().onSample({ kind: 'spo2', value: 97 })
    r.advance(TTL_MS.hr + 2000)
    expect(r.store.getState().hr).toBeNull()
    expect(r.store.getState().spo2).toBe(97)
  })

  it('treats a polled reading stamped just now as live, and an old stored one as history only', async () => {
    const r = rig()
    await r.store.getState().connect()
    r.h().onNewest({ bpm: 87, at: NOW / 1000 - 2 })
    expect(r.store.getState().hr).toBe(87)
    r.store.getState().disconnect()
    await r.store.getState().connect()
    r.h().onNewest({ bpm: 71, at: NOW / 1000 - 600 })   // ten minutes old
    expect(r.store.getState().hr).toBeNull()
    expect(r.store.getState().newest).toEqual({ bpm: 71, at: NOW / 1000 - 600 })
  })

  it('clears everything on disconnect and closes the link', async () => {
    const r = rig()
    await r.store.getState().connect()
    r.h().onSample({ kind: 'hr', value: 69 })
    r.store.getState().disconnect()
    expect(r.link.disconnect).toHaveBeenCalledTimes(1)
    expect(r.store.getState()).toMatchObject({ status: 'idle', name: '', hr: null, spo2: null, newest: null })
  })

  it('returns to idle with a note when the watch drops, and can connect again', async () => {
    const r = rig()
    await r.store.getState().connect()
    r.h().onSample({ kind: 'hr', value: 69 })
    r.h().onDisconnect()
    expect(r.store.getState()).toMatchObject({ status: 'idle', hr: null })
    expect(r.store.getState().note).toMatch(/disconnected/)
    await r.store.getState().connect()
    expect(r.store.getState().status).toBe('connected')
    expect(r.store.getState().note).toBe('')
  })

  it('returns to idle with the reason when connecting fails', async () => {
    const r = rig()
    r.link.connect.mockRejectedValueOnce(new Error('No watch was chosen.'))
    await r.store.getState().connect()
    expect(r.store.getState()).toMatchObject({ status: 'idle', note: 'No watch was chosen.' })
  })

  it('ignores a second connect while one is under way', async () => {
    const r = rig()
    const a = r.store.getState().connect()
    await r.store.getState().connect()
    await a
    expect(r.link.connect).toHaveBeenCalledTimes(1)
  })
})
