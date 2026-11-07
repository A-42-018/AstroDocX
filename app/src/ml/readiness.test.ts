import { describe, expect, it } from 'vitest'
import type { CheckIn } from '../data/types'
import type { DailyFeatures } from './features'
import { computeReadiness, solveLinearSystem } from './readiness'

function mockDay(over: Partial<DailyFeatures> = {}): DailyFeatures {
  return {
    date: '2026-11-07',
    dayStartMs: Date.UTC(2026, 10, 7),
    coverageHours: 22,
    coveragePct: 22 / 24,
    lowQuality: false,
    hrMean: 64,
    hrSd: 4,
    hrMin: 50,
    hrMax: 90,
    restingHr: 58,
    spo2Mean: 98,
    spo2Min: 96,
    spo2Below94Count: 0,
    stressMean: 22,
    sleepHours: 7.8,
    wakeups: 1,
    ...over,
  }
}

describe('readiness model', () => {
  it('solves linear systems correctly', () => {
    // 2x + y = 5
    // x + 3y = 5 -> x = 2, y = 1
    const A = [[2, 1], [1, 3]]
    const b = [5, 5]
    const x = solveLinearSystem(A, b)
    expect(x[0]).toBeCloseTo(2, 4)
    expect(x[1]).toBeCloseTo(1, 4)
  })

  it('computes transparent Version 1 readiness score', () => {
    const today = mockDay()
    const history = [mockDay(), mockDay(), mockDay()]
    const result = computeReadiness(today, history)

    expect(result.version).toBe(1)
    expect(result.score).toBeGreaterThan(85)
    expect(result.level).toBe('optimal')
    expect(result.factors).toHaveLength(4)
  })

  it('penalizes poor sleep and elevated resting HR in Version 1', () => {
    const today = mockDay({
      sleepHours: 4.5,
      wakeups: 4,
      restingHr: 72, // +14 bpm
      stressMean: 55,
      spo2Below94Count: 2,
    })
    const history = [mockDay(), mockDay(), mockDay()]
    const result = computeReadiness(today, history)

    expect(result.score).toBeLessThan(60)
    expect(['reduced', 'low']).toContain(result.level)
  })

  it('activates Version 2 ridge regression when >= 20 check-ins exist', () => {
    const history: DailyFeatures[] = []
    const checkIns: CheckIn[] = []
    const start = Date.UTC(2026, 0, 1)

    for (let i = 0; i < 25; i++) {
      const ts = start + i * 86400_000
      const d = mockDay({ dayStartMs: ts, restingHr: 58 + (i % 5), sleepHours: 7 + (i % 3) })
      history.push(d)
      checkIns.push({
        crewId: 'cmdr',
        ts: ts + 12 * 3600_000,
        mood: 4,
        sleepQuality: 4,
        symptoms: [],
      })
    }

    const today = mockDay({ dayStartMs: start + 25 * 86400_000 })
    const result = computeReadiness(today, history, checkIns)

    expect(result.version).toBe(2)
    expect(result.learnedWeights).toBeDefined()
    expect(result.summary).toContain('calibrated against 25 check-in reports')
  })
})
