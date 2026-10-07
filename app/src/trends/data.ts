import { ConsoleDB, db, readingsFor } from '../data/db'
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

/** One metric for the whole crew over a range, for the "compare with crew median" overlay. */
export async function loadCrewMetric(metric: MetricId, from: number, to: number, d: ConsoleDB = db): Promise<Reading[][]> {
  const crew = await d.crew.toArray()
  return Promise.all(crew.map((c) => readingsFor(c.id, metric, from, to, d)))
}
