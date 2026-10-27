// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'

afterEach(cleanup)
// Every wait here reads the whole app over the 20k-reading demo seed in fake IndexedDB; with test files
// running in parallel, a database reload or a lazy route can take longer than the 1 s default.
configure({ asyncUtilTimeout: 15_000 })

it('injects a solar event into the live demo, moves the clock and reports the new radiation alert', async () => {
  render(<MemoryRouter initialEntries={['/simulator']}><App /></MemoryRouter>)
  const solar = (await screen.findByText('Solar particle event', {}, { timeout: 120_000 })).closest('li')!
  expect(screen.getByLabelText('Mission elapsed time').textContent).toBe('D29 23:00 MET')
  fireEvent.click(within(solar).getByRole('button', { name: 'Inject' }))
  // the inject runs a day of readings through the engine in fake IndexedDB, slow under a full parallel run
  const last = await screen.findByLabelText('Last run', {}, { timeout: 120_000 })
  expect(last.textContent).toMatch(/Dose rate \(ACT\)/)
  await waitFor(() => expect(screen.getByLabelText('Mission elapsed time').textContent).toBe('D30 05:00 MET'), { timeout: 5000 })
  expect(screen.getByLabelText('Active scenarios').textContent).toContain('Solar particle event')
  expect((await db.readings.orderBy('ts').last())!.ts).toBe(MISSION_START + 30 * DAY + 5 * HOUR)
}, 250_000)
