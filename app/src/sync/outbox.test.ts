import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'
import { autoSync, loadOutbox, syncNow } from './outbox'

const at = (day: number, h: number) => MISSION_START + day * DAY + h * HOUR
let d: ConsoleDB
let n = 0
const entry = (ts: number) => d.actionLog.add({ crewId: 'cmdr', kind: 'note', text: `n${ts}`, ts, sync: 'pending' })

beforeEach(() => { d = new ConsoleDB(`sync-test-${n++}`) })

describe('syncNow', () => {
  it('marks every pending entry synced with the sync time when a window is open', async () => {
    await entry(at(1, 0)); await entry(at(1, 1))
    expect(await syncNow(at(1, 1), false, d)).toBe(2)
    const box = await loadOutbox(d)
    expect(box.pending).toHaveLength(0)
    expect(box.synced.every((e) => e.syncedAt === at(1, 1))).toBe(true)
  })
  it('refuses during a blackout and between windows, leaving entries queued', async () => {
    await entry(at(1, 1))
    await expect(syncNow(at(1, 1), true, d)).rejects.toThrow(/blackout/i)
    await expect(syncNow(at(1, 5), false, d)).rejects.toThrow(/window/i)
    expect((await loadOutbox(d)).pending).toHaveLength(1)
  })
})

describe('autoSync', () => {
  it('uploads, in each window passed, what was queued by 30 min after it opened', async () => {
    await entry(at(1, 3)); await entry(at(1, 12) + 20 * 60_000); await entry(at(1, 18))
    expect(await autoSync(at(1, 1), at(1, 20), false, d)).toBe(2)
    const box = await loadOutbox(d)
    expect(box.pending.map((e) => e.ts)).toEqual([at(1, 18)])
    expect(box.synced.every((e) => e.syncedAt !== undefined)).toBe(true)
  })
  it('does nothing in a blackout or when no window is crossed', async () => {
    await entry(at(1, 3))
    expect(await autoSync(at(1, 1), at(2, 1), true, d)).toBe(0)
    expect(await autoSync(at(1, 2), at(1, 6), false, d)).toBe(0)
    expect((await loadOutbox(d)).pending).toHaveLength(1)
  })
  it('does not upload entries written after a window that ended before them', async () => {
    await entry(at(1, 5))
    expect(await autoSync(at(1, 0) - 1, at(1, 6), false, d)).toBe(0)
  })
})
