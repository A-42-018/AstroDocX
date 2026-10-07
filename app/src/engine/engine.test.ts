import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { DAY, MISSION_START, SCENARIOS, generateReadings, rng, type ScenarioId } from '../data/synthetic'
import type { MetricId } from '../data/types'
import { ACT_Z, WATCH_Z, classify, ewma, newBaseline, rawZ, sdOf, step, warmupFor, welfordUpdate } from './baseline'
import { ingest, replay } from './replay'

describe('welford', () => {
  it('matches the batch mean and sample sd', () => {
    const xs = [4, 7, 13, 16, 9, 2, 8]
    let b = newBaseline('c', 'hr')
    for (const x of xs) b = welfordUpdate(b, x, 1000)
    const mean = xs.reduce((a, c) => a + c) / xs.length
    const sd = Math.sqrt(xs.reduce((a, c) => a + (c - mean) ** 2, 0) / (xs.length - 1))
    expect(b.mean).toBeCloseTo(mean, 10)
    expect(sdOf(b)).toBeCloseTo(sd, 10)
  })

  it('becomes an exponential window after the cap and tracks a level shift', () => {
    const r = rng(3)
    let b = newBaseline('c', 'hr')
    for (let i = 0; i < 400; i++) b = welfordUpdate(b, 60 + r.gauss() * 2, 100)
    expect(b.n).toBe(100)
    expect(b.mean).toBeCloseTo(60, 0)
    expect(sdOf(b)).toBeGreaterThan(1.2)
    expect(sdOf(b)).toBeLessThan(3)
    for (let i = 0; i < 600; i++) b = welfordUpdate(b, 70 + r.gauss() * 2, 100)
    expect(b.mean).toBeCloseTo(70, 0)
  })
})

describe('z, ewma and classification', () => {
  it('signs z by the bad direction (abs for two-sided metrics)', () => {
    const mk = (metric: MetricId) => ({ ...newBaseline('c', metric), n: 50, mean: 10, m2: 49 }) // sd = 1
    expect(rawZ(mk('co2'), 13)).toBeCloseTo(3)
    expect(rawZ(mk('co2'), 7)).toBeCloseTo(-3)
    expect(rawZ(mk('hrv'), 7)).toBeCloseTo(3)
    expect(rawZ(mk('hr'), 7)).toBeCloseTo(3)
    expect(rawZ(mk('hr'), 13)).toBeCloseTo(3)
  })

  it('smooths with alpha 0.5', () => expect(ewma(2, 4)).toBe(3))

  it('applies WATCH/ACT thresholds', () => {
    expect(classify(1.79, 'nominal')).toBe('nominal')
    expect(classify(WATCH_Z, 'nominal')).toBe('watch')
    expect(classify(ACT_Z, 'nominal')).toBe('act')
  })

  it('holds a status until z drops 0.4σ below its threshold', () => {
    expect(classify(1.5, 'watch')).toBe('watch')
    expect(classify(1.39, 'watch')).toBe('nominal')
    expect(classify(2.7, 'act')).toBe('act')
    expect(classify(2.59, 'act')).toBe('watch')
    expect(classify(1.0, 'act')).toBe('nominal')
  })
})

describe('step', () => {
  const warmed = (metric: MetricId = 'co2') => {
    let b = newBaseline('c', metric)
    const r = rng(1)
    for (let i = 0; i < warmupFor(metric); i++) b = step(b, 2.4 + r.gauss() * 0.28, i).baseline
    return b
  }

  it('stays nominal and unscored during warm-up', () => {
    const res = step(newBaseline('c', 'co2'), 99, 0)
    expect(res.scored).toBe(false)
    expect(res.status).toBe('nominal')
  })

  it('scores before learning and does not learn abnormal readings', () => {
    let b = warmed()
    const mean0 = b.mean
    for (let i = 0; i < 20; i++) b = step(b, 6, 100 + i).baseline
    expect(b.status).toBe('act')
    expect(b.mean).toBeCloseTo(mean0, 0) // frozen near the original mean
    expect(b.mean).toBeLessThan(3.2)
  })

  it('recovers to nominal once values return', () => {
    let b = warmed()
    for (let i = 0; i < 6; i++) b = step(b, 6, 100 + i).baseline
    expect(b.status).toBe('act')
    let last = b.status
    for (let i = 0; i < 10; i++) {
      const res = step(b, 2.4, 200 + i)
      b = res.baseline
      last = res.status
    }
    expect(last).toBe('nominal')
  })
})

describe('scenarios through replay', () => {
  const day = (s: { scored: { reading: { ts: number; crewId: string; metric: string }; status: string }[] }, crew: string, metric: string, from: number, to: number) =>
    s.scored.filter((x) => x.reading.crewId === crew && x.reading.metric === metric && x.reading.ts >= MISSION_START + from * DAY && x.reading.ts < MISSION_START + to * DAY).map((x) => x.status)

  it('raises no Act and very few Watch on clean history', () => {
    const { scored } = replay(generateReadings({ seed: 42 }))
    const live = scored.filter((s) => s.scored)
    expect(live.filter((s) => s.status === 'act')).toHaveLength(0)
    expect(live.filter((s) => s.status === 'watch').length / live.length).toBeLessThan(0.01)
  })

  it('has no Act on any metric for another seed too', () => {
    const { scored } = replay(generateReadings({ seed: 99 }))
    expect(scored.filter((s) => s.status === 'act')).toHaveLength(0)
  })

  const expected: Record<ScenarioId, { crew: string; metric: string }> = {
    solar: { crew: 'cmdr', metric: 'dose' },
    co2: { crew: 'eng', metric: 'co2' },
    insomnia: { crew: 'pilot', metric: 'sleep' },
    deconditioning: { crew: 'eng', metric: 'exercise' },
  }
  it.each(SCENARIOS)('scenario $id reaches Act on its key metric inside its window', (s) => {
    const run = replay(generateReadings({ seed: 42, scenarios: [s.id] }))
    const { crew, metric } = expected[s.id]
    expect(day(run, crew, metric, s.startDay, s.startDay + s.days)).toContain('act')
  })

  it('recovers to nominal after the solar event and the CO2 fault', () => {
    const run = replay(generateReadings({ seed: 42, scenarios: ['solar', 'co2'] }))
    expect(day(run, 'cmdr', 'dose', 22, 23).at(-1)).toBe('nominal')
    expect(day(run, 'cmdr', 'co2', 26, 27).at(-1)).toBe('nominal')
  })
})

describe('ingest', () => {
  it('persists the reading and baseline and reports the previous status', async () => {
    const d = new ConsoleDB('engine-test')
    let last = { previous: 'nominal' as string, status: 'nominal' as string }
    const r = rng(5)
    for (let i = 0; i < 60; i++) await ingest({ crewId: 'c', metric: 'co2', value: 2.4 + r.gauss() * 0.28, ts: i, source: 'cabin' }, d)
    for (let i = 60; i < 64; i++) last = await ingest({ crewId: 'c', metric: 'co2', value: 6, ts: i, source: 'cabin' }, d)
    expect(await d.readings.count()).toBe(64)
    expect((await d.baselines.get(['c', 'co2']))?.status).toBe('act')
    expect(last.status).toBe('act')
  })
})
