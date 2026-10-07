// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReactionTest } from './ReactionTest'

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers() })

const pad = () => screen.getByRole('button')

it('measures five taps and reports the median', () => {
  const onResult = vi.fn()
  render(<ReactionTest onResult={onResult} waitMs={() => 100} />)
  fireEvent.click(pad())
  for (const ms of [300, 250, 600, 280, 320]) {
    act(() => { vi.advanceTimersByTime(100) })
    expect(pad().textContent).toBe('TAP NOW')
    act(() => { vi.advanceTimersByTime(ms) })
    fireEvent.click(pad())
  }
  expect(screen.getByRole('status').textContent).toContain('Median 300 ms · 1 lapse · 0 early')
  expect(onResult).toHaveBeenLastCalledWith({ medianMs: 300, valid: 5, lapses: 1, falseStarts: 0 })
})

it('treats an early tap as a false start and returns no result when too few taps are valid', () => {
  const onResult = vi.fn()
  render(<ReactionTest onResult={onResult} waitMs={() => 100} />)
  fireEvent.click(pad())
  for (let i = 0; i < 5; i++) {
    fireEvent.click(pad()) // still waiting: too early
  }
  expect(screen.getByRole('status').textContent).toContain('Only 0 valid taps')
  expect(onResult).toHaveBeenLastCalledWith(null)
})
