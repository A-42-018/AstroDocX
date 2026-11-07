import { describe, expect, it } from 'vitest'
import type { WearableSample } from '../data/types'
import { extractDailyFeatures, extractHourlyFeatures, percentile } from './features'

describe('features extraction', () => {
  it('computes percentiles accurately', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    expect(percentile(arr, 0.1)).toBe(10)
    expect(percentile(arr, 0.5)).toBe(50)
    expect(percentile(arr, 0.9)).toBe(90)
    expect(percentile([], 0.5)).toBeNull()
  })

  it('aggregates hourly features', () => {
    const t0 = Date.UTC(2026, 10, 7, 10, 0, 0)
    const samples: WearableSample[] = [
      { id: 1, kind: 'hr', value: 70, ts: t0 + 10_000, source: 'haylou-solar5', live: true },
      { id: 2, kind: 'hr', value: 80, ts: t0 + 30_000, source: 'haylou-solar5', live: true },
      { id: 3, kind: 'spo2', value: 98, ts: t0 + 40_000, source: 'haylou-solar5', live: false },
      { id: 4, kind: 'stress', value: 25, ts: t0 + 50_000, source: 'haylou-solar5', live: false },
    ]

    const hourly = extractHourlyFeatures(samples)
    expect(hourly).toHaveLength(1)
    expect(hourly[0].hrMean).toBe(75)
    expect(hourly[0].hrCount).toBe(2)
    expect(hourly[0].spo2Mean).toBe(98)
    expect(hourly[0].stressMean).toBe(25)
    expect(hourly[0].hour).toBe(10)
  })

  it('flags days with <50% coverage as lowQuality and computes resting HR from night readings', () => {
    const day = Date.UTC(2026, 10, 7)
    // Only 3 hours with data -> coverage < 50%
    const samples: WearableSample[] = [
      // 03:00 UTC (night HR)
      { id: 1, kind: 'hr', value: 55, ts: day + 3 * 3600_000, source: 'haylou-solar5', live: true },
      { id: 2, kind: 'hr', value: 58, ts: day + 3 * 3600_000 + 60_000, source: 'haylou-solar5', live: true },
      // 14:00 UTC (daytime HR)
      { id: 3, kind: 'hr', value: 85, ts: day + 14 * 3600_000, source: 'haylou-solar5', live: true },
      // 15:00 UTC (SpO2)
      { id: 4, kind: 'spo2', value: 92, ts: day + 15 * 3600_000, source: 'haylou-solar5', live: true },
    ]

    const daily = extractDailyFeatures(samples)
    expect(daily).toHaveLength(1)
    expect(daily[0].date).toBe('2026-11-07')
    expect(daily[0].coverageHours).toBe(3)
    expect(daily[0].lowQuality).toBe(true)
    expect(daily[0].restingHr).toBe(55) // from night-time HR
    expect(daily[0].spo2Below94Count).toBe(1)
    expect(daily[0].spo2Min).toBe(92)
  })
})
