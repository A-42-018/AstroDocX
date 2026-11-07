import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleDB, resetDb } from '../data/db'
import type { WatchHandlers } from './haylouWatch'
import { TTL_MS, createWatchStore } from './store'

const NOW = Date.UTC(2026, 10, 7, 10, 31, 20)

function rig(supported = true, testDb?: ConsoleDB) {
  let handlers!: WatchHandlers
  const link = { connect: vi.fn(async (picked?: () => void) => { picked?.(); return 'HAYLOU Solar 5' }), disconnect: vi.fn() }
  let clock = NOW
  const store = createWatchStore({ makeLink: (h) => { handlers = h; return link }, now: () => clock, supported: () => supported, db: testDb })
  return { store, link, h: () => handlers, advance: (ms: number) => { clock += ms; vi.advanceTimersByTime(ms) } }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('watch store', () => {
  it('keeps the stored stress as a past reading: not live, no expiry, cleared on disconnect', async () => {
    const r = rig()
    await r.store.getState().connect()
    r.h().onStoredStress!({ value: 34, at: 1_794_000_000 })
    expect(r.store.getState().storedStress).toEqual({ value: 34, at: 1_794_000_000 })
    expect(r.store.getState().stress).toBeNull()
    r.advance(10 * 60_000)
    expect(r.store.getState().storedStress).not.toBeNull()
    r.store.getState().disconnect()
    expect(r.store.getState().storedStress).toBeNull()
  })

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

  it('throttles live sample saving to one per minute per kind when opt-in is enabled', async () => {
    vi.useRealTimers()
    try {
      const testDb = new ConsoleDB('test-store-throttling')
      await resetDb(testDb)
      let clock = NOW
      let handlers!: WatchHandlers
      const link = { connect: vi.fn(async (picked?: () => void) => { picked?.(); return 'HAYLOU Solar 5' }), disconnect: vi.fn() }
      const store = createWatchStore({
        makeLink: (h) => { handlers = h; return link },
        now: () => clock,
        supported: () => true,
        db: testDb,
      })
      store.getState().setSaveOptIn(true)
      await store.getState().connect()

      // First sample at t = NOW should be saved
      handlers.onSample({ kind: 'hr', value: 72 })
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(1)

      // Samples within 60s should be throttled
      clock += 10_000
      handlers.onSample({ kind: 'hr', value: 74 })
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(1)

      // A sample after 60s should be saved
      clock += 55_000 // now at t + 65s
      handlers.onSample({ kind: 'hr', value: 76 })
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(2)

      // SpO2 is a different kind, so it gets saved immediately
      handlers.onSample({ kind: 'spo2', value: 98 })
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(3)
    } finally {
      vi.useFakeTimers()
    }
  })

  it('saves backfilled history points deduplicated when opt-in is enabled', async () => {
    vi.useRealTimers()
    try {
      const testDb = new ConsoleDB('test-store-backfill')
      await resetDb(testDb)
      let clock = NOW
      let handlers!: WatchHandlers
      const link = { connect: vi.fn(async (picked?: () => void) => { picked?.(); return 'HAYLOU Solar 5' }), disconnect: vi.fn() }
      const store = createWatchStore({
        makeLink: (h) => { handlers = h; return link },
        now: () => clock,
        supported: () => true,
        db: testDb,
      })
      store.getState().setSaveOptIn(true)
      await store.getState().connect()

      const t = 1_794_000_000
      handlers.onHistoryPoints?.('hr', [{ t, value: 70 }, { t: t + 300, value: 72 }])
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(2)

      // Repeating the points deduplicates
      handlers.onHistoryPoints?.('hr', [{ t, value: 70 }, { t: t + 300, value: 72 }])
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(2)
    } finally {
      vi.useFakeTimers()
    }
  })

  it('keeps the HR backfill cursor on stored rows when a live HR row was saved first', async () => {
    vi.useRealTimers()
    try {
      const testDb = new ConsoleDB('test-store-cursor')
      await resetDb(testDb)
      const clock = NOW
      let handlers!: WatchHandlers
      const link = { connect: vi.fn(async (picked?: () => void) => { picked?.(); return 'HAYLOU Solar 5' }), disconnect: vi.fn() }
      const store = createWatchStore({
        makeLink: (h) => { handlers = h; return link },
        now: () => clock,
        supported: () => true,
        db: testDb,
      })
      store.getState().setSaveOptIn(true)
      await store.getState().connect()

      // first connect: nothing stored yet, a live HR streams in before the HR history unit runs
      handlers.onSample({ kind: 'hr', value: 72 })
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(1)
      // the history reader must still fall back to its default window, not start at the live row
      expect(await handlers.getHistoryStart!('hr')).toBeNull()

      // once stored history exists, the cursor is the newest stored point, not the newer live row
      const t = Math.floor(NOW / 1000) - 3600
      handlers.onHistoryPoints!('hr', [{ t, value: 66 }])
      await new Promise((r) => setTimeout(r, 20))
      expect(await handlers.getHistoryStart!('hr')).toBe(t)
    } finally {
      vi.useFakeTimers()
    }
  })

  it('does not save data when opt-in is disabled', async () => {
    vi.useRealTimers()
    try {
      const testDb = new ConsoleDB('test-store-optout')
      await resetDb(testDb)
      let clock = NOW
      let handlers!: WatchHandlers
      const link = { connect: vi.fn(async (picked?: () => void) => { picked?.(); return 'HAYLOU Solar 5' }), disconnect: vi.fn() }
      const store = createWatchStore({
        makeLink: (h) => { handlers = h; return link },
        now: () => clock,
        supported: () => true,
        db: testDb,
      })
      store.getState().setSaveOptIn(false)
      await store.getState().connect()

      handlers.onSample({ kind: 'hr', value: 72 })
      handlers.onHistoryPoints?.('hr', [{ t: 1_794_000_000, value: 70 }])
      await new Promise((r) => setTimeout(r, 20))
      expect(await testDb.wearables.count()).toBe(0)
    } finally {
      vi.useFakeTimers()
    }
  })

  it('links the watch to a crew member when saving is turned on, and not when it is turned off', () => {
    const store = createWatchStore({ makeLink: () => ({ connect: async () => 'w', disconnect() {} }), now: () => NOW, supported: () => true })
    store.getState().setSaveOptIn(false, 'pilot')
    expect(store.getState().wearerId).toBeNull()
    store.getState().setSaveOptIn(true, 'pilot')
    expect(store.getState().wearerId).toBe('pilot')
    store.getState().setWearer('cmdr')
    expect(store.getState().wearerId).toBe('cmdr')
  })
})
