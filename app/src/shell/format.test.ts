import { describe, expect, it } from 'vitest'
import { HOUR, MISSION_START } from '../data/synthetic'
import { duration, greetingFor, initials, linkSummary } from './format'

describe('shell formatting', () => {
  it('makes initials from one or more words', () => {
    expect(initials('Flight Engineer')).toBe('FE')
    expect(initials('Commander')).toBe('CO')
    expect(initials('  ')).toBe('?')
  })

  it('greets by mission time of day', () => {
    expect(greetingFor(MISSION_START + 8 * HOUR)).toBe('Good morning')
    expect(greetingFor(MISSION_START + (24 + 13) * HOUR)).toBe('Good afternoon')
    expect(greetingFor(MISSION_START + 20 * HOUR)).toBe('Good evening')
  })

  it('formats durations', () => {
    expect(duration(42 * 60000)).toBe('42m')
    expect(duration(80 * 60000)).toBe('1h 20m')
    expect(duration(-5)).toBe('0m')
  })

  it('summarises the ground link in words', () => {
    const t = MISSION_START + 6 * HOUR
    expect(linkSummary({ state: 'closed', nextOpen: t + 6 * HOUR }, t, 0).long).toBe('Link closed · opens in 6h 00m')
    expect(linkSummary({ state: 'open', nextOpen: t + 12 * HOUR, closesAt: t + HOUR }, t, 3).long).toBe('Link open · closes in 1h 00m · 3 queued')
    expect(linkSummary({ state: 'blackout', nextOpen: t }, t, 0).short).toBe('Blackout')
  })
})
