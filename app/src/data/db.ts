import Dexie, { type EntityTable } from 'dexie'
import type { ActionLogEntry, Alert, Baseline, CheckIn, CrewMember, MetricId, Reading, Timestamp } from './types'

export class ConsoleDB extends Dexie {
  crew!: EntityTable<CrewMember, 'id'>
  readings!: EntityTable<Reading, 'id'>
  baselines!: EntityTable<Baseline, never>
  alerts!: EntityTable<Alert, 'id'>
  actionLog!: EntityTable<ActionLogEntry, 'id'>
  checkIns!: EntityTable<CheckIn, 'id'>

  constructor(name = 'astrodocx-console') {
    super(name)
    this.version(1).stores({
      crew: 'id',
      readings: '++id, [crewId+metric+ts], crewId, ts',
      baselines: '[crewId+metric], crewId',
      alerts: '++id, crewId, state, [crewId+state], openedAt',
      actionLog: '++id, crewId, ts, sync, alertId',
      checkIns: '++id, crewId, ts',
    })
  }
}

export const db = new ConsoleDB()

export function addReading(r: Reading, d: ConsoleDB = db) {
  return d.readings.add(r)
}

export function readingsFor(crewId: string, metric: MetricId, from: Timestamp, to: Timestamp, d: ConsoleDB = db) {
  return d.readings.where('[crewId+metric+ts]').between([crewId, metric, from], [crewId, metric, to], true, true).toArray()
}

export function openAlerts(crewId: string, d: ConsoleDB = db) {
  return d.alerts.where('[crewId+state]').anyOf([crewId, 'open'], [crewId, 'acknowledged']).toArray()
}

export function pendingSync(d: ConsoleDB = db) {
  return d.actionLog.where('sync').equals('pending').toArray()
}

export async function resetDb(d: ConsoleDB = db) {
  await d.transaction('rw', d.tables, () => Promise.all(d.tables.map((t) => t.clear())))
}
