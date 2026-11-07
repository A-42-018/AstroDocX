import type { CheckIn } from '../data/types'
import type { DailyFeatures } from './features'

export interface ReadinessFactor {
  id: 'restingHr' | 'sleep' | 'spo2' | 'stress'
  label: string
  value: string
  score: number // 0-100 subscore
  weight: number // 0-1 weight in composite
  impact: number // score * weight
  explanation: string
}

export interface ReadinessResult {
  score: number // 0-100
  level: 'optimal' | 'good' | 'reduced' | 'low'
  version: 1 | 2
  factors: ReadinessFactor[]
  learnedWeights?: Record<string, number>
  summary: string
}

export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]])

  // Forward elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k
      }
    }
    const temp = M[i]
    M[i] = M[maxRow]
    M[maxRow] = temp

    if (Math.abs(M[i][i]) < 1e-12) continue

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i]
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j]
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n]
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j]
    }
    x[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0
  }

  return x
}

/**
 * Compute personal daily readiness score.
 * Version 1: Transparent clinical weighting (sleep 35%, resting HR 25%, SpO2 20%, stress 20%).
 * Version 2: Trained on device via ridge regression once >= 20 check-ins are recorded.
 */
export function computeReadiness(
  today: DailyFeatures,
  history: DailyFeatures[],
  checkIns: CheckIn[] = []
): ReadinessResult {
  const goodHistory = history.filter((d) => !d.lowQuality)

  // Medians for baseline comparison
  const medianRestingHr = medianOf(goodHistory.map((d) => d.restingHr).filter((x): x is number => x !== null)) ?? 65
  const medianSleep = medianOf(goodHistory.map((d) => d.sleepHours).filter((x): x is number => x !== null)) ?? 7.5
  const medianStress = medianOf(goodHistory.map((d) => d.stressMean).filter((x): x is number => x !== null)) ?? 30
  const medianSpo2 = medianOf(goodHistory.map((d) => d.spo2Mean).filter((x): x is number => x !== null)) ?? 98

  // Check if Version 2 (>= 20 check-ins) is eligible
  const pairedData: { x: number[]; y: number }[] = []
  for (const c of checkIns) {
    // Find daily features preceding or on the day of this check-in
    const cDayStart = Math.floor(c.ts / 86400_000) * 86400_000
    const matched = goodHistory.find((d) => Math.abs(d.dayStartMs - cDayStart) < 86400_000)
    if (matched && matched.restingHr !== null && matched.sleepHours !== null && matched.stressMean !== null && matched.spo2Mean !== null) {
      const y = ((c.mood + c.sleepQuality) / 10) * 100 // composite self-report 20-100
      pairedData.push({
        x: [
          1, // bias
          matched.restingHr - medianRestingHr,
          matched.sleepHours - medianSleep,
          matched.spo2Mean - medianSpo2,
          matched.stressMean - medianStress,
        ],
        y,
      })
    }
  }

  if (pairedData.length >= 20) {
    // Train Ridge Regression: (X^T X + lambda * I) w = X^T y
    const d = 5
    const lambda = 1.0
    const XtX: number[][] = Array(d).fill(0).map(() => Array(d).fill(0))
    const Xty: number[] = Array(d).fill(0)

    for (const p of pairedData) {
      for (let i = 0; i < d; i++) {
        Xty[i] += p.x[i] * p.y
        for (let j = 0; j < d; j++) {
          XtX[i][j] += p.x[i] * p.x[j]
        }
      }
    }
    // Add ridge penalty (don't penalize bias term at index 0)
    for (let i = 1; i < d; i++) {
      XtX[i][i] += lambda
    }

    const weights = solveLinearSystem(XtX, Xty)

    // Predict for today
    const currentRestingHr = today.restingHr ?? medianRestingHr
    const currentSleep = today.sleepHours ?? medianSleep
    const currentSpo2 = today.spo2Mean ?? medianSpo2
    const currentStress = today.stressMean ?? medianStress

    const xToday = [
      1,
      currentRestingHr - medianRestingHr,
      currentSleep - medianSleep,
      currentSpo2 - medianSpo2,
      currentStress - medianStress,
    ]

    let rawScore = 0
    for (let i = 0; i < d; i++) rawScore += weights[i] * xToday[i]
    const finalScore = Math.max(10, Math.min(100, Math.round(rawScore)))

    const learnedWeights = {
      restingHrWeight: Math.round(weights[1] * 100) / 100,
      sleepWeight: Math.round(weights[2] * 100) / 100,
      spo2Weight: Math.round(weights[3] * 100) / 100,
      stressWeight: Math.round(weights[4] * 100) / 100,
    }

    return {
      score: finalScore,
      level: scoreLevel(finalScore),
      version: 2,
      factors: buildVersion1Factors(today, medianRestingHr, medianSleep, medianStress),
      learnedWeights,
      summary: `Personalized readiness score (${finalScore}/100) calibrated against ${pairedData.length} check-in reports.`,
    }
  }

  // Version 1: Transparent clinically inspired formula
  const factors = buildVersion1Factors(today, medianRestingHr, medianSleep, medianStress)
  const totalScore = Math.max(
    5,
    Math.min(100, Math.round(factors.reduce((acc, f) => acc + f.impact, 0)))
  )

  return {
    score: totalScore,
    level: scoreLevel(totalScore),
    version: 1,
    factors,
    summary: `Readiness ${totalScore}/100 (${scoreLevel(totalScore)}): based on sleep duration, resting HR, oxygenation and stress.`,
  }
}

function buildVersion1Factors(
  today: DailyFeatures,
  medHr: number,
  medSleep: number,
  medStress: number
): ReadinessFactor[] {
  // 1. Resting HR (25%): 100 if at or below median, -5 per bpm above
  const restingHr = today.restingHr ?? medHr
  const hrDiff = restingHr - medHr
  const hrScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, hrDiff) * 5)))

  // 2. Sleep duration (35%): target 7.5 - 8.5h
  const sleep = today.sleepHours ?? medSleep
  let sleepScore = 100
  if (sleep < 7.5) {
    sleepScore = Math.max(0, Math.round(100 - (7.5 - sleep) * 22))
  } else if (sleep > 9.5) {
    sleepScore = Math.max(0, Math.round(100 - (sleep - 9.5) * 15))
  }
  if ((today.wakeups ?? 0) > 1) {
    sleepScore = Math.max(0, sleepScore - ((today.wakeups ?? 0) - 1) * 6)
  }

  // 3. SpO2 (20%): target >= 97%
  const spo2 = today.spo2Mean ?? 98
  let spo2Score = 100
  if (spo2 < 97) {
    spo2Score = Math.max(0, Math.round(100 - (97 - spo2) * 18))
  }
  if (today.spo2Below94Count > 0) {
    spo2Score = Math.max(0, spo2Score - today.spo2Below94Count * 10)
  }

  // 4. Stress (20%): target <= 25
  const stress = today.stressMean ?? medStress
  let stressScore = 100
  if (stress > 25) {
    stressScore = Math.max(0, Math.round(100 - (stress - 25) * 1.6))
  }

  return [
    {
      id: 'sleep',
      label: 'Sleep Duration & Rest',
      value: today.sleepHours !== null ? `${today.sleepHours} h` : 'No data',
      score: sleepScore,
      weight: 0.35,
      impact: Math.round(sleepScore * 0.35),
      explanation:
        today.sleepHours !== null
          ? `${today.sleepHours} h asleep (${today.wakeups ?? 0} wakeups)`
          : 'Baseline default sleep applied',
    },
    {
      id: 'restingHr',
      label: 'Resting Heart Rate',
      value: today.restingHr !== null ? `${today.restingHr} bpm` : 'No data',
      score: hrScore,
      weight: 0.25,
      impact: Math.round(hrScore * 0.25),
      explanation:
        hrDiff > 0
          ? `${Math.round(hrDiff)} bpm above usual baseline (${Math.round(medHr)})`
          : 'Resting rate nominal or relaxed',
    },
    {
      id: 'spo2',
      label: 'Oxygenation (SpO₂)',
      value: today.spo2Mean !== null ? `${today.spo2Mean}%` : 'No data',
      score: spo2Score,
      weight: 0.2,
      impact: Math.round(spo2Score * 0.2),
      explanation:
        today.spo2Below94Count > 0
          ? `${today.spo2Below94Count} dips below 94% recorded`
          : 'Overnight oxygen saturation stable',
    },
    {
      id: 'stress',
      label: 'Physiological Stress',
      value: today.stressMean !== null ? `${Math.round(today.stressMean)}` : 'No data',
      score: stressScore,
      weight: 0.2,
      impact: Math.round(stressScore * 0.2),
      explanation:
        stress > 35
          ? `Elevated stress index (${Math.round(stress)})`
          : 'Autonomic nervous system in recovery state',
    },
  ]
}

function scoreLevel(score: number): 'optimal' | 'good' | 'reduced' | 'low' {
  if (score >= 85) return 'optimal'
  if (score >= 70) return 'good'
  if (score >= 50) return 'reduced'
  return 'low'
}

function medianOf(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
