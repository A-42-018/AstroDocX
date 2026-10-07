// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { CheckInForm } from './CheckInForm'
import type { CheckInResult } from './submit'

afterEach(cleanup)

const crew = [{ id: 'cmdr', name: 'Commander', role: 'Commander' }]
const ok: CheckInResult = { checkIn: { crewId: 'cmdr', ts: 1, mood: 4, sleepQuality: 3, symptoms: [] }, raised: [], resolved: [] }
const Stub = ({ onResult }: { onResult: (s: { medianMs: number; valid: number; lapses: number; falseStarts: number }) => void }) => (
  <button type="button" onClick={() => onResult({ medianMs: 333, valid: 5, lapses: 0, falseStarts: 0 })}>stub test</button>
)
const next = () => fireEvent.click(screen.getByRole('button', { name: /Next/ }))
const mount = (props: Partial<React.ComponentProps<typeof CheckInForm>> = {}) =>
  render(<MemoryRouter><CheckInForm crew={crew} crewId="cmdr" now={42} onSubmit={vi.fn().mockResolvedValue(ok)} {...props} /></MemoryRouter>)

it('asks one question at a time and holds Next until it is answered', () => {
  mount()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Step 1 of 4: Mood')
  expect((screen.getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText(/Good/))
  expect((screen.getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(false)
  next()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Step 2 of 4: Sleep')
  expect((screen.getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Back/ }))
  expect((screen.getByLabelText(/Good/) as HTMLInputElement).checked).toBe(true)
})

it('submits the chosen answers, symptoms and reaction time, then confirms and resets', async () => {
  const onSubmit = vi.fn().mockResolvedValue(ok)
  mount({ onSubmit, reactionTest: Stub as never })
  fireEvent.click(screen.getByLabelText(/Good/)); next()
  fireEvent.click(screen.getByLabelText(/Fair/))
  fireEvent.change(screen.getByLabelText(/Hours slept/), { target: { value: '6.5' } }); next()
  fireEvent.click(screen.getByLabelText('Headache')); next()
  fireEvent.click(screen.getByRole('button', { name: 'stub test' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }))
  await waitFor(() => expect(screen.getByLabelText('Check-in saved')).toBeTruthy())
  expect(onSubmit).toHaveBeenCalledWith({ crewId: 'cmdr', ts: 42, mood: 4, sleepQuality: 3, sleepHours: 6.5, symptoms: ['Headache'], reactionMs: 333 })
  expect(screen.getByText('What happens next')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'View the board' }).getAttribute('href')).toBe('/board')
  // a new check-in starts clean
  fireEvent.click(screen.getByRole('button', { name: 'Add another check-in' }))
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Step 1 of 4: Mood')
  expect((screen.getByLabelText(/Good/) as HTMLInputElement).checked).toBe(false)
})

it('shows an alert the engine raised and links to it', async () => {
  const raised: CheckInResult = { ...ok, raised: [{ id: 1, crewId: 'cmdr', ruleId: 'reaction', kind: 'baseline', hazard: 'I', metric: 'reaction', status: 'act', peakStatus: 'act', state: 'open', z: 4, value: 900, baselineMean: 310, explanation: 'Reaction time 900 ms is 4.0σ above baseline.', steps: [], openedAt: 1 }] }
  mount({ onSubmit: vi.fn().mockResolvedValue(raised) })
  fireEvent.click(screen.getByLabelText(/Good/)); next()
  fireEvent.click(screen.getByLabelText(/Fair/)); next(); next()
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }))
  expect((await screen.findByLabelText('Check-in saved')).textContent).toContain('Reaction time 900 ms')
  expect(screen.getByRole('link', { name: 'Open Alerts' }).getAttribute('href')).toBe('/alerts')
})
