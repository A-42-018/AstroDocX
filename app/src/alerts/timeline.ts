import type { ActionLogEntry, Alert, Timestamp } from '../data/types'

export type TimelineKind = 'opened' | 'escalated' | 'eased' | 'step' | 'done' | 'resolved'
export interface TimelineItem { ts: Timestamp; kind: TimelineKind; label: string }

const LEVEL = /^(WATCH|ACT)\b/
const title = (s: string) => s[0].toUpperCase() + s.slice(1).toLowerCase()

/**
 * An alert's life, oldest first, from the on-board log: opened, escalated or eased, each step ticked, the
 * action card marked done, resolved. If the log has no opening entry the alert's own start time is used.
 */
export function buildTimeline(alert: Alert, log: ActionLogEntry[]): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const e of [...log].sort((a, b) => a.ts - b.ts)) {
    if (e.kind === 'alert-opened') {
      const esc = e.text.startsWith('Escalated to ')
      const level = (esc ? e.text.slice('Escalated to '.length) : e.text).match(LEVEL)?.[1]
      items.push({ ts: e.ts, kind: esc ? 'escalated' : 'opened', label: `${esc ? 'Escalated to' : 'Opened as'} ${level ? title(level) : alert.status}` })
    } else if (e.kind === 'note' && e.text.startsWith('Eased to ')) {
      items.push({ ts: e.ts, kind: 'eased', label: `Eased to ${title(e.text.slice('Eased to '.length).match(LEVEL)?.[1] ?? 'watch')}` })
    } else if (e.kind === 'step-done') {
      items.push(e.text.startsWith('Step done: ')
        ? { ts: e.ts, kind: 'step', label: e.text.slice('Step done: '.length) }
        : { ts: e.ts, kind: 'done', label: 'Action card marked done' })
    } else if (e.kind === 'alert-resolved') {
      items.push({ ts: e.ts, kind: 'resolved', label: 'Resolved, back within range' })
    }
  }
  if (!items.some((i) => i.kind === 'opened')) items.unshift({ ts: alert.openedAt, kind: 'opened', label: `Opened as ${title(alert.peakStatus)}` })
  if (alert.resolvedAt !== undefined && !items.some((i) => i.kind === 'resolved')) items.push({ ts: alert.resolvedAt, kind: 'resolved', label: 'Resolved, back within range' })
  return items.sort((a, b) => a.ts - b.ts)
}
