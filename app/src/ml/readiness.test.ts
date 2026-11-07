import { describe, expect, it } from 'vitest'
import type { CheckIn } from '../data/types'
import type { DailyFeatures } from './features'
import { READINESS_WARMUP_GOOD_DAYS, computeReadiness, pickReadinessDay, solveLinearSystem } from './readiness'

const DAY = 86400_000
const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function mockDay(over: Partial<DailyFeatures> = {}): DailyFeatures {
  const dayStartMs = over.dayStartMs ?? Date.UTC(2026, 10, 7)
  return {
    date: dateOf(dayStartMs),
    dayStartMs,
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

/** A week of normal good days before 2026-11-07. */
const week = () => Array.from({ length: READINESS_WARMUP_GOOD_DAYS }, (_, i) => mockDay({ dayStartMs: Date.UTC(2026, 10, 7) - (i + 1) * DAY }))

describe('readiness model', () => {
  it('stays in warm-up with no score when there is no day to score or too little history', () => {
    const none = computeReadiness(null, week(), [], { tzOffsetMin: 0 })
    expect(none.status).toBe('warmup')
    expect(none.score).toBeNull()
    expect(none.factors).toHaveLength(0)

    const short = computeReadiness(mockDay(), week().slice(0, 3), [], { tzOffsetMin: 0 })
    expect(short.status).toBe('warmup')
    expect(short.warmupRemainingDays).toBe(READINESS_WARMUP_GOOD_DAYS - 3)
    expect(short.score).toBeNull()

    // the scored day does not count toward its own baseline
    const selfOnly = computeReadiness(mockDay(), [...week().slice(0, 6), mockDay()], [], { tzOffsetMin: 0 })
    expect(selfOnly.status).toBe('warmup')
  })

  it('picks the most recent scoreable day, never a future or stale one', () => {
    const now = Date.UTC(2026, 10, 7, 9)
    const yesterday = mockDay({ dayStartMs: Date.UTC(2026, 10, 6) })
    const todayEmpty = mockDay({ dayStartMs: Date.UTC(2026, 10, 7), restingHr: null, sleepHours: null })
    const tomorrow = mockDay({ dayStartMs: Date.UTC(2026, 10, 8) }) // tonight's sleep bucket
    expect(pickReadinessDay([yesterday, todayEmpty, tomorrow], now, 0)?.date).toBe('2026-11-06')
    expect(pickReadinessDay([mockDay({ dayStartMs: Date.UTC(2026, 10, 1) })], now, 0)).toBeNull()
    expect(pickReadinessDay([], now, 0)).toBeNull()
  })

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
    const result = computeReadiness(today, week(), [], { tzOffsetMin: 0 })

    expect(result.status).toBe('ready')
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
    const result = computeReadiness(today, week(), [], { tzOffsetMin: 0 })

    expect(result.score).toBeLessThan(60)
    expect(['reduced', 'low']).toContain(result.level)
  })

  it('activates Version 2 ridge regression when >= 20 check-ins exist', () => {
    const history: DailyFeatures[] = []
    const checkIns: CheckIn[] = []
    const start = Date.UTC(2026, 0, 1)

    for (let i = 0; i < 25; i++) {
      const ts = start + i * DAY
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

    const today = mockDay({ dayStartMs: start + 25 * DAY })
    const result = computeReadiness(today, history, checkIns, { tzOffsetMin: 0 })

    // each check-in pairs with the day before it, so the first one (no previous day) is left out
    expect(result.version).toBe(2)
    expect(result.learnedWeights).toBeDefined()
    expect(result.summary).toContain('calibrated against 24 check-ins')
  })

  it('pairs a check-in with the previous day, not the same day', () => {
    const start = Date.UTC(2026, 0, 1)
    const history = Array.from({ length: 25 }, (_, i) => mockDay({ dayStartMs: start + i * DAY }))
    // only same-day features exist for these check-ins: day i-1 is low quality, so nothing pairs
    const sparse = history.map((d, i) => (i % 2 === 0 ? d : { ...d, lowQuality: true }))
    const checkIns: CheckIn[] = sparse
      .filter((d) => !d.lowQuality)
      .map((d) => ({ crewId: 'cmdr', ts: d.dayStartMs + 12 * 3600_000, mood: 4, sleepQuality: 4, symptoms: [] }))
    const result = computeReadiness(mockDay({ dayStartMs: start + 30 * DAY }), sparse, checkIns, { tzOffsetMin: 0 })
    expect(result.version).toBe(1)
  })
})
