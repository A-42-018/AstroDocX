import type { FaceScan, WearableSample } from '../data/types'

export interface AgreementPair {
  ts: number
  scanHr: number
  watchHr: number
  diff: number // scanHr - watchHr
  scanQuality: number
}

export interface AgreementReport {
  status: 'insufficient_data' | 'ready'
  pairCount: number
  bias: number | null // mean difference (scan - watch)
  sdDiff: number | null // standard deviation of differences
  lowerLoa: number | null // 95% limits of agreement lower bound (bias - 1.96 * SD)
  upperLoa: number | null // 95% limits of agreement upper bound (bias + 1.96 * SD)
  mae: number | null // mean absolute error in bpm
  pairs: AgreementPair[]
  interpretation: string
}

const MAX_PAIR_TIME_DIFF_MS = 60_000

/** First index in `sorted` (ascending by ts) whose ts is >= `ts`. */
function lowerBound(sorted: WearableSample[], ts: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid].ts < ts) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Perform Bland-Altman agreement analysis between experimental webcam face scans (rPPG)
 * and Haylou watch heart rate readings taken within +-60 seconds of each other.
 */
export function evaluateScanAgreement(
  scans: FaceScan[],
  wearableSamples: WearableSample[]
): AgreementReport {
  const watchHrSamples = wearableSamples
    .filter((w) => w.kind === 'hr' && w.value >= 30 && w.value <= 220)
    .sort((a, b) => a.ts - b.ts)

  const pairs: AgreementPair[] = []

  for (const s of scans) {
    if (s.hr < 30 || s.hr > 220 || s.quality < 0.4) continue

    // Nearest watch HR sample within 60 seconds: binary search to the window start, then walk the window only
    let bestMatch: WearableSample | null = null
    let bestDist = Infinity
    for (let i = lowerBound(watchHrSamples, s.ts - MAX_PAIR_TIME_DIFF_MS); i < watchHrSamples.length; i++) {
      const w = watchHrSamples[i]
      if (w.ts > s.ts + MAX_PAIR_TIME_DIFF_MS) break
      const dist = Math.abs(w.ts - s.ts)
      if (dist < bestDist) {
        bestDist = dist
        bestMatch = w
      }
    }

    if (bestMatch) {
      const diff = s.hr - bestMatch.value
      pairs.push({
        ts: s.ts,
        scanHr: s.hr,
        watchHr: bestMatch.value,
        diff,
        scanQuality: s.quality,
      })
    }
  }

  if (pairs.length < 3) {
    return {
      status: 'insufficient_data',
      pairCount: pairs.length,
      bias: null,
      sdDiff: null,
      lowerLoa: null,
      upperLoa: null,
      mae: null,
      pairs,
      interpretation: `Need at least 3 paired face scans and watch readings within ±60s to evaluate agreement (${pairs.length} found).`,
    }
  }

  // Calculate Bland-Altman statistics
  const diffs = pairs.map((p) => p.diff)
  const n = diffs.length
  const bias = diffs.reduce((a, b) => a + b, 0) / n
  const variance = diffs.reduce((acc, d) => acc + (d - bias) ** 2, 0) / (n - 1)
  const sdDiff = Math.sqrt(Math.max(0, variance))
  const lowerLoa = bias - 1.96 * sdDiff
  const upperLoa = bias + 1.96 * sdDiff
  const mae = diffs.reduce((acc, d) => acc + Math.abs(d), 0) / n

  const biasFormatted = bias >= 0 ? `+${bias.toFixed(1)}` : bias.toFixed(1)
  const interpretation =
    Math.abs(bias) <= 3 && sdDiff <= 6
      ? `High agreement: webcam face scans track watch pulse within ${biasFormatted} bpm bias (95% limits [${lowerLoa.toFixed(1)}, ${upperLoa.toFixed(1)}] bpm).`
      : `Moderate agreement with systematic offset: webcam reads ${biasFormatted} bpm compared to watch (limits [${lowerLoa.toFixed(1)}, ${upperLoa.toFixed(1)}] bpm).`

  return {
    status: 'ready',
    pairCount: n,
    bias: Math.round(bias * 10) / 10,
    sdDiff: Math.round(sdDiff * 10) / 10,
    lowerLoa: Math.round(lowerLoa * 10) / 10,
    upperLoa: Math.round(upperLoa * 10) / 10,
    mae: Math.round(mae * 10) / 10,
    pairs,
    interpretation,
  }
}
