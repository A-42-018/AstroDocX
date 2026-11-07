import { newBaseline, sdOf, welfordUpdate } from '../engine/baseline'
import type { HourlyFeatures } from './features'

export const FORECAST_WARMUP_HOURS = 48
export const SEASON_LEN = 24

export interface HourlyForecastPoint {
  ts: number
  hour: number
  forecast: number
  lower: number
  upper: number
  actual?: number | null
  outside?: boolean
}

export interface ForecastResult {
  status: 'warmup' | 'ready'
  warmupRemainingHours: number
  points: HourlyForecastPoint[]
  residualSd: number
}

/**
 * Holt-Winters additive triple exponential smoothing with 24-hour daily seasonality.
 * Uses welfordUpdate and sdOf from engine/baseline.ts to maintain a running residual spread
 * and form an expected confidence band (+- 1.96 * SD).
 */
export function forecastHeartRateBand(
  hourly: HourlyFeatures[],
  alpha = 0.2,
  beta = 0.05,
  gamma = 0.2
): ForecastResult {
  // Filter and sort chronologically
  const sorted = [...hourly].sort((a, b) => a.ts - b.ts)
  const valid = sorted.filter((h) => h.hrMean !== null && h.hrMean > 0)

  if (valid.length < FORECAST_WARMUP_HOURS) {
    return {
      status: 'warmup',
      warmupRemainingHours: FORECAST_WARMUP_HOURS - valid.length,
      points: [],
      residualSd: 0,
    }
  }

  // Build regular hourly series, imputing any gap with average for that hour of day
  const hourAverages: number[] = Array(24).fill(0)
  const hourCounts: number[] = Array(24).fill(0)
  for (const h of valid) {
    hourAverages[h.hour] += h.hrMean!
    hourCounts[h.hour]++
  }
  for (let i = 0; i < 24; i++) {
    hourAverages[i] = hourCounts[i] > 0 ? hourAverages[i] / hourCounts[i] : 70
  }

  const series: { ts: number; hour: number; hr: number; actual: number | null }[] = []
  const firstTs = valid[0].ts
  const lastTs = valid[valid.length - 1].ts
  const hourMap = new Map(valid.map((h) => [h.ts, h.hrMean!]))

  for (let t = firstTs; t <= lastTs; t += 3600_000) {
    const hr = hourMap.get(t)
    const hour = new Date(t).getUTCHours()
    series.push({
      ts: t,
      hour,
      hr: hr ?? hourAverages[hour],
      actual: hr ?? null,
    })
  }

  const n = series.length
  if (n < FORECAST_WARMUP_HOURS) {
    return {
      status: 'warmup',
      warmupRemainingHours: FORECAST_WARMUP_HOURS - n,
      points: [],
      residualSd: 0,
    }
  }

  // Initialize level, trend, and seasonal components
  let level = 0
  for (let i = 0; i < SEASON_LEN; i++) level += series[i].hr
  level /= SEASON_LEN

  let trend = 0
  for (let i = 0; i < SEASON_LEN; i++) {
    trend += (series[SEASON_LEN + i].hr - series[i].hr) / SEASON_LEN
  }
  trend /= SEASON_LEN

  const season: number[] = Array(SEASON_LEN).fill(0)
  for (let i = 0; i < SEASON_LEN; i++) {
    season[i] = series[i].hr - level
  }

  // Fit and track residuals with running Welford baseline
  let residualBaseline = newBaseline('wearer', 'hr', firstTs)
  const fitted: { forecast: number; residual: number }[] = []

  for (let t = 0; t < n; t++) {
    const actual = series[t].hr
    const sIdx = t % SEASON_LEN
    const prevSeason = season[sIdx]
    const prevLevel = level
    const prevTrend = trend

    const oneStepForecast = prevLevel + prevTrend + prevSeason
    const residual = actual - oneStepForecast
    fitted.push({ forecast: oneStepForecast, residual })

    // Track residual spread over an effective window of 168 hours (7 days)
    residualBaseline = welfordUpdate(residualBaseline, residual, 168)

    // Update state
    level = alpha * (actual - prevSeason) + (1 - alpha) * (prevLevel + prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend
    season[sIdx] = gamma * (actual - level) + (1 - gamma) * prevSeason
  }

  const residualSd = Math.max(sdOf(residualBaseline), 2.5) // Minimum 2.5 bpm spread floor

  // Generate 24-hour forecast
  const lastTime = series[n - 1].ts
  const forecastPoints: HourlyForecastPoint[] = []

  for (let m = 1; m <= 24; m++) {
    const fTs = lastTime + m * 3600_000
    const fHour = new Date(fTs).getUTCHours()
    const sIdx = (n - 1 + m) % SEASON_LEN
    const pred = Math.round((level + m * trend + season[sIdx]) * 10) / 10
    const lower = Math.round((pred - 1.96 * residualSd) * 10) / 10
    const upper = Math.round((pred + 1.96 * residualSd) * 10) / 10

    const actual = hourMap.get(fTs) ?? null
    const outside = actual !== null ? actual < lower || actual > upper : undefined

    forecastPoints.push({
      ts: fTs,
      hour: fHour,
      forecast: pred,
      lower,
      upper,
      actual,
      outside,
    })
  }

  return {
    status: 'ready',
    warmupRemainingHours: 0,
    points: forecastPoints,
    residualSd: Math.round(residualSd * 10) / 10,
  }
}
