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

export interface SeriesStats {
  latest: number | null
  /** Mean of the plotted points. */
  mean: number | null
  /** Personal baseline (centre of the latest band) and its sd; null before the band has enough samples. */
  baseline: number | null
  sd: number | null
  /** Latest value against the baseline in signed sd units. */
  sigma: number | null
  /** Share of banded points that sit outside the personal band, 0-100. */
  outsidePct: number
}

export function seriesStats(s: TrendSeries): SeriesStats {
  const vals = s.points.map((p) => p.value)
  const banded = s.points.filter((p) => p.band)
  const last = [...banded].pop()
  const baseline = last?.band ? (last.band[0] + last.band[1]) / 2 : null
  const sd = last?.band ? (last.band[1] - last.band[0]) / 2 / WATCH_Z : null
  const out = banded.filter((p) => p.value < p.band![0] || p.value > p.band![1]).length
  return {
    latest: s.latest,
    mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    baseline, sd,
    sigma: baseline !== null && sd && s.latest !== null ? (s.latest - baseline) / sd : null,
    outsidePct: banded.length ? Math.round((out / banded.length) * 100) : 0,
  }
}

/** Median across the crew at each timestamp they share (needs at least two people). */
export function crewMedian(perCrew: Reading[][]): { ts: number; value: number }[] {
  const byTs = new Map<number, number[]>()
  for (const rows of perCrew) for (const r of rows) (byTs.get(r.ts) ?? byTs.set(r.ts, []).get(r.ts)!).push(r.value)
  const out: { ts: number; value: number }[] = []
  for (const [ts, vs] of byTs) {
    if (vs.length < 2) continue
    vs.sort((a, b) => a - b)
    const m = vs.length >> 1
    out.push({ ts, value: vs.length % 2 ? vs[m] : (vs[m - 1] + vs[m]) / 2 })
  }
  return out.sort((a, b) => a.ts - b.ts)
}

export const trendSummary = (s: TrendSeries) => {
  const def = METRICS[s.metric]
  const latest = s.latest === null ? 'no data' : `${s.latest.toFixed(decimalsFor(s.metric))} ${def.unit}`
  return `${def.label}: latest ${latest}, ${s.outsideBand ? 'outside' : 'inside'} personal band, ${s.markers.length} alert${s.markers.length === 1 ? '' : 's'} in range.`
}

