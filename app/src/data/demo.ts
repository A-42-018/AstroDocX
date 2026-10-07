import { ConsoleDB, db, resetDb } from './db'
import { CREW, HOUR, generateReadings, type GenerateOptions } from './synthetic'
import { processAll } from '../engine/pipeline'

/** Demo mission: insomnia (pilot) and deconditioning (flight engineer) are still active at the end of the history. */
export const DEMO_OPTIONS: GenerateOptions = { seed: 42, days: 30, scenarios: ['insomnia', 'deconditioning'] }

/** Entries older than this before "now" were synced in earlier link windows. */
const SYNCED_BEFORE_NOW = 24 * HOUR

export async function demoLoaded(d: ConsoleDB = db) {
  return (await d.crew.count()) > 0
}

/** Replace the DB with a fresh demo mission run through the full engine. */
export async function seedDemo(onProgress?: (done: number, total: number) => void, d: ConsoleDB = db, opts: GenerateOptions = DEMO_OPTIONS) {
  const readings = generateReadings(opts)
  await resetDb(d)
  await d.crew.bulkAdd(opts.crew ?? CREW)
  await processAll(readings, d, onProgress)
  const now = Math.max(...readings.map((r) => r.ts))
  await d.actionLog.where('sync').equals('pending').filter((e) => e.ts < now - SYNCED_BEFORE_NOW).modify((e) => {
    e.sync = 'synced'
    e.syncedAt = e.ts + 2 * HOUR
  })
  return readings.length
}
