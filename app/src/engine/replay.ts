import { ConsoleDB, db } from '../data/db'
import type { Baseline, Reading, Status } from '../data/types'
import { newBaseline, step, type StepResult } from './baseline'

export interface Scored extends StepResult {
  reading: Reading
}

/** Run readings (sorted by time) through the engine in memory. */
export function replay(readings: Reading[], start: Map<string, Baseline> = new Map()) {
  const baselines = start
  const scored: Scored[] = []
  for (const r of [...readings].sort((a, b) => a.ts - b.ts)) {
    const key = `${r.crewId}|${r.metric}`
    const res = step(baselines.get(key) ?? newBaseline(r.crewId, r.metric, r.ts), r.value, r.ts)
    baselines.set(key, res.baseline)
    scored.push({ ...res, reading: r })
  }
  return { baselines, scored }
}

/** Process one new reading against the stored baseline and persist the result. */
export async function ingest(r: Reading, d: ConsoleDB = db): Promise<StepResult & { previous: Status }> {
  const prior = (await d.baselines.get([r.crewId, r.metric])) ?? newBaseline(r.crewId, r.metric, r.ts)
  const res = step(prior, r.value, r.ts)
  await d.transaction('rw', d.readings, d.baselines, async () => {
    await d.readings.add(r)
    await d.baselines.put(res.baseline)
  })
  return { ...res, previous: prior.status }
}
