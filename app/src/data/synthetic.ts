import { ConsoleDB, db, resetDb } from './db'
import type { CrewMember, MetricId, Reading, Source } from './types'

/** Fixed mission start so the same seed always yields byte-identical data (2030-01-01T00:00Z, illustrative). */
export const MISSION_START = Date.UTC(2030, 0, 1)
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

export const CREW: CrewMember[] = [
  { id: 'cmdr', name: 'Commander', role: 'Commander' },
  { id: 'pilot', name: 'Pilot', role: 'Pilot' },
  { id: 'eng', name: 'Flight Engineer', role: 'Flight Engineer' },
  { id: 'med', name: 'Medical Officer', role: 'Medical Officer' },
]

/** Seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const gauss = () => {
    const u = Math.max(next(), 1e-12)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
  }
  return { next, gauss }
}

/** Typical (illustrative) mean and sd per metric; each crew member gets a personal offset. */
export const NORMAL: Record<MetricId, { mean: number; sd: number; source: Source; daily: boolean; dec: number }> = {
  hr: { mean: 62, sd: 3, source: 'wearable', daily: false, dec: 0 },
  hrv: { mean: 48, sd: 5, source: 'wearable', daily: false, dec: 0 },
  spo2: { mean: 97.5, sd: 0.6, source: 'wearable', daily: false, dec: 1 },
  co2: { mean: 2.4, sd: 0.28, source: 'cabin', daily: false, dec: 2 },
  temp: { mean: 22.5, sd: 0.5, source: 'cabin', daily: false, dec: 1 },
  noise: { mean: 52, sd: 2.5, source: 'cabin', daily: false, dec: 0 },
  dose: { mean: 25, sd: 3.5, source: 'cabin', daily: false, dec: 1 },
  sleep: { mean: 7.1, sd: 0.6, source: 'wearable', daily: true, dec: 1 },
  exercise: { mean: 120, sd: 14, source: 'wearable', daily: true, dec: 0 },
  reaction: { mean: 312, sd: 20, source: 'checkin', daily: true, dec: 0 },
  mood: { mean: 4, sd: 0.5, source: 'checkin', daily: true, dec: 0 },
}

export type ScenarioId = 'solar' | 'co2' | 'insomnia' | 'deconditioning'

export interface Scenario {
  id: ScenarioId
  label: string
  crewIds: string[] | 'all'
  /** Mission day the scenario starts and how many days it lasts. */
  startDay: number
  days: number
  /** Shift in sd units added per metric while active (positive = upward). */
  shifts: Partial<Record<MetricId, number>>
}

/** Shifts are large enough to cross the 3σ Act threshold of the engine (C3/C4). */
export const SCENARIOS: Scenario[] = [
  { id: 'solar', label: 'Solar particle event', crewIds: 'all', startDay: 20, days: 1, shifts: { dose: 8 } },
  { id: 'co2', label: 'CO₂ scrubber fault', crewIds: 'all', startDay: 24, days: 1, shifts: { co2: 6, hr: 1 } },
  { id: 'insomnia', label: 'Insomnia streak', crewIds: ['pilot'], startDay: 26, days: 4, shifts: { sleep: -4, reaction: 3, mood: -3 } },
  { id: 'deconditioning', label: 'Skipped exercise / deconditioning', crewIds: ['eng'], startDay: 22, days: 8, shifts: { exercise: -5, hrv: -2.5, hr: 2 } },
]

export interface GenerateOptions {
  seed?: number
  days?: number
  /** Scenario ids to inject; default none (baseline-only history). */
  scenarios?: ScenarioId[]
  crew?: CrewMember[]
  start?: number
}

const round = (v: number, d: number) => Number(v.toFixed(d))

export function generateReadings(opts: GenerateOptions = {}): Reading[] {
  const { seed = 42, days = 30, scenarios = [], crew = CREW, start = MISSION_START } = opts
  const active = SCENARIOS.filter((s) => scenarios.includes(s.id))
  const out: Reading[] = []

  crew.forEach((member, ci) => {
    const r = rng(seed * 1000 + ci + 1)
    // Personal offset: each person's baseline differs by up to ~1 sd.
    const offset = {} as Record<MetricId, number>
    for (const m of Object.keys(NORMAL) as MetricId[]) offset[m] = r.gauss() * 0.8 * NORMAL[m].sd

    const emit = (metric: MetricId, ts: number, day: number) => {
      const n = NORMAL[metric]
      let shift = 0
      for (const s of active) {
        if (day >= s.startDay && day < s.startDay + s.days && (s.crewIds === 'all' || s.crewIds.includes(member.id))) shift += s.shifts[metric] ?? 0
      }
      let v = n.mean + offset[metric] + (r.gauss() + shift) * n.sd
      if (metric === 'mood') v = Math.min(5, Math.max(1, v))
      if (metric === 'spo2') v = Math.min(100, v)
      out.push({ crewId: member.id, metric, value: round(Math.max(0, v), n.dec), ts, source: n.source })
    }

    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) {
        const ts = start + d * DAY + h * HOUR
        for (const m of Object.keys(NORMAL) as MetricId[]) if (!NORMAL[m].daily) emit(m, ts, d)
      }
      // Daily metrics are logged at 07:00 mission time.
      const ts = start + d * DAY + 7 * HOUR
      for (const m of Object.keys(NORMAL) as MetricId[]) if (NORMAL[m].daily) emit(m, ts, d)
    }
  })
  return out
}

/** Replace the contents of the DB with a fresh synthetic mission. */
export async function seedDb(opts: GenerateOptions = {}, d: ConsoleDB = db) {
  const readings = generateReadings(opts)
  await resetDb(d)
  await d.crew.bulkAdd(opts.crew ?? CREW)
  await d.readings.bulkAdd(readings)
  return readings.length
}
