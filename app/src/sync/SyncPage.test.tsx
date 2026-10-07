// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'

afterEach(cleanup)

it('demo: link is closed at 23:00, the next window opens at midnight, and advancing through it syncs the queue', async () => {
  render(<MemoryRouter initialEntries={['/simulator']}><App /></MemoryRouter>)
  await screen.findByText('Solar particle event', {}, { timeout: 120_000 })
  const pendingBefore = await db.actionLog.where('sync').equals('pending').count()
  expect(pendingBefore).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('link', { name: 'Ground Sync' }))
  const status = await screen.findByLabelText('Ground link status')
  expect(status.textContent).toContain('WAITING FOR WINDOW')
  expect(status.textContent).toContain('in 1.0 h')

  fireEvent.click(screen.getByRole('link', { name: 'Simulator' }))
  fireEvent.click(await screen.findByRole('button', { name: '+6 h' }))
  await screen.findByLabelText('Last run', {}, { timeout: 60_000 })
  const left = await db.actionLog.where('sync').equals('pending').filter((e) => e.ts < Date.UTC(2030, 0, 31, 0, 30)).count()
  expect(left).toBe(0)

  fireEvent.click(screen.getByRole('link', { name: 'Ground Sync' }))
  await waitFor(() => expect(screen.getByLabelText('Ground link status').textContent).toContain('WAITING FOR WINDOW'))
  expect(screen.getByLabelText('Recently synced').querySelectorAll('li').length).toBeGreaterThan(0)
}, 200_000)
