import { db, readingsFor, type ConsoleDB } from '../data/db'
import { DAY } from '../data/synthetic'
import type { ActionLogEntry, Alert } from '../data/types'
import { DAILY_METRICS } from '../engine/baseline'
import { buildSeries, type TrendSeries } from '../trends/series'

export interface AlertDetailData {
  alertId: number
  /** The triggering metric around the alert, with its personal band and the crossing point marked. */
  series: TrendSeries
  log: ActionLogEntry[]
}

/** Everything the detail pane needs for one alert: the metric's recent history and the alert's log entries. */
export async function loadAlertDetail(alert: Alert, now: number, d: ConsoleDB = db): Promise<AlertDetailData> {
  const end = alert.resolvedAt ?? now
  // Daily metrics need a longer look-back to show more than a couple of points.
  const before = (DAILY_METRICS.has(alert.metric) ? 10 : 3) * DAY
  const [rows, log] = await Promise.all([
    readingsFor(alert.crewId, alert.metric, 0, end, d),
    d.actionLog.where('alertId').equals(alert.id!).toArray(),
  ])
  rows.sort((a, b) => a.ts - b.ts)
  const rangeMs = end - alert.openedAt + before
  return { alertId: alert.id!, series: buildSeries(rows, [alert], alert.metric, end, rangeMs), log }
}
