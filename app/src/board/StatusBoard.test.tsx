// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    render(<MemoryRouter><StatusBoard snap={snap} /></MemoryRouter>)
    const list = screen.getByRole('list', { name: 'Hazard status' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByLabelText(/^Isolation: ACT/)).toBeTruthy()
    expect(screen.getByText(/3\.4σ below Pilot/)).toBeTruthy()
    expect(screen.getByLabelText(/^Distance: NOMINAL/).textContent).toContain('5.2')
  })

  it('shows readiness, overall status and the mission clock', () => {
    render(<MemoryRouter><StatusBoard snap={snap} /></MemoryRouter>)
    expect(screen.getByLabelText(new RegExp(`Crew readiness ${snap.readiness} percent, ACT`))).toBeTruthy()
    expect(screen.getByText('1 active alert')).toBeTruthy()
  })

  it('shows the most urgent open step as the next action, and the twin hotspots link to their cards', () => {
    const withSteps = { ...snap, alerts: [{ ...alert, steps: [{ text: 'Rest', done: true }, { text: 'Cool the cabin', done: false }] }] }
    render(<MemoryRouter><StatusBoard snap={withSteps} /></MemoryRouter>)
    const next = screen.getByRole('region', { name: 'Next action' })
    expect(next.textContent).toContain('Cool the cabin')
    expect(next.textContent).toContain('1 of 2 steps done')
    expect(within(next).getByRole('link', { name: /Open action card/ }).getAttribute('href')).toBe('/alerts')
    const twin = screen.getByRole('group', { name: 'Health twin' })
    expect(within(twin).getAllByRole('link')).toHaveLength(5)
    expect(within(twin).getByRole('link', { name: /^Jump to Isolation card, ACT/ }).getAttribute('href')).toBe('#hz-I')
    expect(document.getElementById('hz-I')).toBeTruthy()
  })

  it('says all clear when there are no alerts', () => {
    render(<MemoryRouter><StatusBoard snap={{ ...snap, alerts: [] }} /></MemoryRouter>)
    expect(screen.getByRole('region', { name: 'Next action' }).textContent).toContain('Nothing needs doing')
  })
})
