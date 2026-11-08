import { newBaseline, sdOf, welfordUpdate } from '../engine/baseline'
import type { HourlyFeatures } from './features'
import { browserTzOffsetMin, localHour } from './localTime'

/** Hours of history the model needs to learn from (two full daily cycles, for the trend initialisation). */
export const FORECAST_TRAIN_HOURS = 48
/** Length of the checked window: the most recent hours, banded from the data before them. */
export const FORECAST_CHECK_HOURS = 24
/** Hours of data before the band shows: the training span plus the window it is checked against. */
export const FORECAST_WARMUP_HOURS = FORECAST_TRAIN_HOURS + FORECAST_CHECK_HOURS
export const SEASON_LEN = 24

export interface HourlyForecastPoint {
  ts: number
  hour: number
  forecast: number
  lower: number
  upper: number
  /** The wearer's real mean HR in that hour, or null when the watch has no reading for it. */
  actual: number | null
  /** True when the real reading falls outside the band; undefined when there is no reading. */
  outside?: boolean
}

export interface ForecastResult {
  status: 'warmup' | 'ready'
  warmupRemainingHours: number
  points: HourlyForecastPoint[]
  /** Hours in the checked window whose real reading fell outside the band. */
  outsideCount: number
  residualSd: number
}

export interface ForecastOptions {
  alpha?: number
  beta?: number
  gamma?: number
  /** Wearer's offset in minutes east of UTC, for hour-of-day. Default: the browser's. */
  tzOffsetMin?: number
}

const warmup = (have: number): ForecastResult => ({
  status: 'warmup',
  warmupRemainingHours: Math.max(0, FORECAST_WARMUP_HOURS - have),
  points: [],
  outsideCount: 0,
  residualSd: 0,
})

/**
 * Holt-Winters additive triple exponential smoothing with 24-hour daily seasonality.
 * The model is fitted on every hour before the most recent FORECAST_CHECK_HOURS, then forecasts those hours, so the
 * band can be compared with what actually happened: real readings outside it are "unusual for this time of day".
 * Uses welfordUpdate and sdOf from engine/baseline.ts for the running residual spread (band = ±1.96 SD).
 */
export function forecastHeartRateBand(hourly: HourlyFeatures[], opts: ForecastOptions = {}): ForecastResult {
  const { alpha = 0.2, beta = 0.05, gamma = 0.2 } = opts
  const tz = opts.tzOffsetMin ?? browserTzOffsetMin()
  const sorted = [...hourly].sort((a, b) => a.ts - b.ts)
  const valid = sorted.filter((h) => h.hrMean !== null && h.hrMean > 0)

  if (valid.length < FORECAST_WARMUP_HOURS) return warmup(valid.length)

  // Build a regular hourly series, imputing any gap with the average for that hour of day
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
    const hour = localHour(t, tz)
    series.push({ ts: t, hour, hr: hr ?? hourAverages[hour], actual: hr ?? null })
  }

  const n = series.length
  if (n < FORECAST_WARMUP_HOURS) return warmup(n)
  const trainN = n - FORECAST_CHECK_HOURS

  // Initialise level, trend and seasonal components from the first two days of the training span
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

  // Fit on the training span and track one-step residuals with a running Welford baseline
  let residualBaseline = newBaseline('wearer', 'hr', firstTs)

  for (let t = 0; t < trainN; t++) {
    const actual = series[t].hr
    const sIdx = t % SEASON_LEN
    const prevSeason = season[sIdx]
    const prevLevel = level
    const prevTrend = trend

    const residual = actual - (prevLevel + prevTrend + prevSeason)
    // Track residual spread over an effective window of 168 hours (7 days)
    residualBaseline = welfordUpdate(residualBaseline, residual, 168)

    level = alpha * (actual - prevSeason) + (1 - alpha) * (prevLevel + prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend
    season[sIdx] = gamma * (actual - level) + (1 - gamma) * prevSeason
  }

  const residualSd = Math.max(sdOf(residualBaseline), 2.5) // Minimum 2.5 bpm spread floor

  // Forecast the checked window from the end of the training span and compare with the real hours
  const points: HourlyForecastPoint[] = []
  let outsideCount = 0
  for (let m = 1; m <= FORECAST_CHECK_HOURS; m++) {
    const row = series[trainN - 1 + m]
    const sIdx = (trainN - 1 + m) % SEASON_LEN
    const pred = Math.round((level + m * trend + season[sIdx]) * 10) / 10
    const lower = Math.round((pred - 1.96 * residualSd) * 10) / 10
    const upper = Math.round((pred + 1.96 * residualSd) * 10) / 10
    const actual = row.actual
    const outside = actual !== null ? actual < lower || actual > upper : undefined
    if (outside) outsideCount++
    points.push({ ts: row.ts, hour: row.hour, forecast: pred, lower, upper, actual, outside })
  }

  return {
    status: 'ready',
    warmupRemainingHours: 0,
    points,
    outsideCount,
    residualSd: Math.round(residualSd * 10) / 10,
  }
}
