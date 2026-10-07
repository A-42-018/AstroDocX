import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { CREW, DAY, HOUR, MISSION_START, generateReadings } from '../data/synthetic'
import { processAll } from '../engine/pipeline'
import { LEAD_HOURS, advance, healthyCenters, makeInjection, missionNow, windowReadings } from './advance'

const crew = [CREW[1], CREW[2]] // pilot, eng
let d: ConsoleDB
let n = 0

beforeEach(async () => {
  d = new ConsoleDB(`sim-test-${n++}`)
  await d.crew.bulkAdd(crew)
  await processAll(generateReadings({ seed: 11, days: 20, crew }), d)
}, 60_000)

const active = async () => (await d.alerts.toArray()).filter((a) => a.state !== 'resolved')

describe('windowReadings', () => {
  it('is deterministic and puts daily metrics at 07:00 mission time only', async () => {
    const c = await healthyCenters(d)
    const a = windowReadings(c, MISSION_START + 20 * DAY - HOUR, 30, [])
    expect(windowReadings(c, MISSION_START + 20 * DAY - HOUR, 30, [])).toEqual(a)
    const daily = a.filter((r) => r.metric === 'sleep')
    expect(daily).toHaveLength(2) // one 07:00 per person in 30 h
    expect(daily.every((r) => (r.ts - MISSION_START) % DAY === 7 * HOUR)).toBe(true)
  })
  it('shifts only the injected people and metrics', async () => {
    const c = await healthyCenters(d)
    const from = MISSION_START + 20 * DAY
    const inj = makeInjection('solar', ['pilot'], from)
    const r = windowReadings(c, from, 5, [inj])
    const dose = (id: string) => r.filter((x) => x.crewId === id && x.metric === 'dose').map((x) => x.value)
    expect(Math.min(...dose('pilot'))).toBeGreaterThan(c.pilot.dose! + 3 * 3.5)
    expect(Math.max(...dose('eng'))).toBeLessThan(c.eng.dose! + 4 * 3.5)
  })
})

describe('advance', () => {
  it('rejects non-positive hours', async () => {
    await expect(advance(0, [], d)).rejects.toThrow(/positive/)
  })

  it('moves mission time and stays quiet when nothing is injected', async () => {
    const before = await missionNow(d)
    const res = await advance(24, [], d)
    expect(await missionNow(d)).toBe(before + 24 * HOUR)
    expect(res.opened).toHaveLength(0)
  })

  it('solar event: radiation alert for the injected person, which resolves after it ends', async () => {
    const inj = makeInjection('solar', ['pilot'], await missionNow(d))
    const run = await advance(LEAD_HOURS.solar, [inj], d)
    const dose = run.opened.filter((a) => a.metric === 'dose')
    expect(dose.length).toBeGreaterThan(0)
    expect(dose.every((a) => a.crewId === 'pilot')).toBe(true)
    const after = await advance(3 * DAY / HOUR, [inj], d)
    expect((await active()).filter((a) => a.metric === 'dose')).toHaveLength(0)
    expect(after.resolved.some((a) => a.metric === 'dose')).toBe(true)
  })

  it('CO2 fault: environment alert for everyone', async () => {
    const inj = makeInjection('co2', ['pilot', 'eng'], await missionNow(d))
    const run = await advance(LEAD_HOURS.co2, [inj], d)
    expect(new Set(run.opened.filter((a) => a.metric === 'co2').map((a) => a.crewId))).toEqual(new Set(['pilot', 'eng']))
    expect(run.opened.some((a) => a.metric === 'co2' && a.status === 'act')).toBe(true)
  })

  it('insomnia: sleep alert plus the two-signal Watch for the pilot only', async () => {
    const inj = makeInjection('insomnia', ['pilot'], await missionNow(d))
    const run = await advance(LEAD_HOURS.insomnia, [inj], d)
    const mine = run.opened.filter((a) => a.crewId === 'pilot')
    expect(mine.some((a) => a.metric === 'sleep')).toBe(true)
    expect(run.opened.filter((a) => a.crewId === 'eng' && a.hazard === 'I')).toHaveLength(0)
  })

  it('deconditioning: exercise alert for the engineer', async () => {
    const inj = makeInjection('deconditioning', ['eng'], await missionNow(d))
    const run = await advance(LEAD_HOURS.deconditioning, [inj], d)
    expect(run.opened.some((a) => a.crewId === 'eng' && a.metric === 'exercise')).toBe(true)
  })
}, 60_000)
