import { met } from '../engine/actions'
import type { ActionLogEntry, CrewMember } from '../data/types'

const HEADER = ['id', 'mission_time', 'timestamp_utc', 'crew', 'kind', 'alert_id', 'sync', 'synced_mission_time', 'text']

/** RFC 4180 field: quote when needed, double inner quotes; neutralise spreadsheet formulas. */
export function csvField(v: string | number | undefined): string {
  let s = v === undefined ? '' : String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The whole on-board log as CSV, oldest first. */
export function logToCsv(entries: ActionLogEntry[], crew: CrewMember[]): string {
  const name = (id: string) => crew.find((c) => c.id === id)?.name ?? id
  const rows = [...entries].sort((a, b) => a.ts - b.ts || (a.id ?? 0) - (b.id ?? 0)).map((e) => [
    e.id, met(e.ts), new Date(e.ts).toISOString(), name(e.crewId), e.kind, e.alertId, e.sync, e.syncedAt === undefined ? undefined : met(e.syncedAt), e.text,
  ])
  return [HEADER, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** Hand the CSV to the browser as a file download. */
export function downloadCsv(csv: string, filename: string) {
  // The byte-order mark makes Excel read the file as UTF-8 (σ, ’ and ₂ appear in the texts).
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
