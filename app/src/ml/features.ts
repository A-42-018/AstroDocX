import type { WearableSample } from '../data/types'
import { SLEEP_STATE, summarizeSleep, type SleepPoint } from '../watch/frames'
import { browserTzOffsetMin, localDay, localHour, localHourStart, sleepDay } from './localTime'

/** Options shared by the feature extractors. */
export interface FeatureOptions {
  /** Wearer's offset in minutes east of UTC; days, hours and the night window use local time. Default: the browser's. */
  tzOffsetMin?: number
}

export interface HourlyFeatures {
  ts: number // epoch ms at the start of the local hour
  hour: number // local hour of day, 0-23
  hrMean: number | null
  hrCount: number
  spo2Mean: number | null
  stressMean: number | null
}

export interface DailyFeatures {
  date: string // 'YYYY-MM-DD'
  dayStartMs: number
  coverageHours: number // number of distinct hours with readings (0-24)
  coveragePct: number // coverageHours / 24 (0 to 1)
  lowQuality: boolean // true when coveragePct < 0.5
  hrMean: number | null
  hrSd: number | null
  hrMin: number | null
  hrMax: number | null
  restingHr: number | null // 10th percentile of night-time HR (00:00 - 06:00 local)
  spo2Mean: number | null
  spo2Min: number | null
  spo2Below94Count: number
  stressMean: number | null
  sleepHours: number | null // asleep hours from sleep points
  wakeups: number | null // count of awakenings
}

/** Compute the p-th percentile (0 <= p <= 1) of a sorted array of numbers. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0]
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))))
  return sorted[idx]
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function stdDev(nums: number[], avg: number): number | null {
  if (nums.length <= 1) return 0
  const v = nums.reduce((acc, x) => acc + (x - avg) ** 2, 0) / (nums.length - 1)
  return Math.sqrt(Math.max(0, v))
}

/**
 * Group raw wearable samples into hourly feature vectors.
 */
export function extractHourlyFeatures(samples: WearableSample[], opts: FeatureOptions = {}): HourlyFeatures[] {
  const tz = opts.tzOffsetMin ?? browserTzOffsetMin()
  const hoursMap = new Map<number, { hr: number[]; spo2: number[]; stress: number[] }>()

  for (const s of samples) {
    const hourStartMs = localHourStart(s.ts, tz)
    let bucket = hoursMap.get(hourStartMs)
    if (!bucket) {
      bucket = { hr: [], spo2: [], stress: [] }
      hoursMap.set(hourStartMs, bucket)
    }
    if (s.kind === 'hr' && s.value > 0) bucket.hr.push(s.value)
    else if (s.kind === 'spo2' && s.value > 0) bucket.spo2.push(s.value)
    else if (s.kind === 'stress' && s.value >= 0) bucket.stress.push(s.value)
  }

  const result: HourlyFeatures[] = []
  const sortedHourStarts = [...hoursMap.keys()].sort((a, b) => a - b)

  for (const ts of sortedHourStarts) {
    const b = hoursMap.get(ts)!
    const hrM = mean(b.hr)
    const spo2M = mean(b.spo2)
    const stressM = mean(b.stress)
    const hour = localHour(ts, tz)

    result.push({
      ts,
      hour,
      hrMean: hrM !== null ? Math.round(hrM * 10) / 10 : null,
      hrCount: b.hr.length,
      spo2Mean: spo2M !== null ? Math.round(spo2M * 10) / 10 : null,
      stressMean: stressM !== null ? Math.round(stressM * 10) / 10 : null,
    })
  }

  return result
}

/**
 * Extract daily feature vectors from raw wearable rows.
 * Computes coverage, HR distribution, resting HR (10th percentile of 00:00-06:00 local time),
 * SpO2 stats, stress stats, and sleep metrics. Days with <50% coverage are flagged lowQuality.
 * Sleep points go to the local day the wearer wakes up on, so a night is never split at midnight.
 */
export function extractDailyFeatures(samples: WearableSample[], opts: FeatureOptions = {}): DailyFeatures[] {
  const tz = opts.tzOffsetMin ?? browserTzOffsetMin()
  interface DayBucket {
    dayStartMs: number
    date: string
    hours: Set<number>
    hr: number[]
    nightHr: number[]
    spo2: number[]
    stress: number[]
    sleepPoints: SleepPoint[]
  }

  const daysMap = new Map<string, DayBucket>()

  const bucketFor = ({ date, dayStartMs }: { date: string; dayStartMs: number }): DayBucket => {
    let bucket = daysMap.get(date)
    if (!bucket) {
      bucket = { dayStartMs, date, hours: new Set<number>(), hr: [], nightHr: [], spo2: [], stress: [], sleepPoints: [] }
      daysMap.set(date, bucket)
    }
    return bucket
  }

  for (const s of samples) {
    const hour = localHour(s.ts, tz)
    const bucket = bucketFor(localDay(s.ts, tz))
    bucket.hours.add(hour)

    if (s.kind === 'hr' && s.value > 0) {
      bucket.hr.push(s.value)
      if (hour >= 0 && hour < 6) {
        bucket.nightHr.push(s.value)
      }
    } else if (s.kind === 'spo2' && s.value > 0) {
      bucket.spo2.push(s.value)
    } else if (s.kind === 'stress' && s.value >= 0) {
      bucket.stress.push(s.value)
    } else if (s.kind === 'sleep') {
      bucketFor(sleepDay(s.ts, tz)).sleepPoints.push({ t: Math.floor(s.ts / 1000), state: s.value })
    }
  }

  const result: DailyFeatures[] = []
  const sortedDates = [...daysMap.keys()].sort()

  for (const date of sortedDates) {
    const b = daysMap.get(date)!
    const coverageHours = b.hours.size
    const coveragePct = Math.round((coverageHours / 24) * 1000) / 1000
    const lowQuality = coveragePct < 0.5 // less than 50% of the day

    // HR stats
    let hrMean: number | null = null
    let hrSd: number | null = null
    let hrMin: number | null = null
    let hrMax: number | null = null
    let restingHr: number | null = null

    if (b.hr.length > 0) {
      b.hr.sort((x, y) => x - y)
      hrMin = b.hr[0]
      hrMax = b.hr[b.hr.length - 1]
      const avg = mean(b.hr)!
      hrMean = Math.round(avg * 10) / 10
      hrSd = Math.round(stdDev(b.hr, avg)! * 10) / 10

      // Resting HR: 10th percentile of night-time HR (or all HR if no night HR)
      if (b.nightHr.length > 0) {
        b.nightHr.sort((x, y) => x - y)
        restingHr = Math.round(percentile(b.nightHr, 0.1)!)
      } else {
        restingHr = Math.round(percentile(b.hr, 0.1)!)
      }
    }

    // SpO2 stats
    let spo2Mean: number | null = null
    let spo2Min: number | null = null
    let spo2Below94Count = 0

    if (b.spo2.length > 0) {
      b.spo2.sort((x, y) => x - y)
      spo2Min = b.spo2[0]
      spo2Mean = Math.round(mean(b.spo2)! * 10) / 10
      spo2Below94Count = b.spo2.filter((v) => v < 94).length
    }

    // Stress stats
    let stressMean: number | null = null
    if (b.stress.length > 0) {
      stressMean = Math.round(mean(b.stress)! * 10) / 10
    }

    // Sleep stats from summarizeSleep
    let sleepHours: number | null = null
    let wakeups: number | null = null

    if (b.sleepPoints.length > 0) {
      b.sleepPoints.sort((x, y) => x.t - y.t)
      const sessions = summarizeSleep(b.sleepPoints)
      if (sessions.length > 0) {
        const totalAsleepSec = sessions.reduce((acc, s) => acc + s.asleep, 0)
        sleepHours = Math.round((totalAsleepSec / 3600) * 10) / 10

        // Count wakeups from sleep points
        let wakeupCount = 0
        for (let i = 1; i < b.sleepPoints.length; i++) {
          if (b.sleepPoints[i].state === SLEEP_STATE.awake && b.sleepPoints[i - 1].state !== SLEEP_STATE.awake) {
            wakeupCount++
          }
        }
        wakeups = wakeupCount
      }
    }

    result.push({
      date,
      dayStartMs: b.dayStartMs,
      coverageHours,
      coveragePct,
      lowQuality,
      hrMean,
      hrSd,
      hrMin,
      hrMax,
      restingHr,
      spo2Mean,
      spo2Min,
      spo2Below94Count,
      stressMean,
      sleepHours,
      wakeups,
    })
  }

  return result
}
