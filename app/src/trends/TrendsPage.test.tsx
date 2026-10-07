// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'
import { loadTrendData } from './data'
import { buildSeries } from './series'
import { DAY } from '../data/synthetic'

afterEach(cleanup)

it('shows a chart for every metric from the demo mission and has an insomnia marker for the pilot', async () => {
  render(<MemoryRouter initialEntries={['/trends']}><App /></MemoryRouter>)
  const list = await screen.findByRole('list', { name: 'Metric trends' }, { timeout: 120_000 })
  expect(list.querySelectorAll(':scope > li')).toHaveLength(11)

  fireEvent.click(screen.getByRole('button', { name: /^Pilot/ }))
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Pilot'))
  fireEvent.click(screen.getByRole('button', { name: '30 days' }))

  const data = await loadTrendData('pilot', db)
  const sleep = buildSeries(data.readings.sleep ?? [], data.alerts, 'sleep', data.now, 30 * DAY)
  expect(sleep.points.length).toBeGreaterThan(25)
  expect(sleep.markers.length).toBeGreaterThan(0)
  expect(sleep.points.some((p) => p.band)).toBe(true)
}, 150_000)
