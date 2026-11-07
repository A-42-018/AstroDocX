import { describe, expect, it } from 'vitest'
import { generateSyntheticWearerData } from '../ml/evaluate'
import { computeInsights } from './useWearableInsights'

describe('computeInsights', () => {
  const { samples } = generateSyntheticWearerData(20, 7)
  const lastTs = samples.reduce((m, s) => Math.max(m, s.ts), 0)

  it('stays in warm-up for readiness with no wearable data, and never invents a score', () => {
    const { insights } = computeInsights([], [], [], Date.UTC(2026, 10, 7, 9), 0)
    expect(insights.readiness.status).toBe('warmup')
    expect(insights.readiness.score).toBeNull()
    expect(insights.anomaly.status).toBe('warmup')
    expect(insights.forecast.status).toBe('warmup')
  })

  it('scores anomalies on completed days only and reuses the fitted forest while they are unchanged', () => {
    const now = lastTs + 3600_000 // early on the day after the synthetic data ends
    const first = computeInsights(samples, [], [], now, 0)
    expect(first.insights.anomaly.status).toBe('ready')
    const todayKey = new Date(now).toISOString().slice(0, 10)
    expect(first.insights.anomaly.days.every((d) => d.date < todayKey)).toBe(true)

    // a new live sample today changes nothing about completed days: the same report object comes back
    const more = [...samples, { kind: 'hr' as const, value: 80, ts: now, source: 'haylou-solar5' as const, live: true }]
    const second = computeInsights(more, [], [], now, 0, first.cache)
    expect(second.insights.anomaly).toBe(first.insights.anomaly)

    // a change to a completed day refits
    const edited = samples.map((s, i) => (i === 0 ? { ...s, value: s.value + 30 } : s))
    const third = computeInsights(edited, [], [], now, 0, first.cache)
    expect(third.insights.anomaly).not.toBe(first.insights.anomaly)
  })
})
