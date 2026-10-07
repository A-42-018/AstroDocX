// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusBoard } from './StatusBoard'
import { buildTiles, overallOf, readinessOf, type Snapshot } from './snapshot'
import type { Alert } from '../data/types'
import { MISSION_START } from '../data/synthetic'

afterEach(cleanup)

const alert: Alert = {
  crewId: 'pilot', ruleId: 'sleep', kind: 'baseline', hazard: 'I', metric: 'sleep', status: 'act', peakStatus: 'act', state: 'open',
  z: 3.4, value: 3.1, baselineMean: 7.1, explanation: 'Sleep last night 3.1 h is 3.4σ below Pilot’s baseline.', steps: [], openedAt: 1,
}
const tiles = buildTiles({ baselines: [], alerts: [alert], latest: { dose: 25, sleep: 3.1, exercise: 118, co2: 2.4 }, sinceSyncH: 5.2, oldestPendingAgeH: 3, pendingSync: 4 })
const snap: Snapshot = {
  crew: [{ id: 'cmdr', name: 'Commander', role: 'Commander' }, { id: 'pilot', name: 'Pilot', role: 'Pilot' }],
  crewId: 'pilot', now: MISSION_START + 3 * 86_400_000 + 7 * 3_600_000, tiles, alerts: [alert],
  readiness: readinessOf(tiles), overall: overallOf(tiles), pendingSync: 4, sinceSyncH: 5.2,
}

describe('StatusBoard', () => {
  it('renders five hazard tiles with status text, values and the alert explanation', () => {
    render(<StatusBoard snap={snap} />)
    const list = screen.getByRole('list', { name: 'Hazard status' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByLabelText(/^Isolation: ACT/)).toBeTruthy()
    expect(screen.getByText(/3\.4σ below Pilot/)).toBeTruthy()
    expect(screen.getByLabelText(/^Distance: NOMINAL/).textContent).toContain('5.2')
  })

  it('shows readiness, overall status and the mission clock', () => {
    render(<StatusBoard snap={snap} />)
    expect(screen.getByLabelText(new RegExp(`Crew readiness ${snap.readiness} percent, ACT`))).toBeTruthy()
    expect(screen.getByText('1 active alert')).toBeTruthy()
  })
})
