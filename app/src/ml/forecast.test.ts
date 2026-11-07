import { describe, expect, it } from 'vitest'
import type { HourlyFeatures } from './features'
import { forecastHeartRateBand } from './forecast'

describe('forecastHeartRateBand', () => {
  it('stays in warm-up when fewer than 48 hours of data exist', () => {
    const hourly: HourlyFeatures[] = []
    const start = Date.UTC(2026, 0, 1)
    for (let i = 0; i < 20; i++) {
      hourly.push({
        ts: start + i * 3600_000,
        hour: i % 24,
        hrMean: 65,
        hrCount: 5,
        spo2Mean: 98,
        stressMean: 25,
      })
    }

    const res = forecastHeartRateBand(hourly)
    expect(res.status).toBe('warmup')
    expect(res.warmupRemainingHours).toBe(28)
    expect(res.points).toHaveLength(0)
  })

  it('generates a 24h expected band with residual spread after warm-up', () => {
    const hourly: HourlyFeatures[] = []
    const start = Date.UTC(2026, 0, 1)
    // 72 hours of data with daily circadian pattern
    for (let i = 0; i < 72; i++) {
      const hour = i % 24
      // Diurnal rhythm: lower at night, higher in afternoon
      const baseHr = 60 + Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 12
      hourly.push({
        ts: start + i * 3600_000,
        hour,
        hrMean: Math.round(baseHr),
        hrCount: 10,
        spo2Mean: 98,
        stressMean: 25,
      })
    }

    const res = forecastHeartRateBand(hourly)
    expect(res.status).toBe('ready')
    expect(res.points).toHaveLength(24)
    expect(res.residualSd).toBeGreaterThan(0)

    for (const pt of res.points) {
      expect(pt.lower).toBeLessThan(pt.forecast)
      expect(pt.upper).toBeGreaterThan(pt.forecast)
    }
  })
})
