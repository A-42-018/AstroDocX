// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { db, resetDb } from '../data/db'
import { useWearableInsights } from './useWearableInsights'

beforeEach(async () => {
  await resetDb(db)
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => vi.useRealTimers())

const flush = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

it('loads nothing while another crew member is selected, and reloads after local midnight', async () => {
  const late = new Date(); late.setHours(23, 59, 0, 0)
  vi.setSystemTime(late)
  const where = vi.spyOn(db.wearables, 'where')

  const other = renderHook(() => useWearableInsights('pilot', 'cmdr'))
  await flush(5000)
  expect(other.result.current).toBeUndefined()
  expect(where).not.toHaveBeenCalled()
  other.unmount()

  const own = renderHook(() => useWearableInsights('cmdr', 'cmdr'))
  await flush(1000)
  expect(own.result.current).toBeDefined()
  const loads = where.mock.calls.length
  expect(loads).toBeGreaterThan(0)

  await flush(2 * 60_000) // past midnight, with no writes at all
  expect(where.mock.calls.length).toBeGreaterThan(loads)
  own.unmount()
})
