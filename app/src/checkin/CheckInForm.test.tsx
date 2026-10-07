// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CheckInForm } from './CheckInForm'
import type { CheckInResult } from './submit'

afterEach(cleanup)

const crew = [{ id: 'cmdr', name: 'Commander', role: 'Commander' }]
const ok: CheckInResult = { checkIn: { crewId: 'cmdr', ts: 1, mood: 4, sleepQuality: 3, symptoms: [] }, raised: [], resolved: [] }
const Stub = ({ onResult }: { onResult: (s: { medianMs: number; valid: number; lapses: number; falseStarts: number }) => void }) => (
  <button type="button" onClick={() => onResult({ medianMs: 333, valid: 5, lapses: 0, falseStarts: 0 })}>stub test</button>
)

it('blocks saving until mood and sleep quality are chosen', async () => {
  const onSubmit = vi.fn()
  render(<CheckInForm crew={crew} crewId="cmdr" now={1} onSelectCrew={() => {}} onSubmit={onSubmit} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Pick a mood')
  expect(onSubmit).not.toHaveBeenCalled()
})

it('submits the chosen answers, symptoms and reaction time, then confirms and resets', async () => {
  const onSubmit = vi.fn().mockResolvedValue(ok)
  render(<CheckInForm crew={crew} crewId="cmdr" now={42} onSelectCrew={() => {}} onSubmit={onSubmit} reactionTest={Stub as never} />)
  fireEvent.click(screen.getByLabelText(/Good/, { selector: 'input[name="mood"]' }))
  fireEvent.click(screen.getByLabelText(/Fair/))
  fireEvent.change(screen.getByLabelText(/Hours slept/), { target: { value: '6.5' } })
  fireEvent.click(screen.getByLabelText('Headache'))
  fireEvent.click(screen.getByRole('button', { name: 'stub test' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }))
  await waitFor(() => expect(screen.getByLabelText('Check-in saved')).toBeTruthy())
  expect(onSubmit).toHaveBeenCalledWith({ crewId: 'cmdr', ts: 42, mood: 4, sleepQuality: 3, sleepHours: 6.5, symptoms: ['Headache'], reactionMs: 333 })
  expect((screen.getByLabelText('Headache') as HTMLInputElement).checked).toBe(false)
})

it('shows an alert the engine raised', async () => {
  const raised: CheckInResult = { ...ok, raised: [{ id: 1, crewId: 'cmdr', ruleId: 'reaction', kind: 'baseline', hazard: 'I', metric: 'reaction', status: 'act', peakStatus: 'act', state: 'open', z: 4, value: 900, baselineMean: 310, explanation: 'Reaction time 900 ms is 4.0σ above baseline.', steps: [], openedAt: 1 }] }
  render(<CheckInForm crew={crew} crewId="cmdr" now={1} onSelectCrew={() => {}} onSubmit={vi.fn().mockResolvedValue(raised)} />)
  fireEvent.click(screen.getByLabelText(/Good/, { selector: 'input[name="mood"]' }))
  fireEvent.click(screen.getByLabelText(/Fair/))
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }))
  expect((await screen.findByLabelText('Check-in saved')).textContent).toContain('Reaction time 900 ms')
})
