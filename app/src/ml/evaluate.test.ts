import { describe, expect, it } from 'vitest'
import { generateSyntheticWearerData, runWearableMlEvaluation } from './evaluate'

describe('ml/evaluate', () => {
  it('generates synthetic wearer data with circadian variation and anomalies', () => {
    const dataset = generateSyntheticWearerData(60, 42)
    expect(dataset.totalDays).toBe(60)
    expect(dataset.anomalyDayIndices.size).toBe(9) // 3 fever, 3 hypoxia, 3 insomnia
    expect(dataset.samples.length).toBeGreaterThan(1000)

    // Verify all samples have valid timestamps and values
    for (const sample of dataset.samples.slice(0, 100)) {
      expect(sample.ts).toBeGreaterThan(0)
      expect(sample.value).toBeGreaterThanOrEqual(0)
      expect(['hr', 'spo2', 'stress', 'sleep']).toContain(sample.kind)
    }
  })

  it('runs on-device ML evaluation and achieves high precision, recall, and low false alarms', () => {
    const evalResult = runWearableMlEvaluation(42)

    // Verification targets (walk-forward, out-of-sample):
    // Precision >= 0.80, Recall >= 0.85, False alarms / week <= 1.0
    // Forecast MAE <= 3.5 bpm
    expect(evalResult.anomaly.totalPostWarmupDays).toBe(46) // 60 - 14 baseline days
    expect(evalResult.anomaly.truePositives).toBe(8)
    expect(evalResult.anomaly.falsePositives).toBe(1)
    expect(evalResult.anomaly.falseNegatives).toBe(1)
    expect(evalResult.anomaly.trueNegatives).toBe(36)
    expect(evalResult.anomaly.recall).toBeCloseTo(0.889, 2)
    expect(evalResult.anomaly.precision).toBeCloseTo(0.889, 2)
    expect(evalResult.anomaly.falseAlarmsPerWeek).toBeLessThan(0.5)

    // Forecast MAE
    expect(evalResult.forecast.testHours).toBe(24)
    expect(evalResult.forecast.mae).toBeLessThan(3.0)
    expect(evalResult.forecast.mae).toBeCloseTo(2.66, 1)
  })

  it('holds the targets on a second seed', () => {
    const r = runWearableMlEvaluation(12345)
    expect(r.anomaly.truePositives).toBe(9)
    expect(r.anomaly.falsePositives).toBe(2)
    expect(r.anomaly.falseNegatives).toBe(0)
    expect(r.anomaly.precision).toBeCloseTo(0.818, 2)
    expect(r.anomaly.recall).toBe(1)
    expect(r.anomaly.falseAlarmsPerWeek).toBeLessThanOrEqual(1.0)
    expect(r.forecast.mae).toBeCloseTo(2.7, 1)
  })

  it('is deterministic across identical seeds', () => {
    const evalA = runWearableMlEvaluation(12345)
    const evalB = runWearableMlEvaluation(12345)
    expect(evalA).toEqual(evalB)
  })
})
