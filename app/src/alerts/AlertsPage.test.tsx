// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'

afterEach(cleanup)

it('alert -> tick a step -> Done writes the action to the on-board log', async () => {
  render(<MemoryRouter initialEntries={['/alerts']}><App /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /^Flight Engineer/ }, { timeout: 120_000 }))
  const list = await screen.findByRole('list', { name: 'Active alerts' })
  const card = within(list).getAllByRole('listitem')[0]
  const box = within(card).getAllByRole('checkbox')[0] as HTMLInputElement
  expect(box.checked).toBe(false)
  const before = await db.actionLog.count()

  fireEvent.click(box)
  await waitFor(() => expect((within(card).getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true))
  expect(await db.actionLog.count()).toBe(before + 1)

  fireEvent.click(within(card).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(within(card).getByRole('button', { name: 'Done · logged' })).toBeTruthy())
  const entries = await db.actionLog.toArray()
  expect(entries.filter((e) => e.kind === 'step-done' && e.sync === 'pending').length).toBeGreaterThanOrEqual(2)
  expect(await db.alerts.where('state').equals('acknowledged').count()).toBeGreaterThan(0)
}, 150_000)
