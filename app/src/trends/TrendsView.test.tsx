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

it('summarises each chart in text and reports range changes', () => {
  const onRange = vi.fn()
  render(<TrendsView crew={crew} crewId="pilot" range="7d" series={series} onRange={onRange} />)
  const list = screen.getByRole('list', { name: 'Metric trends' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getAllByText(/outside personal band, 1 alert in range/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/inside personal band, 0 alerts in range/).length).toBeGreaterThan(0)

  expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '24 h' }))
  expect(onRange).toHaveBeenCalledWith('24h')
})

it('focuses a metric from the chips or a small multiple and shows its statistics and compare toggle', () => {
  const onFocus = vi.fn()
  const onCompare = vi.fn()
  const points = [{ ts: 1, value: 7, band: null }, { ts: 2, value: 6, band: [5, 9] as [number, number] }, { ts: 3, value: 3, band: [5, 9] as [number, number] }]
  const s: TrendSeries[] = [{ metric: 'sleep', points, markers: [], latest: 3, outsideBand: true }, { metric: 'co2', points: [], markers: [], latest: 2.4, outsideBand: false }]
  render(<TrendsView crew={crew} crewId="pilot" range="7d" series={s} onRange={() => {}} focus="sleep" onFocus={onFocus} onCompare={onCompare} />)
  const group = screen.getByRole('group', { name: 'Metric' })
  expect(within(group).getByRole('button', { name: 'Sleep last night' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(within(group).getByRole('button', { name: 'Cabin CO₂' }))
  expect(onFocus).toHaveBeenCalledWith('co2')
  fireEvent.click(screen.getByRole('button', { name: 'Focus Cabin CO₂' }))
  expect(onFocus).toHaveBeenLastCalledWith('co2')
  expect(screen.getByLabelText('Sleep last night statistics').textContent).toContain('Outside band50%')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Compare with crew median' }))
  expect(onCompare).toHaveBeenCalledWith(true)
})
