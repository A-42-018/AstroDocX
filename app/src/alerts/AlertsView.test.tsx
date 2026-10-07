// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AlertsView } from './AlertsView'
import type { Alert } from '../data/types'

afterEach(cleanup)

const base: Alert = {
  id: 1, crewId: 'pilot', ruleId: 'sleep', kind: 'baseline', hazard: 'I', metric: 'sleep', status: 'act', peakStatus: 'act', state: 'open',
  z: 3.4, value: 3.1, baselineMean: 7.1, explanation: 'Sleep last night 3.1 h is 3.4σ below Pilot’s baseline.',
  steps: [{ text: 'Protect an 8 h sleep window', done: true }, { text: 'Dim the cabin lights', done: false }], openedAt: 1,
}
const watch: Alert = { ...base, id: 3, ruleId: 'hrv', metric: 'hrv', hazard: 'G', status: 'watch', peakStatus: 'watch', explanation: 'HRV 34 ms is 2.2σ below Pilot’s baseline.', openedAt: 2 }
const crew = [{ id: 'cmdr', name: 'Commander', role: 'Commander' }, { id: 'pilot', name: 'Pilot', role: 'Pilot' }]
const props = { crew, crewId: 'pilot', resolved: [], onStep: () => {}, onDone: () => {} }

it('shows the most urgent alert in the detail pane with why, progress, and reports step ticks and Done', () => {
  const onStep = vi.fn()
  const onDone = vi.fn()
  render(<AlertsView {...props} active={[base, watch]} onStep={onStep} onDone={onDone} />)
  const card = screen.getByLabelText('Sleep last night: ACT')
  expect(within(card).getByText(/3\.4σ below Pilot/)).toBeTruthy()
  expect(within(card).getByText(/1 of 2 steps done/)).toBeTruthy()
  expect(within(card).getByText(/3\.4σ from baseline when it opened/)).toBeTruthy()
  fireEvent.click(within(card).getByLabelText('Dim the cabin lights'))
  expect(onStep).toHaveBeenCalledWith(1, 1, true)
  fireEvent.click(within(card).getByRole('button', { name: 'Done' }))
  expect(onDone).toHaveBeenCalledWith(1)
})

it('picks another alert from the list and reports the selection', () => {
  const onSelect = vi.fn()
  render(<AlertsView {...props} active={[base, watch]} onSelect={onSelect} />)
  expect(onSelect).toHaveBeenLastCalledWith(base)
  const list = screen.getByRole('list', { name: 'Active alerts' })
  fireEvent.click(within(list).getAllByRole('button')[1])
  expect(screen.getByLabelText('HRV: WATCH')).toBeTruthy()
  expect(onSelect).toHaveBeenLastCalledWith(watch)
})

it('filters by Act, Watch and Resolved', () => {
  const resolved: Alert = { ...base, id: 2, state: 'resolved', status: 'watch', peakStatus: 'act', resolvedAt: 90_000_000 }
  render(<AlertsView {...props} active={[base, watch]} resolved={[resolved]} />)
  fireEvent.click(screen.getByRole('button', { name: /^Watch/ }))
  expect(within(screen.getByRole('list', { name: 'Active alerts' })).getAllByRole('button')).toHaveLength(1)
  expect(screen.getByLabelText('HRV: WATCH')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Resolved/ }))
  const list = screen.getByRole('list', { name: 'Resolved alerts' })
  expect(within(list).getByText(/peak ACT/)).toBeTruthy()
  // a resolved alert is read-only
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
  expect(screen.getByLabelText('Dim the cabin lights').matches(':disabled')).toBe(true)
})

it('locks an acknowledged card', () => {
  render(<AlertsView {...props} active={[{ ...base, state: 'acknowledged' }]} />)
  expect((screen.getByRole('button', { name: 'Done · logged' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByLabelText('Dim the cabin lights').matches(':disabled')).toBe(true)
})

it('says so when there are no active alerts', () => {
  render(<AlertsView {...props} active={[]} />)
  expect(screen.getByText(/No active alerts\./)).toBeTruthy()
  expect(screen.queryByRole('list', { name: 'Active alerts' })).toBeNull()
})
