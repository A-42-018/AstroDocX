// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SyncView } from './SyncView'
import { linkAt } from './link'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'
import type { ActionLogEntry } from '../data/types'

afterEach(cleanup)

const e = (id: number, over: Partial<ActionLogEntry> = {}): ActionLogEntry => ({ id, crewId: 'cmdr', kind: 'note', text: `entry ${id}`, ts: MISSION_START, sync: 'pending', ...over })
const now = MISSION_START + 3 * DAY
const props = (over = {}) => ({
  now, link: linkAt(now + HOUR), pending: [e(1), e(2)], synced: [e(3, { sync: 'synced' as const, syncedAt: now })], lastSyncedAt: now,
  blackout: false, auto: true, busy: false, message: '', error: '', onSync: vi.fn(), onBlackout: vi.fn(), onAuto: vi.fn(), ...over,
})

it('open window: shows status text, queue and a working Sync button', () => {
  const p = props({ now: now + HOUR, link: linkAt(now + HOUR) })
  render(<SyncView {...p} />)
  expect(screen.getByLabelText('Ground link status').textContent).toContain('LINK OPEN')
  expect(screen.getByText('entry 1')).toBeTruthy()
  expect(screen.getByText('entry 3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Sync 2 entries now' }))
  expect(p.onSync).toHaveBeenCalled()
})

it('closed window: Sync is disabled and the next window is stated', () => {
  const t = now + 5 * HOUR
  render(<SyncView {...props({ now: t, link: linkAt(t) })} />)
  expect((screen.getByRole('button', { name: /Sync 2 entries now/ }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByLabelText('Ground link status').textContent).toMatch(/WAITING FOR WINDOW[\s\S]*Next window opens D3 12:00 MET \(in 7\.0 h\)/)
})

it('blackout: says so, keeps queueing and reports toggles', () => {
  const p = props({ blackout: true, link: linkAt(now + HOUR, true) })
  render(<SyncView {...p} />)
  expect(screen.getByLabelText('Ground link status').textContent).toContain('BLACKOUT')
  fireEvent.click(screen.getByLabelText('Simulate comms blackout'))
  expect(p.onBlackout).toHaveBeenCalledWith(false)
  fireEvent.click(screen.getByLabelText(/Auto-sync/))
  expect(p.onAuto).toHaveBeenCalledWith(false)
})

it('empty outbox', () => {
  render(<SyncView {...props({ pending: [], synced: [] })} />)
  expect(screen.getByText('Everything is synced.')).toBeTruthy()
  expect(screen.getByText('Nothing synced yet.')).toBeTruthy()
})
