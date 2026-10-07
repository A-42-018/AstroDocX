import { db, readingsFor, type ConsoleDB } from '../data/db'
import { DAY } from '../data/synthetic'
import type { MetricId } from '../data/types'

/** Recent values for the small chart on each hazard card. */
export interface MiniData {
  /** Cumulative dose (µSv) at each hour of the last 7 days. */
  dose: number[]
  /** Sleep per night, last 14 nights, and the personal mean. */
  sleep: number[]
  sleepMean: number | null
  /** Exercise minutes per day, last 7 days, and the personal mean. */
  exercise: number[]
  exerciseMean: number | null
  /** Cabin CO₂ for the last 48 hours. */
  co2: number[]
}

export async function loadMini(crewId: string, now: number, d: ConsoleDB = db): Promise<MiniData> {
  const vals = async (m: MetricId, span: number) => (await readingsFor(crewId, m, now - span, now, d)).sort((a, b) => a.ts - b.ts).map((r) => r.value)
  const [dose, sleep, exercise, co2, sb, eb] = await Promise.all([
    vals('dose', 7 * DAY), vals('sleep', 14 * DAY), vals('exercise', 7 * DAY), vals('co2', 2 * DAY),
    d.baselines.get([crewId, 'sleep']), d.baselines.get([crewId, 'exercise']),
  ])
  let sum = 0
  // Readings are hourly, so the running total of the dose rate is the dose in µSv.
  return { dose: dose.map((v) => (sum += v)), sleep, sleepMean: sb?.mean ?? null, exercise, exerciseMean: eb?.mean ?? null, co2 }
}
