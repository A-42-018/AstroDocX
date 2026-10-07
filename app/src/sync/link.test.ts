import { describe, expect, it } from 'vitest'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'
import { WINDOW_LEN, linkAt, windowStarts } from './link'

const at = (day: number, h: number, m = 0) => MISSION_START + day * DAY + h * HOUR + m * 60_000

describe('link schedule', () => {
  it('lists two window starts per day, in order', () => {
    expect(windowStarts(at(1, 0) - 1, at(2, 0))).toEqual([at(1, 0), at(1, 12), at(2, 0)])
    expect(windowStarts(at(1, 0), at(1, 12) - 1)).toEqual([])
  })
  it('is open for 2 h after a window starts, then closed until the next', () => {
    expect(linkAt(at(3, 0))).toMatchObject({ state: 'open', closesAt: at(3, 0) + WINDOW_LEN, nextOpen: at(3, 12) })
    expect(linkAt(at(3, 13, 59)).state).toBe('open')
    expect(linkAt(at(3, 14))).toMatchObject({ state: 'closed', nextOpen: at(4, 0) })
    expect(linkAt(at(3, 5))).toMatchObject({ state: 'closed', nextOpen: at(3, 12) })
  })
  it('a blackout overrides an open window', () => {
    expect(linkAt(at(3, 1), true).state).toBe('blackout')
  })
})
