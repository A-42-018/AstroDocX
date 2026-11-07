import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'
import { db } from '../data/db'
import type { CheckIn, FaceScan, WearableSample } from '../data/types'
import { evaluateScanAgreement } from '../ml/agreement'
import { detectAnomalies, type AnomalyReport } from '../ml/anomaly'
import { extractDailyFeatures, extractHourlyFeatures, type DailyFeatures } from '../ml/features'
import { forecastHeartRateBand } from '../ml/forecast'
import { browserTzOffsetMin, localDay } from '../ml/localTime'
import { computeReadiness, pickReadinessDay } from '../ml/readiness'
import type { InsightsData } from './TrendsView'

const DAY = 86400_000
/** How much wearable history the insights read: enough for the 14-day warm-up with room to spare. */
export const INSIGHTS_WINDOW_DAYS = 90
/** Quiet time after the last write before reloading, and the least time between two reloads. */
const DEBOUNCE_MS = 3000
const MIN_INTERVAL_MS = 30_000

/** Cache for the anomaly model: the Isolation Forest is refitted only when the set of completed days changes. */
export interface AnomalyCache { key: string; report: AnomalyReport }

/**
 * All wearable insights from already-loaded rows. Daily models (anomaly) use completed local days only, so writes
 * during today never refit the forest; pass the previous cache to reuse it while the completed days are unchanged.
 * `checkIns` and `scans` must already belong to the wearer.
 */
export function computeInsights(
  wearables: WearableSample[],
  scans: FaceScan[],
  checkIns: CheckIn[],
  nowMs: number,
  tzOffsetMin: number,
  cache?: AnomalyCache,
): { insights: InsightsData; cache: AnomalyCache } {
  const daily = extractDailyFeatures(wearables, { tzOffsetMin })
  const todayKey = localDay(nowMs, tzOffsetMin).date
  const completed = daily.filter((d) => d.date < todayKey)
  const key = completedKey(completed)
  const anomaly = cache && cache.key === key ? cache.report : detectAnomalies(completed)

  const forecast = forecastHeartRateBand(extractHourlyFeatures(wearables, { tzOffsetMin }), { tzOffsetMin })
  const readiness = computeReadiness(pickReadinessDay(daily, nowMs, tzOffsetMin), daily, checkIns, { tzOffsetMin })
  const agreement = evaluateScanAgreement(scans, wearables)
  return { insights: { anomaly, forecast, readiness, agreement }, cache: { key, report: anomaly } }
}

function completedKey(days: DailyFeatures[]): string {
  return days
    .map((d) => [d.date, d.coverageHours, d.hrMean, d.restingHr, d.spo2Mean, d.spo2Below94Count, d.stressMean, d.sleepHours, d.wakeups].join(':'))
    .join('|')
}

/**
 * Wearable insights for the Trends page. Watches only a cheap signal (row count) and reloads a bounded window of
 * wearable rows after writes settle, at most every 30 s, instead of re-reading the whole table and refitting every
 * model on each live sample. Check-ins and scans are the given crew member's own.
 */
export function useWearableInsights(crewId: string | undefined): InsightsData | undefined {
  const [insights, setInsights] = useState<InsightsData | undefined>(undefined)
  const cache = useRef<AnomalyCache | undefined>(undefined)

  useEffect(() => {
    if (!crewId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastLoad = 0

    const load = async () => {
      const nowMs = Date.now()
      lastLoad = nowMs
      const from = nowMs - INSIGHTS_WINDOW_DAYS * DAY
      const [wearables, scans, checkIns] = await Promise.all([
        db.wearables.where('ts').aboveOrEqual(from).toArray(),
        db.scans.where('crewId').equals(crewId).toArray(),
        db.checkIns.where('crewId').equals(crewId).toArray(),
      ])
      if (cancelled) return
      const out = computeInsights(wearables, scans, checkIns, nowMs, browserTzOffsetMin(), cache.current)
      cache.current = out.cache
      setInsights(out.insights)
    }
    const schedule = () => {
      if (timer) clearTimeout(timer)
      const wait = lastLoad === 0 ? 0 : Math.max(DEBOUNCE_MS, lastLoad + MIN_INTERVAL_MS - Date.now())
      timer = setTimeout(() => { timer = null; void load().catch(() => { /* keep the last insights */ }) }, wait)
    }

    // one cheap query per write; the heavy reload is debounced behind it
    const sub = liveQuery(() => Promise.all([db.wearables.count(), db.scans.count(), db.checkIns.count()])).subscribe({
      next: schedule,
      error: () => { /* the database is not open; the page shows its own error */ },
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [crewId])

  return insights
}
