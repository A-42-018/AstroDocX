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

/**
 * Detect personal anomalies across daily feature vectors.
 * Combines per-feature robust z-scores (median & MAD) with an Isolation Forest.
 * Requires 14 good-quality days before taking the model out of warm-up.
 */
export function detectAnomalies(
  dailyList: DailyFeatures[],
  seed = 42
): AnomalyReport {
  // Only high-quality days (>= 50% coverage) count toward the baseline
  const goodDays = dailyList.filter((d) => !d.lowQuality)

  if (goodDays.length < WARMUP_GOOD_DAYS) {
    return {
      status: 'warmup',
      warmupRemainingDays: WARMUP_GOOD_DAYS - goodDays.length,
      totalGoodDays: goodDays.length,
      days: [],
    }
  }

  // 1. Gather distributions across good days
  const stats: Record<FeatureKey, FeatureStats> = {} as Record<FeatureKey, FeatureStats>
  for (const k of FEATURE_KEYS) {
    const rawVals: number[] = []
    for (const d of goodDays) {
      const v = d[k]
      if (v !== null && !Number.isNaN(v)) {
        rawVals.push(v)
      }
    }
    const med = computeMedian(rawVals)
    const mad = computeMad(rawVals, med)
    stats[k] = { median: med, mad, values: rawVals }
  }

  // 2. Prepare feature matrix for Isolation Forest
  const X: number[][] = []
  for (const d of goodDays) {
    const row: number[] = []
    for (const k of FEATURE_KEYS) {
      const val = d[k]
      const s = stats[k]
      const actualVal = val !== null && !Number.isNaN(val) ? val : s.median
      // Standardize with robust z-score so all dimensions are comparable in the tree splits
      row.push((actualVal - s.median) / s.mad)
    }
    X.push(row)
  }

  // 3. Train Isolation Forest
  const forest = new IsolationForest(100, seed)
  forest.fit(X)
  const forestScores = forest.scores(X)

  // 4. Build results and human-readable factor explanations
  const results: DayAnomalyResult[] = []

  for (let i = 0; i < goodDays.length; i++) {
    const d = goodDays[i]
    const isoScore = forestScores[i]
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

    // A day is flagged if the multi-feature Isolation Forest score is high (>= 0.60)
    // or if an extreme single feature anomaly (|z| >= 2.5) occurs
    const hasExtremeZ = Object.values(robustZ).some((z) => Math.abs(z) >= 2.5)
    const isAnomaly = isoScore >= 0.60 || (hasExtremeZ && isoScore >= 0.52)

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
