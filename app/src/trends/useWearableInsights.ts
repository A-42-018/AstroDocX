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
 * model on each live sample. It also reloads just after local midnight, so "today" and the completed days roll over
 * even when nothing new is saved.
 *
 * Saved watch data belongs to `wearerId`, the crew member the watch is linked to. While another crew member is
 * selected it loads nothing (the page says whose data it is). With no wearer linked (data saved before the link
 * existed) it shows the watch data alone, never paired with anyone's check-ins or scans.
 */
export function useWearableInsights(crewId: string | undefined, wearerId: string | null): InsightsData | undefined {
  const [loaded, setLoaded] = useState<{ owner: string; insights: InsightsData } | undefined>(undefined)
  const cache = useRef<AnomalyCache | undefined>(undefined)
  const otherWearer = wearerId !== null && wearerId !== crewId
  // whose check-ins and scans go with the watch data: the wearer's, or nobody's while no wearer is linked
  const labelsFor = wearerId
  const owner = `${crewId}|${wearerId}`

  useEffect(() => {
    if (!crewId || otherWearer) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let midnight: ReturnType<typeof setTimeout> | null = null
    let lastLoad = 0

    const load = async () => {
      const nowMs = Date.now()
      lastLoad = nowMs
      const from = nowMs - INSIGHTS_WINDOW_DAYS * DAY
      const tz = browserTzOffsetMin()
      armMidnight(nowMs, tz)
      const [wearables, scans, checkIns] = await Promise.all([
        db.wearables.where('ts').aboveOrEqual(from).toArray(),
        labelsFor ? db.scans.where('crewId').equals(labelsFor).toArray() : Promise.resolve([]),
        labelsFor ? db.checkIns.where('crewId').equals(labelsFor).toArray() : Promise.resolve([]),
      ])
      if (cancelled) return
      const out = computeInsights(wearables, scans, checkIns, nowMs, tz, cache.current)
      cache.current = out.cache
      setLoaded({ owner, insights: out.insights })
    }
    // one reload just after the next local midnight, re-armed by every load
    const armMidnight = (nowMs: number, tz: number) => {
      if (midnight) clearTimeout(midnight)
      const next = localDay(nowMs, tz).dayStartMs + DAY + 1000
      midnight = setTimeout(() => { midnight = null; void load().catch(() => { /* keep the last insights */ }) }, next - nowMs)
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
      if (midnight) clearTimeout(midnight)
      sub.unsubscribe()
    }
  }, [crewId, otherWearer, labelsFor, owner])

  // never show insights computed for another selection
  return !otherWearer && loaded?.owner === owner ? loaded.insights : undefined
}
