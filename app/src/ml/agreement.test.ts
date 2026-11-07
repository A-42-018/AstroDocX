import { describe, expect, it } from 'vitest'
import type { FaceScan, WearableSample } from '../data/types'
import { evaluateScanAgreement } from './agreement'

describe('scan agreement (Bland-Altman)', () => {
  it('reports insufficient data when fewer than 3 pairs exist', () => {
    const scans: FaceScan[] = [
      { id: 1, crewId: 'c1', ts: 1000, hr: 72, hrv: 40, resp: 14, quality: 0.9, seconds: 28 },
    ]
    const watch: WearableSample[] = [
      { id: 1, kind: 'hr', value: 70, ts: 1010, source: 'haylou-solar5', live: true },
    ]

    const report = evaluateScanAgreement(scans, watch)
    expect(report.status).toBe('insufficient_data')
    expect(report.pairCount).toBe(1)
    expect(report.bias).toBeNull()
  })

  it('calculates bias, limits of agreement, and MAE for paired readings within 60s', () => {
    const t0 = 1_000_000
    const scans: FaceScan[] = [
      { id: 1, crewId: 'c1', ts: t0, hr: 72, hrv: 40, resp: 14, quality: 0.9, seconds: 28 },
      { id: 2, crewId: 'c1', ts: t0 + 100_000, hr: 76, hrv: 38, resp: 15, quality: 0.85, seconds: 28 },
      { id: 3, crewId: 'c1', ts: t0 + 200_000, hr: 81, hrv: 35, resp: 16, quality: 0.92, seconds: 28 },
      { id: 4, crewId: 'c1', ts: t0 + 300_000, hr: 68, hrv: 45, resp: 13, quality: 0.88, seconds: 28 },
    ]

    const watch: WearableSample[] = [
      { id: 1, kind: 'hr', value: 70, ts: t0 + 2000, source: 'haylou-solar5', live: true }, // diff = +2
      { id: 2, kind: 'hr', value: 75, ts: t0 + 100_500, source: 'haylou-solar5', live: true }, // diff = +1
      { id: 3, kind: 'hr', value: 80, ts: t0 + 201_000, source: 'haylou-solar5', live: true }, // diff = +1
      { id: 4, kind: 'hr', value: 66, ts: t0 + 299_000, source: 'haylou-solar5', live: true }, // diff = +2
    ]

    const report = evaluateScanAgreement(scans, watch)
    expect(report.status).toBe('ready')
    expect(report.pairCount).toBe(4)
    expect(report.bias).toBe(1.5) // (2 + 1 + 1 + 2) / 4 = 1.5
    expect(report.mae).toBe(1.5)
    expect(report.lowerLoa).toBeLessThan(report.bias!)
    expect(report.upperLoa).toBeGreaterThan(report.bias!)
    expect(report.interpretation).toContain('High agreement')
  })
})
