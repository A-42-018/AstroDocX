import { METRICS, type Baseline, type MetricId, type Status, type Timestamp } from '../data/types'

/** Same thresholds as the landing-page simulator (landing/sim.js). Illustrative, cited in C4. */
export const WATCH_Z = 1.8
export const ACT_Z = 3.0
export const HYST = 0.4
export const EWMA_ALPHA = 0.5

/** Effective baseline window (samples): 7 days of hourly metrics, 21 days of daily metrics. */
export const DAILY_METRICS: ReadonlySet<MetricId> = new Set<MetricId>(['sleep', 'exercise', 'reaction', 'mood'])
export const windowFor = (m: MetricId) => (DAILY_METRICS.has(m) ? 21 : 168)
/** Samples needed before a baseline is trusted; until then status stays nominal. */
export const warmupFor = (m: MetricId) => (DAILY_METRICS.has(m) ? 14 : 48)

export function newBaseline(crewId: string, metric: MetricId, ts: Timestamp = 0): Baseline {
  return { crewId, metric, n: 0, mean: 0, m2: 0, ewma: 0, status: 'nominal', updatedAt: ts }
}

/**
 * Welford update. Once n reaches `cap` the baseline turns into an exponentially weighted
 * mean/variance with effective window `cap`, so it follows slow, healthy change.
 */
export function welfordUpdate(b: Baseline, x: number, cap: number): Baseline {
  if (b.n < cap) {
    const n = b.n + 1
    const delta = x - b.mean
    const mean = b.mean + delta / n
    return { ...b, n, mean, m2: b.m2 + delta * (x - mean) }
  }
  const a = 1 / cap
  const delta = x - b.mean
  const variance = b.m2 / (b.n - 1)
  const nextVar = (1 - a) * (variance + a * delta * delta)
  return { ...b, mean: b.mean + a * delta, m2: nextVar * (b.n - 1) }
}

export function sdOf(b: Baseline): number {
  const sd = b.n > 1 ? Math.sqrt(Math.max(b.m2, 0) / (b.n - 1)) : 0
  // Floor avoids huge z-scores from a near-constant history.
  return Math.max(sd, 0.02 * Math.abs(b.mean), 1e-6)
}

/** Distance from baseline in sd units, positive in the metric's "bad" direction. */
export function rawZ(b: Baseline, x: number): number {
  const z = (x - b.mean) / sdOf(b)
  const bad = METRICS[b.metric].bad
  return bad === 0 ? Math.abs(z) : z * bad
}

export const ewma = (prev: number, raw: number, alpha = EWMA_ALPHA) => prev * (1 - alpha) + raw * alpha

const RANK: Record<Status, number> = { nominal: 0, watch: 1, act: 2 }

/** Threshold classification with hysteresis on the way down (a tile must fall 0.4σ below its threshold to step down). */
export function classify(z: number, prev: Status): Status {
  let next: Status = z >= ACT_Z ? 'act' : z >= WATCH_Z ? 'watch' : 'nominal'
  if (RANK[next] < RANK[prev]) {
    const hold = prev === 'act' ? ACT_Z - HYST : WATCH_Z - HYST
    if (z > hold) next = prev
  }
  return next
}

export interface StepResult {
  baseline: Baseline
  /** Smoothed z used for status. */
  z: number
  rawZ: number
  status: Status
  /** False while the baseline is still warming up. */
  scored: boolean
}

/**
 * Process one reading. The value is scored against the baseline *before* it is learned, and a
 * reading is only learned while the metric is nominal, so a developing problem cannot
 * drag the baseline toward itself and hide.
 */
export function step(b: Baseline, x: number, ts: Timestamp): StepResult {
  const metric = b.metric
  if (b.n < warmupFor(metric)) {
    return { baseline: { ...welfordUpdate(b, x, windowFor(metric)), updatedAt: ts }, z: 0, rawZ: 0, status: 'nominal', scored: false }
  }
  const raw = rawZ(b, x)
  const z = ewma(b.ewma, raw)
  const status = classify(z, b.status)
  const learned = status === 'nominal' ? welfordUpdate(b, x, windowFor(metric)) : b
  return { baseline: { ...learned, ewma: z, status, updatedAt: ts }, z, rawZ: raw, status, scored: true }
}
