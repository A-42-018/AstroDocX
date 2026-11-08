import { describe, expect, it } from 'vitest'
import type { HourlyFeatures } from './features'
import { FORECAST_CHECK_HOURS, FORECAST_WARMUP_HOURS, forecastHeartRateBand } from './forecast'

const start = Date.UTC(2026, 0, 1)
const diurnal = (hour: number) => Math.round(60 + Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 12)

function series(hours: number, hr: (i: number, hour: number) => number | null = (_i, h) => diurnal(h)): HourlyFeatures[] {
  const out: HourlyFeatures[] = []
  for (let i = 0; i < hours; i++) {
    const hour = i % 24
    out.push({ ts: start + i * 3600_000, hour, hrMean: hr(i, hour), hrCount: 10, spo2Mean: 98, stressMean: 25 })
  }
  return out
}

describe('forecastHeartRateBand', () => {
  it('stays in warm-up until it has the training span plus the checked window', () => {
    const res = forecastHeartRateBand(series(20), { tzOffsetMin: 0 })
    expect(res.status).toBe('warmup')
    expect(res.warmupRemainingHours).toBe(FORECAST_WARMUP_HOURS - 20)
    expect(res.points).toHaveLength(0)
  })

  it('bands the most recent 24 hours and fills in the real readings for them', () => {
    const hourly = series(96)
    const res = forecastHeartRateBand(hourly, { tzOffsetMin: 0 })
    expect(res.status).toBe('ready')
    expect(res.points).toHaveLength(FORECAST_CHECK_HOURS)
    expect(res.residualSd).toBeGreaterThan(0)
    // the checked window is the last 24 hours of the data
    expect(res.points[0].ts).toBe(hourly[96 - 24].ts)
    expect(res.points.at(-1)!.ts).toBe(hourly[95].ts)
    for (const pt of res.points) {
      expect(pt.lower).toBeLessThan(pt.forecast)
      expect(pt.upper).toBeGreaterThan(pt.forecast)
      expect(pt.actual).toBe(diurnal(pt.hour))
      expect(pt.outside).toBe(false)
    }
    expect(res.outsideCount).toBe(0)
  })

  it('flags a real reading far outside the band as unusual, and leaves missing hours without a verdict', () => {
    const hourly = series(96, (i, h) => (i === 90 ? diurnal(h) + 40 : i === 85 ? null : diurnal(h)))
    const res = forecastHeartRateBand(hourly, { tzOffsetMin: 0 })
    const spike = res.points.find((p) => p.ts === start + 90 * 3600_000)!
    expect(spike.outside).toBe(true)
    const gap = res.points.find((p) => p.ts === start + 85 * 3600_000)!
    expect(gap.actual).toBeNull()
    expect(gap.outside).toBeUndefined()
    expect(res.outsideCount).toBe(1)
  })
})
