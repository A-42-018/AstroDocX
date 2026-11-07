// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConsoleDB, resetDb } from '../data/db'
import type { WearableSample } from '../data/types'
import {
  deleteWearableData,
  exportWearablesCsv,
  exportWearablesJson,
  getCoverageSummary,
  getLastWearableTimestamp,
  getWatchSaveOptIn,
  setWatchSaveOptIn,
  upsertWearables,
} from './history'

const testDb = new ConsoleDB('test-wearables-history')

beforeEach(async () => {
  await resetDb(testDb)
  localStorage.clear()
})

describe('watch history & storage (Phase 0)', () => {
  it('has a version 3 wearables store separate from clinical readings and alerts', async () => {
    expect(testDb.wearables).toBeDefined()
    expect(await testDb.wearables.count()).toBe(0)
    expect(await testDb.readings.count()).toBe(0)
    expect(await testDb.alerts.count()).toBe(0)
  })

  it('upserts and deduplicates samples by [kind+ts]', async () => {
    const t0 = 1_794_000_000_000
    const sample1 = { kind: 'hr' as const, value: 72, ts: t0, source: 'haylou-solar5' as const, live: true }
    const sample2 = { kind: 'hr' as const, value: 75, ts: t0 + 60_000, source: 'haylou-solar5' as const, live: true }

    // First insert
    const added1 = await upsertWearables([sample1, sample2], testDb)
    expect(added1).toBe(2)
    expect(await testDb.wearables.count()).toBe(2)

    // Inserting identical point should deduplicate without creating new rows
    const added2 = await upsertWearables([sample1], testDb)
    expect(added2).toBe(0)
    expect(await testDb.wearables.count()).toBe(2)

    // Upserting with changed value updates the existing row
    const updatedSample = { ...sample1, value: 80 }
    const added3 = await upsertWearables([updatedSample], testDb)
    expect(added3).toBe(1)
    expect(await testDb.wearables.count()).toBe(2)
    const stored = await testDb.wearables.where('[kind+ts]').equals(['hr', t0]).first()
    expect(stored?.value).toBe(80)
  })

  it('retrieves the last saved timestamp for a kind', async () => {
    expect(await getLastWearableTimestamp('hr', testDb)).toBeNull()

    const t1 = 1_000_000
    const t2 = 2_000_000
    await upsertWearables([
      { kind: 'hr', value: 70, ts: t1, source: 'haylou-solar5', live: false },
      { kind: 'hr', value: 75, ts: t2, source: 'haylou-solar5', live: false },
      { kind: 'spo2', value: 98, ts: t1, source: 'haylou-solar5', live: false },
    ], testDb)

    expect(await getLastWearableTimestamp('hr', testDb)).toBe(t2)
    expect(await getLastWearableTimestamp('spo2', testDb)).toBe(t1)
    expect(await getLastWearableTimestamp('stress', testDb)).toBeNull()
  })

  it('computes coverage summary: distinct active hours per UTC day', () => {
    // 2026-11-07 10:00, 10:30, 11:15, 12:00 -> 3 distinct hours (10, 11, 12)
    const day = Date.UTC(2026, 10, 7)
    const samples: WearableSample[] = [
      { id: 1, kind: 'hr', value: 70, ts: day + 10 * 3600_000, source: 'haylou-solar5', live: true },
      { id: 2, kind: 'hr', value: 72, ts: day + 10 * 3600_000 + 1800_000, source: 'haylou-solar5', live: true },
      { id: 3, kind: 'spo2', value: 98, ts: day + 11 * 3600_000 + 900_000, source: 'haylou-solar5', live: false },
      { id: 4, kind: 'stress', value: 35, ts: day + 12 * 3600_000, source: 'haylou-solar5', live: false },
    ]

    const summary = getCoverageSummary(samples)
    expect(summary).toHaveLength(1)
    expect(summary[0].date).toBe('2026-11-07')
    expect(summary[0].hoursWithData).toBe(3)
    expect(summary[0].totalSamples).toBe(4)
    expect(summary[0].coveragePct).toBeCloseTo(3 / 24, 2)
  })

  it('exports samples to CSV and JSON', () => {
    const samples: WearableSample[] = [
      { id: 1, kind: 'hr', value: 68, ts: 1_794_000_000_000, source: 'haylou-solar5', live: true },
      { id: 2, kind: 'spo2', value: 98, ts: 1_794_000_060_000, source: 'haylou-solar5', live: false },
    ]

    const csv = exportWearablesCsv(samples)
    expect(csv).toContain('id,kind,value,timestamp_ms,iso_time,source,live')
    expect(csv).toContain('1,hr,68,1794000000000')
    expect(csv).toContain('2,spo2,98,1794000060000')

    const json = exportWearablesJson(samples)
    const parsed = JSON.parse(json)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].value).toBe(68)
  })

  it('clears all wearable data on delete', async () => {
    await upsertWearables([
      { kind: 'hr', value: 70, ts: 1000, source: 'haylou-solar5', live: true },
    ], testDb)
    expect(await testDb.wearables.count()).toBe(1)

    await deleteWearableData(testDb)
    expect(await testDb.wearables.count()).toBe(0)
  })

  it('manages opt-in preferences via local storage', () => {
    expect(getWatchSaveOptIn()).toBe(false)
    setWatchSaveOptIn(true)
    expect(getWatchSaveOptIn()).toBe(true)
    setWatchSaveOptIn(false)
    expect(getWatchSaveOptIn()).toBe(false)
  })
})
