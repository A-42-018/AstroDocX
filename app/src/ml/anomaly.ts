import type { DailyFeatures } from './features'
import { IsolationForest } from './isolationForest'

export const WARMUP_GOOD_DAYS = 14

export interface DayAnomalyResult {
  date: string
  dayStartMs: number
  isAnomaly: boolean
  anomalyScore: number // Isolation Forest score in [0, 1]
  robustZScores: Record<string, number>
  contributingFactors: string[]
}

export interface AnomalyReport {
  status: 'warmup' | 'ready'
  warmupRemainingDays: number
  totalGoodDays: number
  days: DayAnomalyResult[]
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function computeMad(values: number[], med: number): number {
  if (values.length <= 1) return 1.0
  const absDevs = values.map((v) => Math.abs(v - med))
  const rawMad = computeMedian(absDevs)
  // Scale factor 1.4826 makes MAD asymptotically consistent for standard normal distributions
  return Math.max(rawMad * 1.4826, 0.5)
}

interface FeatureStats {
  median: number
  mad: number
  values: number[]
}

type FeatureKey =
  | 'restingHr'
  | 'hrMean'
  | 'hrSd'
  | 'spo2Mean'
  | 'spo2Min'
  | 'spo2Below94Count'
  | 'stressMean'
  | 'sleepHours'
  | 'wakeups'

const FEATURE_KEYS: FeatureKey[] = [
  'restingHr',
  'hrMean',
  'hrSd',
  'spo2Mean',
  'spo2Min',
  'spo2Below94Count',
  'stressMean',
  'sleepHours',
  'wakeups',
]

/** Most recent prior good days used as the baseline for scoring a day (a rolling window, so slow drift is followed). */
export const BASELINE_MAX_DAYS = 60

function featureStats(days: DailyFeatures[]): Record<FeatureKey, FeatureStats> {
  const stats = {} as Record<FeatureKey, FeatureStats>
  for (const k of FEATURE_KEYS) {
    const rawVals: number[] = []
    for (const d of days) {
      const v = d[k]
      if (v !== null && !Number.isNaN(v)) rawVals.push(v)
    }
    const med = computeMedian(rawVals)
    stats[k] = { median: med, mad: computeMad(rawVals, med), values: rawVals }
  }
  return stats
}

/** Robust z-score row (median/MAD of the baseline), missing values imputed with the baseline median. */
function robustRow(d: DailyFeatures, stats: Record<FeatureKey, FeatureStats>): number[] {
  return FEATURE_KEYS.map((k) => {
    const val = d[k]
    const s = stats[k]
    const actualVal = val !== null && !Number.isNaN(val) ? val : s.median
    return (actualVal - s.median) / s.mad
  })
}

/**
 * Detect personal anomalies across daily feature vectors, walking forward like the live model does: each day is
 * scored only against the good days before it (at most BASELINE_MAX_DAYS), with per-feature robust z-scores
 * (median & MAD) and an Isolation Forest fitted on those prior days. A day is scored once it has at least
 * WARMUP_GOOD_DAYS good days before it, so later data never leaks into an earlier day's verdict.
 */
export function detectAnomalies(
  dailyList: DailyFeatures[],
  seed = 42
): AnomalyReport {
  // Only high-quality days (>= 50% coverage) count toward the baseline or get scored
  const goodDays = [...dailyList].filter((d) => !d.lowQuality).sort((a, b) => a.dayStartMs - b.dayStartMs)

  if (goodDays.length <= WARMUP_GOOD_DAYS) {
    return {
      status: 'warmup',
      warmupRemainingDays: WARMUP_GOOD_DAYS + 1 - goodDays.length,
      totalGoodDays: goodDays.length,
      days: [],
    }
  }

  const results: DayAnomalyResult[] = []

  for (let i = WARMUP_GOOD_DAYS; i < goodDays.length; i++) {
    const d = goodDays[i]
    const baseline = goodDays.slice(Math.max(0, i - BASELINE_MAX_DAYS), i)
    const stats = featureStats(baseline)

    const forest = new IsolationForest(100, seed)
    forest.fit(baseline.map((b) => robustRow(b, stats)))
    const isoScore = forest.score(robustRow(d, stats), Math.min(256, baseline.length))
    const robustZ: Record<string, number> = {}
    const factors: string[] = []

    for (const k of FEATURE_KEYS) {
      const val = d[k]
      const s = stats[k]
      if (val !== null && !Number.isNaN(val)) {
        const z = (val - s.median) / s.mad
        robustZ[k] = Math.round(z * 100) / 100

        // Check if this feature is significantly abnormal (|z| >= 1.8)
        if (Math.abs(z) >= 1.8) {
          if (k === 'restingHr') {
            const diff = Math.round(val - s.median)
            factors.push(
              diff > 0
                ? `Resting HR ${diff} bpm above your usual`
                : `Resting HR ${Math.abs(diff)} bpm below your usual`
            )
          } else if (k === 'spo2Min') {
            factors.push(`Minimum SpO₂ dropped to ${val}% (usual ~${Math.round(s.median)}%)`)
          } else if (k === 'spo2Below94Count' && val > 0) {
            factors.push(`${val} SpO₂ reading${val === 1 ? '' : 's'} below 94%`)
          } else if (k === 'sleepHours') {
            const diff = Math.round((s.median - val) * 10) / 10
            factors.push(
              diff > 0
                ? `Sleep ${val.toFixed(1)} h (${diff.toFixed(1)} h below usual)`
                : `Sleep ${val.toFixed(1)} h (${Math.abs(diff).toFixed(1)} h above usual)`
            )
          } else if (k === 'stressMean') {
            const diff = Math.round(val - s.median)
            if (diff > 0) factors.push(`Stress index elevated (${Math.round(val)} vs usual ${Math.round(s.median)})`)
          } else if (k === 'wakeups' && val > s.median + 1) {
            factors.push(`${val} sleep wake-ups (usual ~${Math.round(s.median)})`)
          } else if (k === 'hrMean') {
            const diff = Math.round(val - s.median)
            factors.push(`Average HR ${diff > 0 ? '+' : ''}${diff} bpm from baseline`)
          }
        }
      }
    }

    // A day is flagged if the multi-feature Isolation Forest score is high (>= 0.60), if one feature is extreme
    // (|z| >= 2.5) and the forest agrees a little (>= 0.52), or if two or more features are extreme. The last rule
    // matters out-of-sample: when the baseline barely varies the forest has nothing to split and scores every day ~0.5.
    const extremeCount = Object.values(robustZ).filter((z) => Math.abs(z) >= 2.5).length
    const isAnomaly = isoScore >= 0.60 || (extremeCount > 0 && isoScore >= 0.52) || extremeCount >= 2

    results.push({
      date: d.date,
      dayStartMs: d.dayStartMs,
      isAnomaly,
      anomalyScore: Math.round(isoScore * 1000) / 1000,
      robustZScores: robustZ,
      contributingFactors: factors,
    })
  }

  return {
    status: 'ready',
    warmupRemainingDays: 0,
    totalGoodDays: goodDays.length,
    days: results,
  }
}
