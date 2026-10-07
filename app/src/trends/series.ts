import { newBaseline, sdOf, welfordUpdate, windowFor, WATCH_Z } from '../engine/baseline'
import { HOUR, DAY } from '../data/synthetic'
import { METRICS, type Alert, type MetricId, type Reading, type Status } from '../data/types'

export type RangeId = '24h' | '7d' | '30d'
export const RANGES: { id: RangeId; label: string; ms: number }[] = [
  { id: '24h', label: '24 h', ms: DAY },
  { id: '7d', label: '7 days', ms: 7 * DAY },
  { id: '30d', label: '30 days', ms: 30 * DAY },
]

export interface TrendPoint {
  ts: number
  value: number
  /** Personal band: baseline mean ± the Watch threshold (1.8σ), from the samples before this point. */
  band: [number, number] | null
}

export interface TrendMarker {
  ts: number
  value: number
  status: Exclude<Status, 'nominal'>
}

export interface TrendSeries {
  metric: MetricId
  points: TrendPoint[]
  markers: TrendMarker[]
  latest: number | null
  /** True when the latest point sits outside its personal band. */
  outsideBand: boolean
}

const MIN_BAND_SAMPLES = 8

/** Alerts that belong on a metric's chart: its own rule, plus the two-signal rule on sleep and reaction. */
export const alertsForMetric = (alerts: Alert[], metric: MetricId) =>
  alerts.filter((a) => a.ruleId === metric || (a.kind === 'combined' && (metric === 'sleep' || metric === 'reaction')))

/**
 * Build one chart series. The band is recomputed with the same Welford/EWMA baseline the engine uses
 * (window per metric), but only from samples *before* each point, so a spike never widens its own band.
 * `readings` must be one crew member's readings for this metric, in time order.
 */
export function buildSeries(readings: Reading[], alerts: Alert[], metric: MetricId, now: number, rangeMs: number): TrendSeries {
  const cap = windowFor(metric)
  const from = now - rangeMs
  let b = newBaseline('', metric)
  const points: TrendPoint[] = []
  for (const r of readings) {
    if (r.ts >= from && r.ts <= now) {
      let band: TrendPoint['band'] = null
      if (b.n >= MIN_BAND_SAMPLES) {
        const half = WATCH_Z * sdOf(b)
        band = [b.mean - half, b.mean + half]
      }
      points.push({ ts: r.ts, value: r.value, band })
    }
    if (r.ts <= now) b = welfordUpdate(b, r.value, cap)
  }
  const byTs = new Map(points.map((p) => [p.ts, p.value]))
  const markers: TrendMarker[] = []
  for (const a of alertsForMetric(alerts, metric)) {
    if (a.openedAt < from || a.openedAt > now) continue
    // Snap to the nearest plotted point at or after the alert opened, falling back to the alert's own value.
    const hit = points.find((p) => p.ts >= a.openedAt)
    markers.push({ ts: hit?.ts ?? a.openedAt, value: hit ? byTs.get(hit.ts)! : a.value, status: a.peakStatus })
  }
  const last = points[points.length - 1]
  const outsideBand = !!last?.band && (last.value < last.band[0] || last.value > last.band[1])
  return { metric, points, markers, latest: last?.value ?? null, outsideBand }
}

export const decimalsFor = (m: MetricId) => (METRICS[m].id === 'co2' || METRICS[m].id === 'dose' || METRICS[m].id === 'sleep' ? 1 : METRICS[m].unit === 'mmHg' ? 2 : 0)

/** Hazard-ordered list of the metrics we chart. */
export const CHART_METRICS: MetricId[] = ['dose', 'sleep', 'reaction', 'mood', 'exercise', 'hr', 'hrv', 'co2', 'spo2', 'temp', 'noise']

/** Tick label: hours for 24 h, mission day otherwise. */
export const tickLabel = (ts: number, rangeMs: number, start: number) => {
  const t = ts - start
  const d = Math.floor(t / DAY)
  const h = Math.floor((t % DAY) / HOUR)
  return rangeMs <= DAY ? `${String(h).padStart(2, '0')}:00` : `D${d}`
}
