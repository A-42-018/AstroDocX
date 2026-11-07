import { rng } from '../data/synthetic'
import type { WearableSample } from '../data/types'
import { SLEEP_STATE } from '../watch/frames'
import { detectAnomalies } from './anomaly'
import { extractDailyFeatures, extractHourlyFeatures } from './features'
import { forecastHeartRateBand } from './forecast'

export interface EvaluationSummary {
  anomaly: {
    precision: number
    recall: number
    falseAlarmsPerWeek: number
    totalPostWarmupDays: number
    truePositives: number
    falsePositives: number
    falseNegatives: number
    trueNegatives: number
  }
  forecast: {
    mae: number // in bpm
    trainingHours: number
    testHours: number
  }
}

export interface SyntheticDataset {
  samples: WearableSample[]
  anomalyDayIndices: Set<number>
  totalDays: number
}

/**
 * Generate synthetic continuous wearer telemetry with circadian rhythms, natural variation,
 * and injected multi-day anomalous episodes (fever, hypoxia, insomnia).
 */
export function generateSyntheticWearerData(
  numDays = 60,
  seed = 42
): SyntheticDataset {
  const prng = rng(seed)
  const samples: WearableSample[] = []
  const anomalyDays = new Set<number>()

  // Injected anomaly episodes (days index >= 14, after warm-up):
  // Episode 1: Days 20, 21, 22 (Fever / Infection: high resting HR, elevated HR mean)
  // Episode 2: Days 35, 36, 37 (Hypoxia / Low SpO2: SpO2 dips < 94%)
  // Episode 3: Days 48, 49, 50 (Severe Insomnia: 3h sleep, frequent wake-ups)
  const feverDays = new Set([20, 21, 22])
  const hypoxiaDays = new Set([35, 36, 37])
  const insomniaDays = new Set([48, 49, 50])

  for (const d of [...feverDays, ...hypoxiaDays, ...insomniaDays]) {
    anomalyDays.add(d)
  }

  const startMs = Date.UTC(2030, 0, 1)

  for (let day = 0; day < numDays; day++) {
    const dayStartMs = startMs + day * 86400_000
    const isFever = feverDays.has(day)
    const isHypoxia = hypoxiaDays.has(day)
    const isInsomnia = insomniaDays.has(day)

    // Base resting HR with day-to-day drift
    const baseRestingHr = 58 + prng.gauss() * 1.5 + (isFever ? 12 : 0)

    // Hourly samples across 24 hours
    for (let h = 0; h < 24; h++) {
      const hourStartMs = dayStartMs + h * 3600_000

      // Diurnal sinusoidal rhythm: trough at 04:00, peak at 16:00
      const circadian = Math.sin(((h - 10) / 24) * 2 * Math.PI) * 10
      const hourlyHrMean = baseRestingHr + (h >= 6 && h <= 22 ? 14 : 0) + circadian + prng.gauss() * 2

      // Push 4-6 HR samples per hour
      for (let s = 0; s < 5; s++) {
        const ts = hourStartMs + s * 600_000
        const hr = Math.round(hourlyHrMean + prng.gauss() * 3)
        samples.push({
          kind: 'hr',
          value: Math.max(45, Math.min(190, hr)),
          ts,
          source: 'haylou-solar5',
          live: false,
        })
      }

      // SpO2 readings (1 per hour)
      let spo2 = 98 + prng.gauss() * 0.6
      if (isHypoxia && (h >= 0 && h <= 7)) {
        spo2 = 91 + prng.gauss() * 1.2 // Hypoxic night
      }
      samples.push({
        kind: 'spo2',
        value: Math.max(80, Math.min(100, Math.round(spo2))),
        ts: hourStartMs + 1800_000,
        source: 'haylou-solar5',
        live: false,
      })

      // Stress readings (1 per hour)
      const stress = (isFever ? 55 : 24) + prng.gauss() * 5
      samples.push({
        kind: 'stress',
        value: Math.max(5, Math.min(99, Math.round(stress))),
        ts: hourStartMs + 2400_000,
        source: 'haylou-solar5',
        live: false,
      })
    }

    // Sleep stages during night hours (23:00 to 07:00 or short insomnia sleep)
    const sleepDurationH = isInsomnia ? 3.0 : 7.8 + prng.gauss() * 0.4
    const sleepStartS = Math.floor(dayStartMs / 1000) // 00:00
    const sleepEndS = sleepStartS + Math.floor(sleepDurationH * 3600)

    samples.push({
      kind: 'sleep',
      value: SLEEP_STATE.enter,
      ts: sleepStartS * 1000,
      source: 'haylou-solar5',
      live: false,
    })

    // Sleep stage segments
    let curS = sleepStartS + 600
    while (curS < sleepEndS - 600) {
      const state = isInsomnia
        ? prng.next() < 0.35 ? SLEEP_STATE.awake : SLEEP_STATE.light
        : prng.next() < 0.25 ? SLEEP_STATE.deep : prng.next() < 0.25 ? SLEEP_STATE.rem : SLEEP_STATE.light
      samples.push({
        kind: 'sleep',
        value: state,
        ts: curS * 1000,
        source: 'haylou-solar5',
        live: false,
      })
      curS += 1800 // 30 min intervals
    }

    samples.push({
      kind: 'sleep',
      value: SLEEP_STATE.exit,
      ts: sleepEndS * 1000,
      source: 'haylou-solar5',
      live: false,
    })
  }

  return { samples, anomalyDayIndices: anomalyDays, totalDays: numDays }
}

/**
 * Run evaluation of on-device ML models against ground-truth synthetic wearer telemetry.
 * Computes precision, recall, and false alarms per week for the anomaly model,
 * and MAE for the 24-hour Holt-Winters forecast.
 */
export function runWearableMlEvaluation(seed = 42): EvaluationSummary {
  const { samples, anomalyDayIndices, totalDays } = generateSyntheticWearerData(60, seed)

  // 1. Evaluate Anomaly Model
  const dailyFeatures = extractDailyFeatures(samples)
  const anomalyReport = detectAnomalies(dailyFeatures, seed)

  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  let postWarmupDays = 0
  let normalPostWarmupDays = 0

  for (let d = 14; d < totalDays; d++) {
    const isGroundTruthAnomaly = anomalyDayIndices.has(d)
    const dayResult = anomalyReport.days[d]
    const modelFlagged = dayResult ? dayResult.isAnomaly : false

    postWarmupDays++
    if (!isGroundTruthAnomaly) normalPostWarmupDays++

    if (isGroundTruthAnomaly && modelFlagged) tp++
    else if (!isGroundTruthAnomaly && modelFlagged) fp++
    else if (isGroundTruthAnomaly && !modelFlagged) fn++
    else tn++
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0
  const falseAlarmsPerWeek = normalPostWarmupDays > 0 ? (fp / normalPostWarmupDays) * 7 : 0

  // 2. Evaluate 24-Hour Forecast Model
  // Use first 30 normal days of hourly data for training, and evaluate on held-out next 24 hours
  const allHourly = extractHourlyFeatures(samples)
  const splitHour = 30 * 24 // 720 hours
  const trainHourly = allHourly.slice(0, splitHour)
  const testHourly = allHourly.slice(splitHour, splitHour + 24)

  const forecastResult = forecastHeartRateBand(trainHourly)

  let absErrorSum = 0
  let count = 0
  for (let i = 0; i < testHourly.length && i < forecastResult.points.length; i++) {
    const pred = forecastResult.points[i].forecast
    const actual = testHourly[i].hrMean
    if (actual !== null) {
      absErrorSum += Math.abs(pred - actual)
      count++
    }
  }

  const forecastMae = count > 0 ? absErrorSum / count : 0

  return {
    anomaly: {
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      falseAlarmsPerWeek: Math.round(falseAlarmsPerWeek * 100) / 100,
      totalPostWarmupDays: postWarmupDays,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      trueNegatives: tn,
    },
    forecast: {
      mae: Math.round(forecastMae * 100) / 100,
      trainingHours: trainHourly.length,
      testHours: count,
    },
  }
}
