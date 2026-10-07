import { db, type ConsoleDB } from '../data/db'
import type { ActionLogEntry, CrewMember, Timestamp } from '../data/types'

export type FeedKind = 'opened' | 'escalated' | 'eased' | 'resolved'
export interface FeedEvent { id: number; ts: Timestamp; kind: FeedKind; crew: string; text: string }

const MAX = 150
const clip = (s: string) => (s.length > MAX ? `${s.slice(0, MAX - 1)}…` : s)

/** What the engine did, as a feed line: an alert opened, escalated, eased or resolved. Other log entries (steps, check-ins) are not engine decisions. */
export function toFeedEvent(e: ActionLogEntry, crew: CrewMember[]): FeedEvent | null {
  const who = crew.find((c) => c.id === e.crewId)?.name ?? e.crewId
  const base = { id: e.id!, ts: e.ts, crew: who }
  if (e.kind === 'alert-opened') {
    const esc = e.text.startsWith('Escalated to ')
    return { ...base, kind: esc ? 'escalated' : 'opened', text: clip(e.text) }
  }
  if (e.kind === 'note' && e.text.startsWith('Eased to ')) return { ...base, kind: 'eased', text: clip(e.text) }
  if (e.kind === 'alert-resolved') return { ...base, kind: 'resolved', text: clip(e.text) }
  return null
}

/** Newest-first engine events across the whole crew. */
export async function loadFeed(crew: CrewMember[], limit = 25, d: ConsoleDB = db): Promise<FeedEvent[]> {
  const rows = await d.actionLog.orderBy('ts').reverse().filter((e) => e.kind === 'alert-opened' || e.kind === 'alert-resolved' || e.kind === 'note').limit(limit * 3).toArray()
  const out: FeedEvent[] = []
  for (const r of rows) {
    const ev = toFeedEvent(r, crew)
    if (ev) out.push(ev)
    if (out.length >= limit) break
  }
  return out
}
