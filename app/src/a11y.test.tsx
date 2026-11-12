// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)
// Every wait here reads the whole app over the 20k-reading demo seed in fake IndexedDB; with test files
// running in parallel, a database reload or a lazy route can take longer than the 1 s default.
configure({ asyncUtilTimeout: 15_000 })

it('has a skip link to the main region, names each page in the title and moves focus on navigation', async () => {
  render(<MemoryRouter initialEntries={['/board']}><App /></MemoryRouter>)
  const skip = screen.getByRole('link', { name: 'Skip to content' })
  expect(skip.getAttribute('href')).toBe('#main')
  const main = screen.getByRole('main')
  expect(main.id).toBe('main')
  expect(document.title).toBe('Status Board · AstroDocX Crew Console')
  expect(document.activeElement).not.toBe(main) // no focus jump on first load

  fireEvent.click(screen.getAllByRole('link', { name: 'Trends' })[0])
  // Trends is a lazy chunk: the route switches once it has loaded.
  await waitFor(() => expect(document.title).toBe('Trends · AstroDocX Crew Console'), { timeout: 15_000 })
  expect(document.activeElement).toBe(main)
  expect(screen.getAllByRole('link', { name: 'Trends' })[0].getAttribute('aria-current')).toBe('page')
}, 20_000)

it('gives every route exactly one h1 and keeps names on the icon-only shell controls', async () => {
  render(<MemoryRouter initialEntries={['/board']}><App /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'More options' }, { timeout: 15_000 })).toBeTruthy()
  expect(await screen.findByRole('link', { name: /^No open alerts for |^\d+ open alerts? for / }, { timeout: 15_000 })).toBeTruthy()
  for (const name of ['Status Board', 'Crew Doctor', 'Alerts', 'Trends', 'Check-in', 'Wi-Fi Sensing', 'Ultrasound', 'Simulator', 'Ground Sync', 'Ground View']) {
    const tab = screen.getAllByRole('link', { name: new RegExp(`^${name}`) })[0]
    fireEvent.click(tab)
    await waitFor(() => expect(document.title).toBe(`${name} · AstroDocX Crew Console`), { timeout: 15_000 })
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1), { timeout: 15_000 })
  }
}, 120_000)
