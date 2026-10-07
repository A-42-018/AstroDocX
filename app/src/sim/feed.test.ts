import { describe, expect, it } from 'vitest'
import type { ActionLogEntry } from '../data/types'
import { toFeedEvent } from './feed'

const crew = [{ id: 'eng', name: 'Flight Engineer', role: 'Flight Engineer' }]
const e = (kind: ActionLogEntry['kind'], text: string, id = 1): ActionLogEntry => ({ id, crewId: 'eng', kind, text, ts: 5, sync: 'pending' })

describe('toFeedEvent', () => {
  it('maps engine decisions and names the person', () => {
    expect(toFeedEvent(e('alert-opened', 'WATCH: HRV low'), crew)).toMatchObject({ kind: 'opened', crew: 'Flight Engineer' })
    expect(toFeedEvent(e('alert-opened', 'Escalated to ACT: HRV low'), crew)?.kind).toBe('escalated')
    expect(toFeedEvent(e('note', 'Eased to WATCH: HRV better'), crew)?.kind).toBe('eased')
    expect(toFeedEvent(e('alert-resolved', 'HRV back within range'), crew)?.kind).toBe('resolved')
  })
  it('ignores entries that are not engine decisions and clips long text', () => {
    expect(toFeedEvent(e('step-done', 'Step done: x'), crew)).toBeNull()
    expect(toFeedEvent(e('checkin', 'mood 4/5'), crew)).toBeNull()
    expect(toFeedEvent(e('alert-opened', 'WATCH: ' + 'x'.repeat(400)), crew)!.text.length).toBe(150)
  })
})
