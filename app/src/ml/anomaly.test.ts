import { describe, expect, it } from 'vitest'
import { computeMad, computeMedian, detectAnomalies, type AnomalyReport } from './anomaly'
import type { DailyFeatures } from './features'

function mockDay(date: string, dayStartMs: number, over: Partial<DailyFeatures> = {}): DailyFeatures {
  return {
    date,
    dayStartMs,
    coverageHours: 20,
    coveragePct: 20 / 24,
    lowQuality: false,
    hrMean: 65,
    hrSd: 4,
    hrMin: 50,
    hrMax: 95,
    restingHr: 58,
    spo2Mean: 98,
    spo2Min: 96,
    spo2Below94Count: 0,
    stressMean: 25,
    sleepHours: 7.5,
    wakeups: 1,
    ...over,
  }
}

describe('anomaly detection', () => {
  it('calculates median and MAD accurately', () => {
    const vals = [10, 12, 11, 13, 12, 100]
    const med = computeMedian(vals)
    expect(med).toBe(12)
    const mad = computeMad(vals, med)
    expect(mad).toBeGreaterThan(0)
  })

  it('stays in warm-up until 14 good-quality days exist', () => {
    const days: DailyFeatures[] = []
    const start = Date.UTC(2026, 0, 1)
    for (let i = 0; i < 10; i++) {
      days.push(mockDay(`2026-01-${String(i + 1).padStart(2, '0')}`, start + i * 86400_000))
    }

    const report: AnomalyReport = detectAnomalies(days)
    expect(report.status).toBe('warmup')
    expect(report.warmupRemainingDays).toBe(4)
    expect(report.days).toHaveLength(0)
  })

  it('detects an injected anomaly day with elevated resting HR and low SpO2 after warm-up', () => {
    const days: DailyFeatures[] = []
    const start = Date.UTC(2026, 0, 1)
    for (let i = 0; i < 20; i++) {
      days.push(mockDay(`2026-01-${String(i + 1).padStart(2, '0')}`, start + i * 86400_000))
    }

    // Inject fever-like anomaly on day 15
    days[14] = mockDay('2026-01-15', start + 14 * 86400_000, {
      restingHr: 72, // +14 bpm
      hrMean: 80,
      spo2Min: 91,
      spo2Below94Count: 4,
    })

    const report = detectAnomalies(days)
    expect(report.status).toBe('ready')
    expect(report.days).toHaveLength(20)

    const anomalousDay = report.days[14]
    expect(anomalousDay.isAnomaly).toBe(true)
    expect(anomalousDay.contributingFactors.some((f) => f.includes('Resting HR'))).toBe(true)
    expect(anomalousDay.contributingFactors.some((f) => f.includes('SpO₂'))).toBe(true)
  })
})
