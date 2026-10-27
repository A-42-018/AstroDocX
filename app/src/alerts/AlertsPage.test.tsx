// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'

afterEach(cleanup)
// Every wait here reads the whole app over the 20k-reading demo seed in fake IndexedDB; with test files
// running in parallel, a database reload or a lazy route can take longer than the 1 s default.
configure({ asyncUtilTimeout: 15_000 })

it('alert -> tick a step -> Done writes the action to the on-board log', async () => {
  render(<MemoryRouter initialEntries={['/alerts']}><App /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /^Flight Engineer/ }, { timeout: 120_000 }))
  await screen.findByRole('list', { name: 'Active alerts' })
  const card = await screen.findByRole('article')
  const box = within(card).getAllByRole('checkbox')[0] as HTMLInputElement
  expect(box.checked).toBe(false)
  const before = await db.actionLog.count()

  // The tick shows at once; the log entry lands when the write finishes.
  fireEvent.click(box)
  expect((within(card).getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true)
  await waitFor(async () => expect(await db.actionLog.count()).toBe(before + 1))

  fireEvent.click(within(card).getByRole('button', { name: 'Mark done' }))
  await waitFor(() => expect(within(card).getByRole('button', { name: 'Done · logged' })).toBeTruthy())
  const entries = await db.actionLog.toArray()
  expect(entries.filter((e) => e.kind === 'step-done' && e.sync === 'pending').length).toBeGreaterThanOrEqual(2)
  // the timeline shows the ticked step and the finished action card
  await waitFor(() => expect(within(card).getByRole('region', { name: 'Alert timeline' }).textContent).toContain('Action card marked done'))
  expect(await db.alerts.where('state').equals('acknowledged').count()).toBeGreaterThan(0)
}, 150_000)
