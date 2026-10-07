import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ConsoleDB, readingsFor } from './db'
import { CREW, DAY, MISSION_START, SCENARIOS, generateReadings, seedDb } from './synthetic'

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const day = (rs: ReturnType<typeof generateReadings>, crew: string, metric: string, d: number) =>
  rs.filter((r) => r.crewId === crew && r.metric === metric && r.ts >= MISSION_START + d * DAY && r.ts < MISSION_START + (d + 1) * DAY).map((r) => r.value)

describe('generateReadings', () => {
  it('is deterministic for the same seed and differs for another', () => {
    const a = generateReadings({ seed: 7 })
    expect(generateReadings({ seed: 7 })).toEqual(a)
    expect(generateReadings({ seed: 8 })).not.toEqual(a)
  })

  it('produces 4 crew x 30 days with the expected counts', () => {
    const rs = generateReadings()
    expect(new Set(rs.map((r) => r.crewId)).size).toBe(4)
    // per crew per day: 7 hourly metrics x 24 + 4 daily
    expect(rs.length).toBe(4 * 30 * (7 * 24 + 4))
    expect(Math.max(...rs.map((r) => r.ts))).toBeLessThan(MISSION_START + 30 * DAY)
  })

  it('keeps bounded values valid', () => {
    const rs = generateReadings({ scenarios: ['solar', 'co2', 'insomnia', 'deconditioning'] })
    for (const r of rs) {
      expect(Number.isFinite(r.value) && r.value >= 0).toBe(true)
      if (r.metric === 'mood') expect(r.value).toBeLessThanOrEqual(5)
      if (r.metric === 'spo2') expect(r.value).toBeLessThanOrEqual(100)
    }
  })

  it('personalizes baselines per crew member', () => {
    const rs = generateReadings()
    const m = CREW.map((c) => mean(rs.filter((r) => r.crewId === c.id && r.metric === 'hr').map((r) => r.value)))
    expect(new Set(m.map((x) => x.toFixed(1))).size).toBe(4)
  })

  it.each(SCENARIOS)('scenario $id shifts the targeted metrics only inside its window', (s) => {
    const base = generateReadings()
    const hit = generateReadings({ scenarios: [s.id] })
    const target = s.crewIds === 'all' ? 'cmdr' : s.crewIds[0]
    const other = CREW.find((c) => s.crewIds !== 'all' && !s.crewIds.includes(c.id))
    for (const [metric, shift] of Object.entries(s.shifts)) {
      const delta = mean(day(hit, target, metric, s.startDay)) - mean(day(base, target, metric, s.startDay))
      expect(Math.sign(delta)).toBe(Math.sign(shift))
      // outside the window: identical
      expect(day(hit, target, metric, s.startDay - 1)).toEqual(day(base, target, metric, s.startDay - 1))
      expect(day(hit, target, metric, s.startDay + s.days)).toEqual(day(base, target, metric, s.startDay + s.days))
      if (other) expect(day(hit, other.id, metric, s.startDay)).toEqual(day(base, other.id, metric, s.startDay))
    }
  })
})

describe('seedDb', () => {
  it('loads crew and readings into Dexie and re-seeding is idempotent', async () => {
    const d = new ConsoleDB('seed-test')
    const n = await seedDb({ seed: 1, days: 3 }, d)
    expect(await d.crew.count()).toBe(4)
    expect(await d.readings.count()).toBe(n)
    await seedDb({ seed: 1, days: 3 }, d)
    expect(await d.readings.count()).toBe(n)
    expect((await readingsFor('pilot', 'sleep', MISSION_START, MISSION_START + 3 * DAY, d)).length).toBe(3)
  })
})
