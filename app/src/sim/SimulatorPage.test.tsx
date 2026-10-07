// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'

afterEach(cleanup)

it('injects a solar event into the live demo, moves the clock and reports the new radiation alert', async () => {
  render(<MemoryRouter initialEntries={['/simulator']}><App /></MemoryRouter>)
  const solar = (await screen.findByText('Solar particle event', {}, { timeout: 120_000 })).closest('li')!
  expect(screen.getByLabelText('Mission elapsed time').textContent).toBe('D29 23:00 MET')
  fireEvent.click(within(solar).getByRole('button', { name: 'Inject' }))
  const last = await screen.findByLabelText('Last run', {}, { timeout: 30_000 })
  expect(last.textContent).toMatch(/Dose rate \(ACT\)/)
  await waitFor(() => expect(screen.getByLabelText('Mission elapsed time').textContent).toBe('D30 05:00 MET'))
  expect(screen.getByLabelText('Active scenarios').textContent).toContain('Solar particle event')
  expect((await db.readings.orderBy('ts').last())!.ts).toBe(MISSION_START + 30 * DAY + 5 * HOUR)
}, 120_000)
