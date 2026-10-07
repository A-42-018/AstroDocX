import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { ConsoleDB, resetDb } from '../data/db'
import { CREW, DAY, HOUR, MISSION_START, generateReadings, type ScenarioId } from '../data/synthetic'
import type { Alert, Reading } from '../data/types'
import { co2Limit, eventDoseLimit } from './limits'
import { stepsFor, met } from './actions'
import { completeActionCard, cumulativeDoseMsv, processAll, processReading, setStepDone } from './pipeline'

const mk = (name: string) => new ConsoleDB(name)
/** Two crew members per run (the target and a bystander) keeps the fake-indexeddb runtime reasonable. */
const run = async (name: string, scenarios: ScenarioId[], crew: string[], seed = 42) => {
  const d = mk(name)
  await d.crew.bulkAdd(CREW)
  await processAll(generateReadings({ seed, scenarios }).filter((r) => crew.includes(r.crewId)), d)
  return d
}
const forMetric = (alerts: Alert[], crew: string, metric: string) => alerts.filter((a) => a.crewId === crew && a.metric === metric && a.kind !== 'combined')
const nonResolved = (a: Alert[]) => a.filter((x) => x.state !== 'resolved')

describe('limits', () => {
  it('ignores short CO2 excursions, Watches after 3 h and Acts after 6 h or at the emergency level', () => {
    expect(co2Limit(3.2, 2).status).toBe('nominal')
    expect(co2Limit(3.2, 3).status).toBe('watch')
    expect(co2Limit(3.2, 6).status).toBe('act')
    expect(co2Limit(4.6, 1).status).toBe('act')
    expect(co2Limit(2.9, 0).status).toBe('nominal')
  })
  it('compares 24 h dose with the 250 mSv per-event limit', () => {
    expect(eventDoseLimit(100).status).toBe('nominal')
    expect(eventDoseLimit(125).status).toBe('watch')
    expect(eventDoseLimit(250).status).toBe('act')
  })
  it('cites its sources in the explanation text', () => {
    expect(co2Limit(3.2, 3).reason).toContain('NASA-STD-3001')
    expect(eventDoseLimit(300).reason).toContain('NASA-STD-3001')
  })
})

describe('action cards and explanation', () => {
  it('returns 3-4 unchecked steps for every level, with fallbacks', () => {
    for (const m of ['co2', 'dose', 'sleep', 'reaction', 'exercise', 'hr', 'hrv', 'spo2', 'temp', 'sleep+reaction'] as const)
      for (const l of ['watch', 'act'] as const) {
        const s = stepsFor(m, l)
        expect(s.length).toBeGreaterThanOrEqual(3)
        expect(s.every((x) => !x.done && x.text.length > 5)).toBe(true)
      }
  })
  it('formats mission elapsed time', () => expect(met(MISSION_START + 3 * DAY + 7 * HOUR)).toBe('D3 07:00 MET'))
})

describe('alert lifecycle', () => {
  const d = mk('lifecycle')
  const base = async () => {
    await resetDb(d)
    await d.crew.bulkAdd(CREW)
    const ready = generateReadings({ seed: 4, days: 5 }).filter((r) => r.crewId === 'eng' && r.metric === 'co2')
    await processAll(ready, d)
    return Math.max(...ready.map((r) => r.ts))
  }
  const co2 = (value: number, ts: number): Reading => ({ crewId: 'eng', metric: 'co2', value, ts, source: 'cabin' })

  it('opens an explained alert with an action card, escalates, and resolves on recovery', async () => {
    let t = await base()
    expect(await d.alerts.count()).toBe(0)

    // 4.0 mmHg: far above this crew member's baseline but below the 4.5 emergency level.
    // Hourly metrics need 3 consecutive readings before an alert shows; Act must persist for 3 as well.
    expect((await processReading(co2(4.0, (t += HOUR)), d)).alert).toBeUndefined()
    expect((await processReading(co2(4.0, (t += HOUR)), d)).alert).toBeUndefined()
    const first = await processReading(co2(4.0, (t += HOUR)), d)
    expect(first.change).toBe('opened')
    expect(first.alert?.status).toBe('watch')
    const second = await processReading(co2(4.0, (t += HOUR)), d)
    expect(second.alert?.status).toBe('act')
    expect(second.change).toBe('escalated')
    expect(second.alert?.explanation).toMatch(/baseline/)
    expect(second.alert?.steps.length).toBeGreaterThanOrEqual(3)

    let last
    for (let i = 0; i < 12; i++) last = await processReading(co2(2.4, (t += HOUR)), d)
    expect(last?.status).toBe('nominal')
    const [alert] = await d.alerts.toArray()
    expect(alert.state).toBe('resolved')
    expect(alert.resolvedAt).toBeDefined()
    const kinds = (await d.actionLog.toArray()).map((e) => e.kind)
    expect(kinds).toContain('alert-opened')
    expect(kinds).toContain('alert-resolved')
    expect((await d.actionLog.toArray()).every((e) => e.sync === 'pending')).toBe(true)
  })

  it('Done acknowledges, logs, and an escalation reopens the card', async () => {
    let t = await base()
    for (let i = 0; i < 3; i++) await processReading(co2(4.0, (t += HOUR)), d)
    const id = (await d.alerts.toArray())[0].id!
    await setStepDone(id, 0, true, t, d)
    expect((await d.alerts.get(id))!.steps[0].done).toBe(true)
    await completeActionCard(id, t, d)
    const done = (await d.alerts.get(id))!
    expect(done.state).toBe('acknowledged')
    expect(done.steps.every((s) => s.done)).toBe(true)
    await processReading(co2(4.0, (t += HOUR)), d) // worsens: Watch -> Act
    const after = (await d.alerts.get(id))!
    expect(after.status).toBe('act')
    expect(after.state).toBe('open')
    expect(after.steps.every((s) => !s.done)).toBe(true)
    expect((await d.actionLog.toArray()).some((e) => e.kind === 'step-done')).toBe(true)
  })

  it('computes cumulative dose in mSv from hourly dose rates', async () => {
    await resetDb(d)
    for (let i = 0; i < 10; i++) await processReading({ crewId: 'cmdr', metric: 'dose', value: 1000, ts: i * HOUR, source: 'cabin' }, d)
    expect(await cumulativeDoseMsv('cmdr', d)).toBeCloseTo(10)
    expect(await cumulativeDoseMsv('pilot', d)).toBe(0)
  })

  it('opens an Act limit alert from an event dose over 250 mSv and cites the cumulative budget', async () => {
    await resetDb(d)
    await d.crew.bulkAdd(CREW)
    let t = MISSION_START
    for (let i = 0; i < 60; i++) await processReading({ crewId: 'cmdr', metric: 'dose', value: 25, ts: (t += HOUR), source: 'cabin' }, d)
    let res
    for (let i = 0; i < 3; i++) res = await processReading({ crewId: 'cmdr', metric: 'dose', value: 120_000, ts: (t += HOUR), source: 'cabin' }, d)
    expect(res?.alert?.status).toBe('act')
    expect(res?.alert?.kind).toBe('limit')
    expect(res?.alert?.explanation).toContain('600 mSv career limit')
  })
})

describe('scenarios raise the right alerts', () => {
  let solar: ConsoleDB, co2: ConsoleDB, insomnia: ConsoleDB, decon: ConsoleDB
  beforeAll(async () => {
    solar = await run('s-solar', ['solar'], ['cmdr', 'med'])
    co2 = await run('s-co2', ['co2'], ['cmdr', 'med'])
    insomnia = await run('s-ins', ['insomnia'], ['pilot', 'med'])
    decon = await run('s-dec', ['deconditioning'], ['eng', 'med'])
  }, 300_000)

  it('solar event: every crew member gets an Act dose alert, resolved afterwards', async () => {
    const all = await solar.alerts.toArray()
    for (const c of CREW.filter((m) => ['cmdr', 'med'].includes(m.id))) {
      const a = forMetric(all, c.id, 'dose')
      expect(a.some((x) => x.peakStatus === 'act')).toBe(true)
      expect(nonResolved(a)).toHaveLength(0)
    }
  })

  it('CO2 fault: Act CO2 alert for the crew, resolved, with Act steps', async () => {
    const all = await co2.alerts.toArray()
    for (const c of CREW.filter((m) => ['cmdr', 'med'].includes(m.id))) {
      const a = forMetric(all, c.id, 'co2')
      expect(a.some((x) => x.peakStatus === 'act')).toBe(true)
      expect(nonResolved(a)).toHaveLength(0)
    }
    expect(forMetric(all, 'cmdr', 'co2')[0].steps.some((s) => /scrubber/i.test(s.text))).toBe(true)
  })

  it('insomnia: pilot gets a sleep alert and the sleep + reaction behavioral Watch; others stay quiet', async () => {
    const all = await insomnia.alerts.toArray()
    expect(forMetric(all, 'pilot', 'sleep').length).toBeGreaterThan(0)
    const comb = all.filter((a) => a.crewId === 'pilot' && a.kind === 'combined')
    expect(comb.length).toBeGreaterThan(0)
    expect(comb[0].status).toBe('watch')
    expect(comb[0].hazard).toBe('I')
    expect(all.filter((a) => a.crewId !== 'pilot' && a.peakStatus === 'act')).toHaveLength(0)
  })

  it('deconditioning: flight engineer gets an exercise alert and it reaches Act', async () => {
    const all = await decon.alerts.toArray()
    expect(forMetric(all, 'eng', 'exercise').some((x) => x.peakStatus === 'act')).toBe(true)
    expect(all.filter((a) => a.crewId !== 'eng' && a.peakStatus === 'act')).toHaveLength(0)
  })
})

describe('clean history', () => {
  it.each([42, 99])('raises no Act alerts and few Watch alerts for seed %i', async (seed) => {
    const d = await run(`clean-${seed}`, [], ['cmdr', 'pilot'], seed)
    const all = await d.alerts.toArray()
    expect(all.filter((a) => a.peakStatus === 'act')).toHaveLength(0)
    expect(all.length).toBeLessThanOrEqual(8) // about 3 Watch alerts per crew member per month at 1.8σ
  }, 120_000)
})
