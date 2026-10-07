import { expect, it } from 'vitest'
import { summarize } from './pvt'

it('takes the median of valid trials and counts lapses', () => {
  expect(summarize([300, 280, 900, 310, 290])).toEqual({ medianMs: 300, valid: 5, lapses: 1, falseStarts: 0 })
})
it('averages the middle pair for an even count', () => {
  expect(summarize([200, 300, 400, 500]).medianMs).toBe(350)
})
it('counts early taps and sub-100 ms responses as false starts, not as trials', () => {
  expect(summarize(['early', 40, 300, 320, 340])).toEqual({ medianMs: 320, valid: 3, lapses: 0, falseStarts: 2 })
})
it('gives no result with fewer than three valid trials', () => {
  expect(summarize(['early', 'early', 300, 310, 'early']).medianMs).toBeNull()
  expect(summarize([]).medianMs).toBeNull()
})
