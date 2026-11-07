// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InsightsSection } from './InsightsSection'

const warmupProps = {
  anomaly: {
    status: 'warmup' as const,
    warmupRemainingDays: 10,
    totalGoodDays: 4,
    days: [],
  },
  forecast: {
    status: 'warmup' as const,
    warmupRemainingHours: 24,
    points: [],
    residualSd: 0,
  },
  readiness: {
    score: 82,
    level: 'good' as const,
    version: 1 as const,
    factors: [
      { id: 'sleep' as const, label: 'Sleep Duration & Rest', value: '7.5 h', score: 100, weight: 0.35, impact: 35, explanation: '7.5 h asleep' },
      { id: 'restingHr' as const, label: 'Resting Heart Rate', value: '60 bpm', score: 95, weight: 0.25, impact: 24, explanation: 'Resting rate nominal' },
      { id: 'spo2' as const, label: 'Oxygenation (SpO₂)', value: '98%', score: 100, weight: 0.2, impact: 20, explanation: 'Oxygen stable' },
      { id: 'stress' as const, label: 'Physiological Stress', value: '24', score: 100, weight: 0.2, impact: 20, explanation: 'Recovery state' },
    ],
    summary: 'Readiness 82/100 (good): based on sleep duration, resting HR, oxygenation and stress.',
  },
  agreement: {
    status: 'insufficient_data' as const,
    pairCount: 1,
    bias: null,
    sdDiff: null,
    lowerLoa: null,
    upperLoa: null,
    mae: null,
    pairs: [],
    interpretation: 'Need at least 3 paired face scans and watch readings within ±60s to evaluate agreement.',
  },
}

describe('InsightsSection (Phase 3)', () => {
  it('displays the shadow mode label prominently and shows warm-up notices', () => {
    render(<InsightsSection {...warmupProps} />)

    // Heading exists
    expect(screen.getByRole('heading', { level: 2, name: /Wearable Insights/ })).toBeDefined()

    // Shadow mode disclaimer
    expect(screen.getByRole('note').textContent).toMatch(/Shadow mode · Consumer wearable · Not a diagnosis/i)

    // Warm-up messages for anomaly, forecast, and agreement
    expect(screen.getByText(/Establishing personal baseline: 4 of 14/)).toBeDefined()
    expect(screen.getByText(/Learning daily circadian rhythm: 24 of 48/)).toBeDefined()
    expect(screen.getByText(/Need at least 3 paired face scans/)).toBeDefined()

    // Readiness score is displayed
    expect(screen.getByText('82')).toBeDefined()
    expect(screen.getByText('good')).toBeDefined()
  })

  it('renders anomaly pills and agreement statistics when data is ready', () => {
    const readyProps = {
      ...warmupProps,
      anomaly: {
        status: 'ready' as const,
        warmupRemainingDays: 0,
        totalGoodDays: 14,
        days: [
          { date: '2026-11-06', dayStartMs: 1, isAnomaly: false, anomalyScore: 0.42, robustZScores: {}, contributingFactors: [] },
          { date: '2026-11-07', dayStartMs: 2, isAnomaly: true, anomalyScore: 0.74, robustZScores: {}, contributingFactors: ['Resting HR 8 bpm above your usual'] },
        ],
      },
      agreement: {
        status: 'ready' as const,
        pairCount: 5,
        bias: 1.2,
        sdDiff: 3.4,
        lowerLoa: -5.5,
        upperLoa: 7.9,
        mae: 2.1,
        pairs: [],
        interpretation: 'High agreement: webcam face scans track watch pulse within +1.2 bpm bias.',
      },
    }

    render(<InsightsSection {...readyProps} />)
    expect(screen.getByText('UNUSUAL')).toBeDefined()
    expect(screen.getByText('NOMINAL')).toBeDefined()
    expect(screen.getByText('+1.2 bpm')).toBeDefined()
    expect(screen.getByText(/High agreement/)).toBeDefined()
  })
})
