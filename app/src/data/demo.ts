import { ConsoleDB, db, resetDb } from './db'
import { CREW, MISSION_START, generateReadings, type GenerateOptions } from './synthetic'
import { autoSync } from '../sync/outbox'
import { processAll } from '../engine/pipeline'

/** Demo mission: insomnia (pilot) and deconditioning (flight engineer) are still active at the end of the history. */
export const DEMO_OPTIONS: GenerateOptions = { seed: 42, days: 30, scenarios: ['insomnia', 'deconditioning'] }

export async function demoLoaded(d: ConsoleDB = db) {
  return (await d.crew.count()) > 0
}

/** Replace the DB with a fresh demo mission run through the full engine. */
export async function seedDemo(onProgress?: (done: number, total: number) => void, d: ConsoleDB = db, opts: GenerateOptions = DEMO_OPTIONS) {
  const readings = generateReadings(opts)
  const now = Math.max(...readings.map((r) => r.ts))
  // One transaction for the whole seed: if the page is closed midway nothing is kept, so a half-seeded DB can never look "loaded".
  await d.transaction('rw', d.tables, async () => {
    await resetDb(d)
    await d.crew.bulkAdd(opts.crew ?? CREW)
    await processAll(readings, d, onProgress)
    // Replay the simulated link windows (C10), so history was synced in earlier windows and only recent entries are still queued.
    await autoSync(MISSION_START - 1, now, false, d)
  })
  return readings.length
}
