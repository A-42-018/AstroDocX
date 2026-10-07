// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SyncView } from './SyncView'
import { linkAt } from './link'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'
import type { ActionLogEntry } from '../data/types'

afterEach(cleanup)

const e = (id: number, over: Partial<ActionLogEntry> = {}): ActionLogEntry => ({ id, crewId: 'cmdr', kind: 'note', text: `entry ${id}`, ts: MISSION_START, sync: 'pending', ...over })
const now = MISSION_START + 3 * DAY
const props = (over = {}) => ({
  now, link: linkAt(now + HOUR), pending: [e(1), e(2)], synced: [e(3, { sync: 'synced' as const, syncedAt: now })], lastSyncedAt: now, station: 'Simulated ground station (on this device)',
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

it('filters the on-board log by state, kind and person', () => {
  const crew = [{ id: 'cmdr', name: 'Commander', role: 'Commander' }, { id: 'pilot', name: 'Pilot', role: 'Pilot' }]
  const log = [
    e(1, { text: 'opened A', kind: 'alert-opened' }),
    e(2, { text: 'note B', kind: 'note', sync: 'synced', syncedAt: now }),
    e(3, { text: 'checkin C', kind: 'checkin', crewId: 'pilot' }),
  ]
  render(<SyncView {...props({ pending: [], synced: [], log, crew })} />)
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Synced' }))
  expect(within(table).getByText('note B')).toBeTruthy()
  expect(within(table).queryByText('opened A')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'pilot' } })
  expect(within(table).getAllByRole('row')).toHaveLength(2)
  fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'all' } })
  fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'note' } })
  expect(within(table).getAllByRole('row')).toHaveLength(2)
})

it('sends a burst of packets to Earth when queued entries are delivered', () => {
  const t = now + HOUR
  const { container, rerender } = render(<SyncView {...props({ now: t, link: linkAt(t) })} />)
  expect(container.querySelector('.ld-burst')).toBeNull()
  rerender(<SyncView {...props({ now: t, link: linkAt(t), pending: [] })} />)
  expect(container.querySelectorAll('.ld-burst circle')).toHaveLength(2)
})

