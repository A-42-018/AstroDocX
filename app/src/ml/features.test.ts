import { describe, expect, it } from 'vitest'
import type { WearableSample } from '../data/types'
import { SLEEP_STATE } from '../watch/frames'
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

    const hourly = extractHourlyFeatures(samples, { tzOffsetMin: 0 })
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

    const daily = extractDailyFeatures(samples, { tzOffsetMin: 0 })
    expect(daily).toHaveLength(1)
    expect(daily[0].date).toBe('2026-11-07')
    expect(daily[0].coverageHours).toBe(3)
    expect(daily[0].lowQuality).toBe(true)
    expect(daily[0].restingHr).toBe(55) // from night-time HR
    expect(daily[0].spo2Below94Count).toBe(1)
    expect(daily[0].spo2Min).toBe(92)
  })
})

describe('features in local time', () => {
  const tz = 360 // UTC+6
  const sample = (kind: WearableSample['kind'], value: number, ts: number): WearableSample => ({ kind, value, ts, source: 'haylou-solar5', live: false })

  it('uses the local night (00:00-06:00 local) for resting HR and buckets by local day', () => {
    // 2026-11-07 02:00 local (UTC+6) is 2026-11-06 20:00 UTC
    const localMidnight = Date.UTC(2026, 10, 7) - tz * 60_000
    const samples = [
      sample('hr', 52, localMidnight + 2 * 3600_000),   // local night
      sample('hr', 90, localMidnight + 9 * 3600_000),   // 03:00 UTC, but local morning
      sample('hr', 95, localMidnight + 10 * 3600_000),
    ]
    const daily = extractDailyFeatures(samples, { tzOffsetMin: tz })
    expect(daily).toHaveLength(1)
    expect(daily[0].date).toBe('2026-11-07')
    expect(daily[0].dayStartMs).toBe(localMidnight)
    expect(daily[0].restingHr).toBe(52)
    // the same data read as UTC splits over two days and takes the morning as "night"
    const utc = extractDailyFeatures(samples, { tzOffsetMin: 0 })
    expect(utc.map((d) => d.date)).toEqual(['2026-11-06', '2026-11-07'])
    expect(utc[1].restingHr).toBe(90)
  })

  it('keeps a night that crosses local midnight in one sleep session, on the wake-up day', () => {
    const localMidnight = Date.UTC(2026, 10, 7) - tz * 60_000
    const s = (h: number) => localMidnight + h * 3600_000
    const samples = [
      sample('sleep', SLEEP_STATE.enter, s(-1)), // 23:00 local the day before
      sample('sleep', SLEEP_STATE.light, s(-0.5)),
      sample('sleep', SLEEP_STATE.deep, s(3)),
      sample('sleep', SLEEP_STATE.exit, s(7)), // 07:00 local
    ]
    const daily = extractDailyFeatures(samples, { tzOffsetMin: tz })
    const wakeDay = daily.find((d) => d.date === '2026-11-07')!
    expect(wakeDay.sleepHours).toBeCloseTo(7.5, 1)
  })

  it('reports local hours in hourly features', () => {
    const t = Date.UTC(2026, 10, 7, 3, 15)
    const [h] = extractHourlyFeatures([sample('hr', 70, t)], { tzOffsetMin: tz })
    expect(h.hour).toBe(9)
    expect(h.ts).toBe(Date.UTC(2026, 10, 7, 3, 0))
  })
})
