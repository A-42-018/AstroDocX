import { ConsoleDB, db } from '../data/db'
import { DAY, HOUR, MISSION_START, NORMAL, SCENARIOS, rng, type ScenarioId } from '../data/synthetic'
import type { Alert, MetricId, Reading } from '../data/types'
import { processAll } from '../engine/pipeline'

/** A scenario that is currently running on the live mission. */
export interface Injection {
  scenario: ScenarioId
  crewIds: string[]
  startTs: number
  /** Exclusive end time. */
  endTs: number
}

export type Centers = Record<string, Partial<Record<MetricId, number>>>

/** Hours to run right after injecting, so the effect is visible straight away (illustrative). */
export const LEAD_HOURS: Record<ScenarioId, number> = { solar: 6, co2: 6, insomnia: 48, deconditioning: 48 }

export function makeInjection(scenario: ScenarioId, crewIds: string[], now: number): Injection {
  const s = SCENARIOS.find((x) => x.id === scenario)!
  return { scenario, crewIds, startTs: now, endTs: now + s.days * DAY }
}

const round = (v: number, d: number) => Number(v.toFixed(d))
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Each person's healthy level per metric: the median over the first two mission weeks, before any scenario starts. */
export async function healthyCenters(d: ConsoleDB = db): Promise<Centers> {
  const out: Centers = {}
  const rows = await d.readings.where('ts').below(MISSION_START + 14 * DAY).toArray()
  const by = new Map<string, number[]>()
  for (const r of rows) {
    const k = `${r.crewId}|${r.metric}`
    ;(by.get(k) ?? by.set(k, []).get(k)!).push(r.value)
  }
  for (const [k, v] of by) {
    const [crewId, metric] = k.split('|') as [string, MetricId]
    ;(out[crewId] ??= {})[metric] = median(v)
  }
  return out
}

/**
 * Readings for the `hours` after `from`: hourly metrics every hour, daily metrics at 07:00 mission time,
 * shifted (in sd units) while an injection covers the person. Pure and seeded: same inputs, same data.
 */
export function windowReadings(centers: Centers, from: number, hours: number, injections: Injection[], seed = 1): Reading[] {
  const out: Reading[] = []
  const r = rng(seed * 7919 + Math.floor(from / HOUR))
  for (let h = 1; h <= hours; h++) {
    const ts = from + h * HOUR
    const daily = (((ts - MISSION_START) % DAY) + DAY) % DAY === 7 * HOUR
    for (const crewId of Object.keys(centers)) {
      for (const metric of Object.keys(NORMAL) as MetricId[]) {
        const n = NORMAL[metric]
        if (n.daily !== daily) continue
        let shift = 0
        for (const inj of injections) {
          if (ts > inj.startTs && ts <= inj.endTs && inj.crewIds.includes(crewId)) shift += SCENARIOS.find((s) => s.id === inj.scenario)!.shifts[metric] ?? 0
        }
        let v = (centers[crewId][metric] ?? n.mean) + (r.gauss() + shift) * n.sd
        if (metric === 'mood') v = Math.min(5, Math.max(1, v))
        if (metric === 'spo2') v = Math.min(100, v)
        out.push({ crewId, metric, value: round(Math.max(0, v), n.dec), ts, source: n.source })
      }
    }
  }
  return out
}

export interface AdvanceResult {
  from: number
  to: number
  readings: number
  opened: Alert[]
  resolved: Alert[]
}

export async function missionNow(d: ConsoleDB = db): Promise<number> {
  return (await d.readings.orderBy('ts').last())?.ts ?? MISSION_START
}

/** Move the mission clock forward, running the generated readings through the full engine. */
export async function advance(hours: number, injections: Injection[], d: ConsoleDB = db): Promise<AdvanceResult> {
  if (!(hours > 0)) throw new Error('Advance by a positive number of hours.')
  const from = await missionNow(d)
  const wasActive = new Set((await d.alerts.toArray()).filter((a) => a.state !== 'resolved').map((a) => a.id))
  const readings = windowReadings(await healthyCenters(d), from, hours, injections)
  await processAll(readings, d)
  const after = await d.alerts.toArray()
  return {
    from,
    to: from + hours * HOUR,
    readings: readings.length,
    opened: after.filter((a) => a.openedAt > from),
    resolved: after.filter((a) => a.state === 'resolved' && wasActive.has(a.id)),
  }
}
