import { describe, expect, it } from 'vitest'
import { crewMedian, seriesStats, type TrendSeries } from './series'

const pt = (ts: number, value: number, band: [number, number] | null) => ({ ts, value, band })

describe('seriesStats', () => {
  it('reports baseline, sigma and time outside the band', () => {
    const s: TrendSeries = {
      metric: 'hr', markers: [], latest: 74, outsideBand: true,
      points: [pt(1, 60, null), pt(2, 62, [54, 66]), pt(3, 64, [54, 66]), pt(4, 74, [54, 66]), pt(5, 74, [54, 66])],
    }
    const st = seriesStats(s)
    expect(st.baseline).toBe(60)
    expect(st.sd).toBeCloseTo(6 / 1.8, 6)
    expect(st.sigma).toBeCloseTo(14 / (6 / 1.8), 6)
    expect(st.outsidePct).toBe(50)
    expect(st.mean).toBeCloseTo(66.8, 6)
  })

  it('has no baseline before the band exists', () => {
    const st = seriesStats({ metric: 'hr', markers: [], latest: 60, outsideBand: false, points: [pt(1, 60, null)] })
    expect([st.baseline, st.sigma, st.outsidePct]).toEqual([null, null, 0])
  })
})

describe('crewMedian', () => {
  it('takes the median across people at shared timestamps and skips lone points', () => {
    const r = (v: number, ts: number) => ({ crewId: 'x', metric: 'hr' as const, value: v, ts, source: 'wearable' as const })
    const out = crewMedian([[r(60, 1), r(70, 2)], [r(64, 1)], [r(80, 1), r(72, 2), r(10, 3)]])
    expect(out).toEqual([{ ts: 1, value: 64 }, { ts: 2, value: 71 }])
  })
})
