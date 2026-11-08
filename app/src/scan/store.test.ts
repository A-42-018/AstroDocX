import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConsoleDB, resetDb } from '../data/db'
import type { ScanAnalysis } from './rppg'
import { MIN_KEEP_SECONDS, logText, recentScans, saveScan, whyNot } from './store'

const d = new ConsoleDB('test-scans')
const good = (over: Partial<ScanAnalysis> = {}): ScanAnalysis => ({
  seconds: 28.5, pulse: new Float64Array(0), bpm: 67.4, snr: 8, quality: 0.83, reliable: true, hrv: 41.6, beatCount: 31, resp: 14.7, ...over,
})

beforeEach(() => resetDb(d))

describe('whyNot', () => {
  it('accepts a full, clean scan', () => expect(whyNot(good())).toBeNull())
  it('rejects a short scan', () => expect(whyNot(good({ seconds: MIN_KEEP_SECONDS - 1 }))).toMatch(/too short/))
  it('rejects a weak signal', () => expect(whyNot(good({ reliable: false }))).toMatch(/too weak/))
  it('rejects a rate no scan could read', () => { expect(whyNot(good({ bpm: 210 }))).toMatch(/outside/); expect(whyNot(good({ bpm: 30 }))).toMatch(/outside/) })
})

describe('saveScan', () => {
  it('stores rounded numbers and one pending log entry, and nothing in the readings or baselines', async () => {
    const s = await saveScan({ crewId: 'c1', ts: 1000, analysis: good() }, d)
    expect(s).toMatchObject({ crewId: 'c1', hr: 67, hrv: 42, resp: 15, quality: 0.83, seconds: 29 })
    expect(await d.scans.count()).toBe(1)
    const log = await d.actionLog.toArray()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ kind: 'note', sync: 'pending', crewId: 'c1' })
    expect(log[0].text).toContain('experimental')
    expect(await d.readings.count()).toBe(0)
    expect(await d.baselines.count()).toBe(0)
    expect(await d.alerts.count()).toBe(0)
  })

  it('keeps null HRV and breathing as null', async () => {
    const s = await saveScan({ crewId: 'c1', ts: 1, analysis: good({ hrv: null, resp: null }) }, d)
    expect(s.hrv).toBeNull(); expect(s.resp).toBeNull()
    expect(logText(s)).not.toMatch(/HRV|breathing/)
  })

  it('refuses a weak scan and writes nothing', async () => {
    await expect(saveScan({ crewId: 'c1', ts: 1, analysis: good({ reliable: false }) }, d)).rejects.toThrow(/too weak/)
    expect(await d.scans.count()).toBe(0)
    expect(await d.actionLog.count()).toBe(0)
  })

  it('lists the newest scans first, for one crew member', async () => {
    for (const ts of [1, 3, 2]) await saveScan({ crewId: 'c1', ts, analysis: good() }, d)
    await saveScan({ crewId: 'c2', ts: 9, analysis: good() }, d)
    expect((await recentScans('c1', 6, d)).map((s) => s.ts)).toEqual([3, 2, 1])
    expect(await recentScans('c1', 2, d)).toHaveLength(2)
  })
})
