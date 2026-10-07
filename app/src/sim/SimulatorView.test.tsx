// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SimulatorView } from './SimulatorView'
import { makeInjection } from './advance'
import { MISSION_START } from '../data/synthetic'
import type { Alert } from '../data/types'

afterEach(cleanup)

const crew = [{ id: 'cmdr', name: 'Commander', role: 'Commander' }, { id: 'pilot', name: 'Pilot', role: 'Pilot' }]
const handlers = () => ({ onInject: vi.fn(), onAdvance: vi.fn(), onCancel: vi.fn(), onReset: vi.fn() })
const base = { crew, now: MISSION_START, injections: [], last: null, busy: false, error: '' }

it('injects a scenario for its default crew, or a chosen person, and advances time', () => {
  const h = handlers()
  render(<SimulatorView {...base} {...h} />)
  const insomnia = screen.getByText('Insomnia streak').closest('li')!
  fireEvent.click(within(insomnia).getByRole('button', { name: 'Inject' }))
  expect(h.onInject).toHaveBeenLastCalledWith('insomnia', ['pilot'])
  fireEvent.change(within(insomnia).getByLabelText('Who'), { target: { value: 'cmdr' } })
  fireEvent.click(within(insomnia).getByRole('button', { name: 'Inject' }))
  expect(h.onInject).toHaveBeenLastCalledWith('insomnia', ['cmdr'])
  const solar = screen.getByText('Solar particle event').closest('li')!
  fireEvent.click(within(solar).getByRole('button', { name: 'Inject' }))
  expect(h.onInject).toHaveBeenLastCalledWith('solar', ['cmdr', 'pilot'])

  fireEvent.click(screen.getByRole('button', { name: '+1 day' }))
  expect(h.onAdvance).toHaveBeenCalledWith(24)
})

it('lists running scenarios and lets one end', () => {
  const h = handlers()
  render(<SimulatorView {...base} {...h} injections={[makeInjection('co2', ['cmdr', 'pilot'], MISSION_START)]} />)
  expect(within(screen.getByLabelText('Active scenarios')).getByText(/CO₂ scrubber fault/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'End now' }))
  expect(h.onCancel).toHaveBeenCalledWith(0)
})

it('asks before erasing data on reset and disables controls while busy', () => {
  const h = handlers()
  const { rerender } = render(<SimulatorView {...base} {...h} />)
  fireEvent.click(screen.getByRole('button', { name: 'Reset to demo mission' }))
  expect(h.onReset).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Yes, erase and reset' }))
  expect(h.onReset).toHaveBeenCalledTimes(1)
  rerender(<SimulatorView {...base} {...h} busy />)
  expect((screen.getByRole('button', { name: '+1 h' }) as HTMLButtonElement).disabled).toBe(true)
})

it('summarises the last run', () => {
  const a = { id: 1, crewId: 'pilot', ruleId: 'dose', kind: 'limit', hazard: 'R', metric: 'dose', status: 'act', peakStatus: 'act', state: 'open', z: 5, value: 60, baselineMean: 25, explanation: '', steps: [], openedAt: 1 } as Alert
  render(<SimulatorView {...base} {...handlers()} last={{ from: MISSION_START, to: MISSION_START + 6 * 3_600_000, readings: 264, opened: [a], resolved: [] }} />)
  expect(screen.getByLabelText('Last run').textContent).toContain('Pilot: Dose rate (ACT)')
})
