import { ConsoleDB, db, resetDb } from './db'
import { CREW, MISSION_START, generateReadings, type GenerateOptions } from './synthetic'
import type { ActionLogEntry, Alert, Baseline } from './types'
import { autoSync } from '../sync/outbox'
import { processAll } from '../engine/pipeline'
import snapshot from './demo-snapshot.json'

/** Demo mission: insomnia (pilot) and deconditioning (flight engineer) are still active at the end of the history. */
export const DEMO_OPTIONS: GenerateOptions = { seed: 42, days: 30, scenarios: ['insomnia', 'deconditioning'] }

/** What the engine produces for the demo mission. The readings themselves are regenerated from the seed. */
export interface DemoSnapshot {
  baselines: Baseline[]
  alerts: Alert[]
  actionLog: ActionLogEntry[]
}

export async function demoLoaded(d: ConsoleDB = db) {
  return (await d.crew.count()) > 0
}

/**
 * Replace the DB with the demo mission run through the full engine (about 10 s for 20,640 readings).
 * Used to build and check the shipped snapshot, and for any non-default options.
 */
export async function computeDemo(d: ConsoleDB = db, opts: GenerateOptions = DEMO_OPTIONS, onProgress?: (done: number, total: number) => void) {
  const readings = generateReadings(opts)
  const now = Math.max(...readings.map((r) => r.ts))
  // One transaction for the whole seed: if the page is closed midway nothing is kept, so a half-seeded DB can never look "loaded".
  await d.transaction('rw', d.tables, async () => {
    await resetDb(d)
    await d.crew.bulkAdd(opts.crew ?? CREW)
    await processAll(readings, d, onProgress)
    // Replay the simulated link windows (C10), so history was synced in earlier windows and only recent entries are still queued.
    await autoSync(MISSION_START - 1, now, false, d, null)
  })
  return readings.length
}

/** Read the engine's output back out of a DB, in key order (the shape of demo-snapshot.json). */
export async function exportDemo(d: ConsoleDB): Promise<DemoSnapshot> {
  return {
    baselines: await d.baselines.toArray(),
    alerts: await d.alerts.orderBy('id').toArray(),
    actionLog: await d.actionLog.orderBy('id').toArray(),
  }
}

/**
 * Seed the demo mission. With the default options this regenerates the readings from the seed and loads
 * the engine's precomputed output (demo-snapshot.json, kept honest by demo.snapshot.test.ts), which
 * takes about a second instead of running the engine over every reading on first launch.
 */
export async function seedDemo(onProgress?: (done: number, total: number) => void, d: ConsoleDB = db, opts: GenerateOptions = DEMO_OPTIONS) {
  if (opts !== DEMO_OPTIONS) return computeDemo(d, opts, onProgress)
  const readings = generateReadings(opts).sort((a, b) => a.ts - b.ts) // engine order, so ids match a computed seed
  const snap = snapshot as unknown as DemoSnapshot
  await d.transaction('rw', d.tables, async () => {
    await resetDb(d)
    await d.crew.bulkAdd(CREW)
    await d.readings.bulkAdd(readings)
    await d.baselines.bulkAdd(snap.baselines)
    await d.alerts.bulkAdd(snap.alerts)
    await d.actionLog.bulkAdd(snap.actionLog)
  })
  onProgress?.(readings.length, readings.length)
  return readings.length
}
