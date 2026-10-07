import { describe, expect, it } from 'vitest'
import type { ActionLogEntry, Alert } from '../data/types'
import { buildTimeline } from './timeline'

const alert: Alert = {
  id: 1, crewId: 'eng', ruleId: 'hrv', kind: 'baseline', hazard: 'G', metric: 'hrv', status: 'watch', peakStatus: 'act', state: 'resolved',
  z: 2.6, value: 34, baselineMean: 48, explanation: 'x', steps: [], openedAt: 100, resolvedAt: 900,
}
const e = (ts: number, kind: ActionLogEntry['kind'], text: string): ActionLogEntry => ({ crewId: 'eng', alertId: 1, ts, kind, text, sync: 'pending' })

describe('buildTimeline', () => {
  it('turns log entries into an ordered life story', () => {
    const t = buildTimeline(alert, [
      e(900, 'alert-resolved', 'HRV back within range'),
      e(100, 'alert-opened', 'WATCH: HRV 34 ms is 2.6σ below'),
      e(300, 'alert-opened', 'Escalated to ACT: HRV low'),
      e(500, 'step-done', 'Step done: Reduce workload'),
      e(600, 'step-done', 'Action card completed: Reduce workload.'),
      e(700, 'note', 'Eased to WATCH: HRV better'),
    ])
    expect(t.map((i) => [i.kind, i.label])).toEqual([
      ['opened', 'Opened as Watch'], ['escalated', 'Escalated to Act'], ['step', 'Reduce workload'],
      ['done', 'Action card marked done'], ['eased', 'Eased to Watch'], ['resolved', 'Resolved, back within range'],
    ])
  })

  it('falls back to the alert’s own times when the log is empty', () => {
    const t = buildTimeline(alert, [])
    expect(t.map((i) => [i.ts, i.kind])).toEqual([[100, 'opened'], [900, 'resolved']])
    expect(t[0].label).toBe('Opened as Act')
  })
})
