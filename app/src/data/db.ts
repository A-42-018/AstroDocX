import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  ActionLogEntry, Alert, Baseline, CheckIn, CrewMember, FaceScan, MetricId, Reading, Timestamp,
  UsScan, WearableKind, WearableSample,
} from './types'

export class ConsoleDB extends Dexie {
  crew!: EntityTable<CrewMember, 'id'>
  readings!: EntityTable<Reading, 'id'>
  baselines!: Table<Baseline, [string, string]>
  alerts!: EntityTable<Alert, 'id'>
  actionLog!: EntityTable<ActionLogEntry, 'id'>
  checkIns!: EntityTable<CheckIn, 'id'>
  scans!: EntityTable<FaceScan, 'id'>
  wearables!: EntityTable<WearableSample, 'id'>
  usScans!: EntityTable<UsScan, 'id'>

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
    // experimental webcam face scans; a new store only, nothing existing changes
    this.version(2).stores({ scans: '++id, crewId, ts' })
    // opt-in consumer wearable data (Haylou Solar 5); shadow mode only, never feeds alerts
    this.version(3).stores({ wearables: '++id, [kind+ts], kind, ts' })
    // guided ultrasound scans (simulated imagery); logged for Ground, never feeds alerts
    this.version(4).stores({ usScans: '++id, crewId, [crewId+exam], ts' })
  }
}

export const db = new ConsoleDB()

export function addReading(r: Reading, d: ConsoleDB = db) {
  return d.readings.add(r)
}

export function readingsFor(crewId: string, metric: MetricId, from: Timestamp, to: Timestamp, d: ConsoleDB = db) {
  return d.readings.where('[crewId+metric+ts]').between([crewId, metric, from], [crewId, metric, to], true, true).toArray()
}

export function wearablesFor(kind: WearableKind, from: Timestamp, to: Timestamp, d: ConsoleDB = db) {
  return d.wearables.where('[kind+ts]').between([kind, from], [kind, to], true, true).toArray()
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
