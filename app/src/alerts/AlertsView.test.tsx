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
  expect(within(card).getByRole('region', { name: 'Why this fired' }).textContent).toContain('3.4σ below Pilot’s baseline')
  expect(within(card).getByText(/1 of 2 steps done/)).toBeTruthy()
  expect(within(card).getByRole('region', { name: 'Why this fired' }).textContent).toContain('3.4σwhen it opened')
  expect(within(card).getByRole('heading', { level: 1, name: 'Sleep last night' })).toBeTruthy()
  fireEvent.click(within(card).getByLabelText('Dim the cabin lights'))
  expect(onStep).toHaveBeenCalledWith(1, 1, true)
  fireEvent.click(within(card).getByRole('button', { name: 'Mark done' }))
  expect(onDone).toHaveBeenCalledWith(1)
})

it('shows a tick at once, then follows the database when the alert next arrives', () => {
  const { rerender } = render(<AlertsView {...props} active={[base, watch]} />)
  const box = () => within(screen.getByLabelText('Sleep last night: ACT')).getByLabelText('Dim the cabin lights') as HTMLInputElement
  fireEvent.click(box())
  expect(box().checked).toBe(true) // before the database has answered
  expect(screen.getByText(/2 of 2 steps done/)).toBeTruthy()
  // a newer copy of the alert (the write failed, say) is the truth again
  rerender(<AlertsView {...props} active={[{ ...base }, watch]} />)
  expect(box().checked).toBe(false)
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

it('lists recently resolved alerts under the active queue and opens one', () => {
  const resolved: Alert = { ...base, id: 2, state: 'resolved', status: 'watch', peakStatus: 'act', resolvedAt: 90_000_000 }
  render(<AlertsView {...props} active={[base]} resolved={[resolved]} />)
  fireEvent.click(within(screen.getByRole('list', { name: 'Recently resolved' })).getByRole('button'))
  expect(screen.getByRole('button', { name: /Resolved$/ }).getAttribute('aria-pressed')).toBe('true')
  expect(within(screen.getByRole('list', { name: 'Resolved alerts' })).getByRole('button').getAttribute('aria-current')).toBe('true')
})

it('filters by Act, Watch and Resolved', () => {
  const resolved: Alert = { ...base, id: 2, state: 'resolved', status: 'watch', peakStatus: 'act', resolvedAt: 90_000_000 }
  render(<AlertsView {...props} active={[base, watch]} resolved={[resolved]} />)
  fireEvent.click(screen.getByRole('button', { name: /Watch$/ }))
  expect(within(screen.getByRole('list', { name: 'Active alerts' })).getAllByRole('button')).toHaveLength(1)
  expect(screen.getByLabelText('HRV: WATCH')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Resolved$/ }))
  const list = screen.getByRole('list', { name: 'Resolved alerts' })
  expect(within(list).getByText(/peak ACT/)).toBeTruthy()
  expect(screen.queryByRole('list', { name: 'Recently resolved' })).toBeNull()
  // a resolved alert is read-only
  expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull()
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

it('names the NASA limit a CO₂ alert is checked against, above the NASA evidence', () => {
  const co2: Alert = { ...base, id: 4, ruleId: 'co2', kind: 'limit', metric: 'co2', hazard: 'E', explanation: 'CO₂ has exceeded the 3 mmHg habitat limit for 6 consecutive hours.' }
  render(<AlertsView {...props} active={[co2]} />)
  const ev = screen.getByRole('region', { name: 'NASA evidence' })
  const items = within(ev).getAllByRole('listitem')
  expect(items[0].textContent).toContain('NASA limit')
  expect(within(items[0]).getByRole('link').getAttribute('href')).toMatch(/^https:\/\/www\.nasa\.gov\/.*carbon-dioxide\.pdf$/)
  expect(items[0].textContent).toContain('3 mmHg ppCO₂, 1-hour average')
  expect(items[1].textContent).toContain('NASA NTRS')
})
