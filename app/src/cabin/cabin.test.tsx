// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsoleDB } from '../data/db'
import { demoLoaded, seedDemo } from '../data/demo'
import { CREW, DAY } from '../data/synthetic'
import type { Alert } from '../data/types'
import CabinPage from './CabinPage'
import { dailyMeans, loadCabinAlerts, loadCabinTrend, median, pickFocus, toCabinAlert } from './data'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('pickFocus', () => {
  const crew = [
    { id: 'cmdr', status: 'nominal' as const, alerts: 0 },
    { id: 'pilot', status: 'watch' as const, alerts: 1 },
    { id: 'eng', status: 'watch' as const, alerts: 2 },
  ]
  it('follows the worst status, then the most alerts', () => {
    expect(pickFocus(crew, 'cmdr')).toBe('eng')
    expect(pickFocus([...crew, { id: 'med', status: 'act', alerts: 0 }], 'cmdr')).toBe('med')
  })
  it('keeps the selected crew member when everyone is nominal', () => {
    expect(pickFocus(crew.map((c) => ({ ...c, status: 'nominal' as const, alerts: 0 })), 'pilot')).toBe('pilot')
  })
})

describe('dailyMeans', () => {
  it('averages each day and carries the last mean over a gap', () => {
    const rows = [{ ts: 0, value: 60 }, { ts: 1000, value: 70 }, { ts: 2 * DAY, value: 80 }]
    expect(dailyMeans(rows, 0, 4)).toEqual([65, 65, 80, 80])
  })
  it('takes the median of odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
})

it('words an alert as what, why and the next open step', () => {
  const a = {
    id: 7, crewId: 'eng', ruleId: 'hr', kind: 'baseline', hazard: 'G', metric: 'hr', status: 'watch', peakStatus: 'watch', state: 'open',
    z: 2.4, value: 92.4, baselineMean: 78.1, explanation: 'Heart rate is up for two days.',
    steps: [{ text: 'Log a rest block', done: true }, { text: 'Recheck in 4 h', done: false }], openedAt: 0,
  } satisfies Alert
  expect(toCabinAlert(a, 'Flight Engineer')).toMatchObject({
    title: 'Flight Engineer · Heart rate', detail: '92.4 bpm vs baseline 78.1 bpm', why: 'Heart rate is up for two days.', next: 'Recheck in 4 h', status: 'watch',
  })
})

it('loads the demo mission: six crew, worst alerts first, a 30-day trend with a band', async () => {
  const d = new ConsoleDB('cabin-demo')
  await seedDemo(undefined, d)
  expect(await demoLoaded(d)).toBe(true)
  expect(await d.crew.count()).toBe(CREW.length)
  const names = new Map(CREW.map((c) => [c.id, c.name]))
  const alerts = await loadCabinAlerts(names, 3, d)
  expect(alerts.length).toBeGreaterThan(0)
  const rank = { act: 2, watch: 1, nominal: 0, resolved: -1 }
  for (let i = 1; i < alerts.length; i++) expect(rank[alerts[i - 1].status]).toBeGreaterThanOrEqual(rank[alerts[i].status])
  const last = await d.readings.orderBy('ts').last()
  const trend = await loadCabinTrend('eng', last!.ts, 30, d)
  expect(trend.days).toHaveLength(30)
  expect(trend.median).toHaveLength(30)
  expect(trend.band?.[0]).toBeLessThan(trend.band![1])
})

it('a browser with the old 4-person crew counts as not loaded, so it is re-seeded', async () => {
  const d = new ConsoleDB('cabin-old-roster')
  await d.crew.bulkAdd(CREW.slice(0, 4))
  expect(await demoLoaded(d)).toBe(false)
})

it('without WebGL the page says so and offers the way back', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  render(<MemoryRouter initialEntries={['/cabin']}><CabinPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: '3D mode needs WebGL' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Back to the console/ })).toBeTruthy()
  expect(screen.getByRole('navigation', { name: 'Tour stops' }).querySelectorAll('button')).toHaveLength(10)
})
