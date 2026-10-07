import { ConsoleDB, db } from '../data/db'
import type { Alert, MetricId, Reading } from '../data/types'

export interface TrendData {
  crewId: string
  now: number
  readings: Partial<Record<MetricId, Reading[]>>
  alerts: Alert[]
}

/** Full reading history for one crew member (the band needs the samples before the visible range) plus all their alerts. */
export async function loadTrendData(crewId: string, d: ConsoleDB = db): Promise<TrendData> {
  const [rows, alerts, last] = await Promise.all([
    d.readings.where('crewId').equals(crewId).toArray(),
    d.alerts.where('crewId').equals(crewId).toArray(),
    d.readings.orderBy('ts').last(),
  ])
  rows.sort((a, b) => a.ts - b.ts)
  const readings: TrendData['readings'] = {}
  for (const r of rows) (readings[r.metric] ??= []).push(r)
  return { crewId, now: last?.ts ?? 0, readings, alerts }
}
