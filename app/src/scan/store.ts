import { liveQuery } from 'dexie'
import { ConsoleDB, db } from '../data/db'
import type { FaceScan, Timestamp } from '../data/types'
import { SCAN_SECONDS, type ScanAnalysis } from './rppg'

/** The final analysis drops the camera's first moments, so a full scan reports a little less than SCAN_SECONDS. */
export const MIN_KEEP_SECONDS = SCAN_SECONDS - 3

export interface ScanInput { crewId: string; ts: Timestamp; analysis: ScanAnalysis }

/** Why a scan cannot be saved, or null. A weak or short scan is never kept. */
export function whyNot(a: ScanAnalysis): string | null {
  if (a.seconds < MIN_KEEP_SECONDS) return 'The scan was too short.'
  if (!a.reliable || a.bpm === null) return 'The pulse signal was too weak to trust. Try again with steadier light.'
  if (a.bpm < 40 || a.bpm > 180) return 'That heart rate is outside what a scan can read. Try again.'
  return null
}

const round = (n: number, dec = 0) => { const k = 10 ** dec; return Math.round(n * k) / k }

/** Plain words for the on-board log, so Ground sees exactly what was measured and how much to trust it. */
export function logText(s: FaceScan): string {
  const parts = [`heart rate ${s.hr} bpm`]
  if (s.hrv !== null) parts.push(`HRV about ${s.hrv} ms (rough)`)
  if (s.resp !== null) parts.push(`breathing about ${s.resp} per min`)
  return `Face scan (experimental, webcam): ${parts.join(', ')}; signal quality ${Math.round(s.quality * 100)}%. Not diagnostic; not used for alerts.`
}

/**
 * Keep a finished scan: one row in the scans table and one pending entry in the on-board log.
 * Scans are deliberately not fed to the alert engine: a webcam reads differently from the wearable,
 * so mixing them would shift the crew member's baseline and could raise false alarms.
 */
export async function saveScan(input: ScanInput, d: ConsoleDB = db): Promise<FaceScan> {
  const err = whyNot(input.analysis)
  if (err) throw new Error(err)
  const a = input.analysis
  const scan: FaceScan = {
    crewId: input.crewId, ts: input.ts, hr: round(a.bpm!), hrv: a.hrv === null ? null : round(a.hrv),
    resp: a.resp === null ? null : round(a.resp), quality: round(a.quality, 2), seconds: round(a.seconds),
  }
  return d.transaction('rw', [d.scans, d.actionLog], async () => {
    scan.id = (await d.scans.add(scan)) as number
    await d.actionLog.add({ crewId: scan.crewId, kind: 'note', ts: scan.ts, text: logText(scan), sync: 'pending' })
    return scan
  })
}

/** The newest scans for one crew member, newest first. */
export const recentScans = (crewId: string, limit = 6, d: ConsoleDB = db) =>
  d.scans.where('crewId').equals(crewId).sortBy('ts').then((rows) => rows.reverse().slice(0, limit))

export const watchScans = (crewId: string, next: (rows: FaceScan[]) => void, error: () => void) =>
  liveQuery(() => recentScans(crewId)).subscribe({ next, error })
