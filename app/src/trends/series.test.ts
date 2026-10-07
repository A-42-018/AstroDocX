import { describe, expect, it } from 'vitest'
import { HOUR, DAY } from '../data/synthetic'
import type { Alert, Reading } from '../data/types'
import { alertsForMetric, buildSeries } from './series'

const T0 = 1_000_000 * HOUR
const hourly = (n: number, f: (i: number) => number): Reading[] =>
  Array.from({ length: n }, (_, i) => ({ crewId: 'c', metric: 'hr', value: f(i), ts: T0 + i * HOUR, source: 'wearable' }))
const alert = (o: Partial<Alert>): Alert => ({
  crewId: 'c', ruleId: 'hr', kind: 'baseline', hazard: 'G', metric: 'hr', status: 'watch', peakStatus: 'watch', state: 'open',
  z: 2, value: 90, baselineMean: 62, explanation: '', steps: [], openedAt: T0, ...o,
})

describe('buildSeries', () => {
  const rs = hourly(100, (i) => 60 + (i % 5)) // 60..64, sd ~1.4
  const now = rs[99].ts

  it('keeps only points inside the range', () => {
    const s = buildSeries(rs, [], 'hr', now, DAY)
    expect(s.points).toHaveLength(25)
    expect(s.points[0].ts).toBe(now - DAY)
    expect(s.latest).toBe(rs[99].value)
  })

  it('has no band until enough samples exist, then a band around the baseline mean', () => {
    const s = buildSeries(rs, [], 'hr', now, 100 * HOUR)
    expect(s.points[3].band).toBeNull()
    const p = s.points[60]
    expect(p.band![0]).toBeLessThan(62)
    expect(p.band![1]).toBeGreaterThan(62)
    expect(p.band![1] - p.band![0]).toBeGreaterThan(2)
  })

  it('computes the band from earlier samples only, so a spike is outside its own band', () => {
    const spiky = hourly(80, (i) => (i === 70 ? 95 : 60 + (i % 5)))
    const s = buildSeries(spiky, [], 'hr', spiky[79].ts, 80 * HOUR)
    const spike = s.points.find((p) => p.value === 95)!
    expect(spike.value).toBeGreaterThan(spike.band![1])
    expect(buildSeries(spiky.slice(0, 71), [], 'hr', spiky[70].ts, DAY).outsideBand).toBe(true)
  })

  it('uses history before the visible range to build the band', () => {
    const s = buildSeries(rs, [], 'hr', now, 2 * HOUR)
    expect(s.points[0].band).not.toBeNull()
  })

  it('places alert markers on the plotted point and ignores alerts outside the range', () => {
    const inRange = alert({ openedAt: rs[90].ts + 10, peakStatus: 'act' })
    const old = alert({ openedAt: T0 })
    const s = buildSeries(rs, [inRange, old], 'hr', now, DAY)
    expect(s.markers).toEqual([{ ts: rs[91].ts, value: rs[91].value, status: 'act' }])
  })

  it('returns an empty series for a metric with no readings', () => {
    const s = buildSeries([], [], 'hr', now, DAY)
    expect(s).toMatchObject({ points: [], markers: [], latest: null, outsideBand: false })
  })
})

describe('alertsForMetric', () => {
  const sleep = alert({ ruleId: 'sleep', metric: 'sleep' })
  const combo = alert({ ruleId: 'sleep+reaction', kind: 'combined', metric: 'reaction' })
  it('puts the two-signal alert on both sleep and reaction charts only', () => {
    expect(alertsForMetric([sleep, combo], 'sleep')).toEqual([sleep, combo])
    expect(alertsForMetric([sleep, combo], 'reaction')).toEqual([combo])
    expect(alertsForMetric([sleep, combo], 'hr')).toEqual([])
  })
})
