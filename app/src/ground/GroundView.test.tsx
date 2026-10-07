// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { GroundView } from './GroundView'
import type { GroundCrew } from './derive'
import { MISSION_START } from '../data/synthetic'

afterEach(cleanup)

const crew: GroundCrew[] = [
  { crew: { id: 'pilot', name: 'Pilot', role: 'Pilot' }, awaiting: 2, resolved: [],
    open: [{ alertId: 1, level: 'act', text: 'ACT: Sleep last night 4.7 h is 3.4σ below baseline.', openedAt: MISSION_START, lastUpdate: MISSION_START, stepsDone: 1 }],
    lastCheckIn: { crewId: 'pilot', kind: 'checkin', text: 'x', ts: MISSION_START + 3_600_000, sync: 'synced' } },
  { crew: { id: 'cmdr', name: 'Commander', role: 'Commander' }, awaiting: 0, open: [], resolved: [] },
]

it('shows only what Earth knows, with level text, step reports and what is still on board', () => {
  render(<GroundView now={MISSION_START + 86_400_000} lastSyncedAt={MISSION_START + 3_600_000} pending={2} crew={crew} />)
  expect(screen.getByLabelText('Ground view status').textContent).toMatch(/data current to D0 01:00 MET · 2 entries still on board/)
  const pilot = screen.getByLabelText('Pilot: 1 open')
  expect(within(pilot).getAllByText('ACT')).toHaveLength(2) // card badge + alert row
  expect(within(pilot).getByText(/Sleep last night 4\.7 h/)).toBeTruthy()
  expect(within(pilot).getByText(/1 step reported done/)).toBeTruthy()
  expect(within(pilot).getByText(/2 on board, not yet downlinked/)).toBeTruthy()
  expect(within(screen.getByLabelText('Commander: no open alerts')).getByText('No open alerts reported.')).toBeTruthy()
  expect(screen.getByText(/1 open alert known to the ground/)).toBeTruthy()
})

it('says how far behind the crew Earth is, and that it has heard nothing before any sync', () => {
  const now = MISSION_START + 86_400_000
  const { rerender } = render(<GroundView now={now} lastSyncedAt={now - 4 * 3_600_000} pending={0} crew={crew} />)
  expect(screen.getByRole('status').textContent).toBe('Earth is 4h 12m behind the crew.')
  rerender(<GroundView now={now} lastSyncedAt={null} pending={0} crew={crew} />)
  expect(screen.getByRole('status').textContent).toContain('heard nothing')
})

