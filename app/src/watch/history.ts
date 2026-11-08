import Dexie from 'dexie'
import { ConsoleDB, db } from '../data/db'
import type { Timestamp, WearableKind, WearableSample } from '../data/types'
import { browserTzOffsetMin, localDay, localHour } from '../ml/localTime'
import { csvField } from '../sync/exportLog'

export const OPT_IN_STORAGE_KEY = 'astrodocx_watch_save_optin'

/** Read the user's opt-in preference for saving watch data locally. */
export function getWatchSaveOptIn(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(OPT_IN_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Set the user's opt-in preference for saving watch data locally. */
export function setWatchSaveOptIn(optIn: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(OPT_IN_STORAGE_KEY, optIn ? 'true' : 'false')
  } catch {
    /* ignore storage errors */
  }
}

export const WEARER_STORAGE_KEY = 'astrodocx_watch_wearer'

/**
 * The crew member who wears the watch: saved watch data belongs to them, so the Trends insights only pair it with
 * their own check-ins and scans. Null when saving was never linked to anyone (data saved before the link existed).
 */
export function getWatchWearer(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(WEARER_STORAGE_KEY) || null
  } catch {
    return null
  }
}

/** Link (or, with null, unlink) the watch to a crew member. */
export function setWatchWearer(crewId: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (crewId) localStorage.setItem(WEARER_STORAGE_KEY, crewId)
    else localStorage.removeItem(WEARER_STORAGE_KEY)
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Upsert wearable samples deduplicated by [kind+ts].
 * If a sample already exists at the same [kind, ts], update its value and live flag if different.
 * Otherwise, append the new sample.
 */
export async function upsertWearables(
  rows: Omit<WearableSample, 'id'>[],
  d: ConsoleDB = db
): Promise<number> {
  if (rows.length === 0) return 0
  return d.transaction('rw', d.wearables, async () => {
    let affected = 0
    const byKind = new Map<WearableKind, Omit<WearableSample, 'id'>[]>()
    for (const r of rows) {
      const list = byKind.get(r.kind) ?? []
      list.push(r)
      byKind.set(r.kind, list)
    }

    for (const [kind, kindRows] of byKind.entries()) {
      const minTs = Math.min(...kindRows.map((r) => r.ts))
      const maxTs = Math.max(...kindRows.map((r) => r.ts))
      const existing = await d.wearables
        .where('[kind+ts]')
        .between([kind, minTs], [kind, maxTs], true, true)
        .toArray()

      const existingMap = new Map<number, WearableSample>()
      for (const ex of existing) {
        existingMap.set(ex.ts, ex)
      }

      const toAdd: WearableSample[] = []
      for (const r of kindRows) {
        const ex = existingMap.get(r.ts)
        if (ex) {
          if (ex.value !== r.value || ex.live !== r.live) {
            await d.wearables.update(ex.id!, { value: r.value, live: r.live })
            affected++
          }
        } else {
          const sample = { ...r } as WearableSample
          toAdd.push(sample)
          existingMap.set(r.ts, sample)
          affected++
        }
      }

      if (toAdd.length > 0) {
        await d.wearables.bulkAdd(toAdd)
      }
    }
    return affected
  })
}

/**
 * Latest saved timestamp for a wearable kind, in epoch milliseconds (or null if none). Walks the `[kind+ts]` index
 * from the newest row. With `storedOnly`, live rows are skipped: they carry the host clock at the moment they streamed,
 * so they must never move the history backfill cursor past stored readings the watch has not sent yet.
 */
export async function getLastWearableTimestamp(
  kind: WearableKind,
  d: ConsoleDB = db,
  opts: { storedOnly?: boolean } = {}
): Promise<Timestamp | null> {
  let q = d.wearables.where('[kind+ts]').between([kind, Dexie.minKey], [kind, Dexie.maxKey], true, true).reverse()
  if (opts.storedOnly) q = q.filter((r) => !r.live)
  const row = await q.first()
  return row ? row.ts : null
}

/** Load all wearable samples sorted chronologically. */
export async function loadAllWearables(d: ConsoleDB = db): Promise<WearableSample[]> {
  return d.wearables.orderBy('ts').toArray()
}

/** Delete all stored wearable data on this device. */
export async function deleteWearableData(d: ConsoleDB = db): Promise<void> {
  await d.wearables.clear()
}

export interface DailyCoverage {
  date: string // 'YYYY-MM-DD'
  dayStartMs: number
  hoursWithData: number // 0 to 24 distinct hours with at least one reading
  totalSamples: number
  coveragePct: number // hoursWithData / 24, from 0 to 1
}

/**
 * Compute coverage summary: distinct local hours with data per local day.
 * `tzOffsetMin` is minutes east of UTC; it defaults to the browser's offset.
 */
export function getCoverageSummary(samples: WearableSample[], tzOffsetMin = browserTzOffsetMin()): DailyCoverage[] {
  return coverageFromTimestamps(samples.map((s) => s.ts), tzOffsetMin)
}

/** Coverage from bare timestamps (epoch ms), e.g. the `ts` index keys, without loading whole rows. */
export function coverageFromTimestamps(timestamps: number[], tzOffsetMin = browserTzOffsetMin()): DailyCoverage[] {
  const days = new Map<string, { dayStartMs: number; hours: Set<number>; count: number }>()

  for (const ts of timestamps) {
    const { date: dateKey, dayStartMs } = localDay(ts, tzOffsetMin)
    let entry = days.get(dateKey)
    if (!entry) {
      entry = { dayStartMs, hours: new Set<number>(), count: 0 }
      days.set(dateKey, entry)
    }
    entry.hours.add(localHour(ts, tzOffsetMin))
    entry.count++
  }

  const result: DailyCoverage[] = []
  for (const [date, info] of days.entries()) {
    const hoursWithData = info.hours.size
    result.push({
      date,
      dayStartMs: info.dayStartMs,
      hoursWithData,
      totalSamples: info.count,
      coveragePct: Math.round((hoursWithData / 24) * 1000) / 1000,
    })
  }

  return result.sort((a, b) => a.dayStartMs - b.dayStartMs)
}

export interface WearableSummary {
  /** All saved rows on this device. */
  total: number
  /** Days with data, and distinct hours with data, within the summary window. */
  days: number
  hours: number
  windowDays: number
}

/**
 * Small summary for the watch control: a row count plus coverage over the last `windowDays`, read from the `ts`
 * index keys only, so it never loads the whole table.
 */
export async function loadWearableSummary(
  d: ConsoleDB = db,
  windowDays = 30,
  nowMs = Date.now(),
  tzOffsetMin = browserTzOffsetMin()
): Promise<WearableSummary> {
  const from = nowMs - windowDays * 86400_000
  const [total, keys] = await Promise.all([d.wearables.count(), d.wearables.where('ts').aboveOrEqual(from).keys()])
  const coverage = coverageFromTimestamps(keys as number[], tzOffsetMin)
  return { total, days: coverage.length, hours: coverage.reduce((a, c) => a + c.hoursWithData, 0), windowDays }
}

const CSV_HEADER = ['id', 'kind', 'value', 'timestamp_ms', 'iso_time', 'source', 'live']

/** Export wearable samples to RFC 4180 CSV format. */
export function exportWearablesCsv(samples: WearableSample[]): string {
  const rows = [...samples]
    .sort((a, b) => a.ts - b.ts || (a.id ?? 0) - (b.id ?? 0))
    .map((s) => [
      s.id ?? '',
      s.kind,
      s.value,
      s.ts,
      new Date(s.ts).toISOString(),
      s.source,
      s.live ? 'true' : 'false',
    ])
  return [CSV_HEADER, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** Trigger browser file download of CSV data. */
export function downloadWearablesCsv(csv: string, filename = 'haylou_wearable_data.csv'): void {
  if (typeof document === 'undefined') return
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Export wearable samples to formatted JSON string. */
export function exportWearablesJson(samples: WearableSample[]): string {
  return JSON.stringify(
    [...samples].sort((a, b) => a.ts - b.ts),
    null,
    2
  )
}

/** Trigger browser file download of JSON data. */
export function downloadWearablesJson(json: string, filename = 'haylou_wearable_data.json'): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
