// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TrendsView } from './TrendsView'
import type { TrendSeries } from './series'

afterEach(cleanup)

const crew = [{ id: 'cmdr', name: 'Commander', role: 'Commander' }, { id: 'pilot', name: 'Pilot', role: 'Pilot' }]
const series: TrendSeries[] = [
  { metric: 'sleep', points: [], markers: [{ ts: 1, value: 3, status: 'act' }], latest: 3.1, outsideBand: true },
  { metric: 'co2', points: [], markers: [], latest: 2.4, outsideBand: false },
]

it('summarises each chart in text and reports range and crew changes', () => {
  const onRange = vi.fn()
  const onSelectCrew = vi.fn()
  render(<TrendsView crew={crew} crewId="pilot" range="7d" series={series} onSelectCrew={onSelectCrew} onRange={onRange} />)
  const list = screen.getByRole('list', { name: 'Metric trends' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getAllByText(/outside personal band, 1 alert in range/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/inside personal band, 0 alerts in range/).length).toBeGreaterThan(0)

  expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '24 h' }))
  expect(onRange).toHaveBeenCalledWith('24h')
  fireEvent.click(screen.getByRole('button', { name: 'Commander' }))
  expect(onSelectCrew).toHaveBeenCalledWith('cmdr')
})
