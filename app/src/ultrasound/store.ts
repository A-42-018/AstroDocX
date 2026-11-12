import { liveQuery } from 'dexie'
import { ConsoleDB, db } from '../data/db'
import type { Timestamp, UsScan } from '../data/types'
import { examById } from './exams'
import { logLine, type ScanResult } from './sim'

export interface SaveInput { crewId: string; ts: Timestamp; result: ScanResult; quality: number }

/** Keep a finished scan: one row in the usScans table and one pending entry in the on-board log. Never touches readings or alerts. */
export async function saveUsScan(input: SaveInput, d: ConsoleDB = db): Promise<UsScan> {
  const exam = examById(input.result.exam)
  if (!exam) throw new Error(`Unknown exam: ${input.result.exam}`)
  const scan: UsScan = {
    crewId: input.crewId, ts: input.ts, exam: input.result.exam, values: input.result.values, status: input.result.status,
    quality: Math.round(input.quality * 100) / 100, flagged: false,
  }
  return d.transaction('rw', [d.usScans, d.actionLog], async () => {
    scan.id = (await d.usScans.add(scan)) as number
    await d.actionLog.add({ crewId: scan.crewId, kind: 'note', ts: scan.ts, text: logLine(exam, input.result, scan.quality), sync: 'pending' })
    return scan
  })
}

/** Ask the flight surgeon to look at a scan: marks it and adds a second, plainly labelled log entry. */
export async function flagUsScan(scan: UsScan, ts: Timestamp, d: ConsoleDB = db): Promise<void> {
  const exam = examById(scan.exam)
  if (!exam || scan.id === undefined) throw new Error('That scan is not saved yet.')
  await d.transaction('rw', [d.usScans, d.actionLog], async () => {
    await d.usScans.update(scan.id!, { flagged: true })
    await d.actionLog.add({
      crewId: scan.crewId, kind: 'note', ts,
      text: logLine(exam, { exam: scan.exam as ScanResult['exam'], values: scan.values, status: scan.status }, scan.quality, true),
      sync: 'pending',
    })
  })
}

/** Scans of one exam for one crew member, oldest first (so a sparkline reads left to right). */
export const scansFor = (crewId: string, exam: string, limit = 12, d: ConsoleDB = db) =>
  d.usScans.where('[crewId+exam]').equals([crewId, exam]).sortBy('ts').then((rows) => rows.slice(-limit))

export const watchScans = (crewId: string, exam: string, next: (rows: UsScan[]) => void, error: () => void) =>
  liveQuery(() => scansFor(crewId, exam)).subscribe({ next, error })
