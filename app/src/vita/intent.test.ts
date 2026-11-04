import { describe, expect, it } from 'vitest'
import { TOUR_INTENT, TOUR_REPLY, wantsTour } from './intent'

describe('wantsTour', () => {
  it.each([
    'Give me the full tour',
    'can you give me a full guide?',
    'take me on a tour',
    'Tour please',
    'guide me through this',
    'Show me everything',
    'show me around',
    'Walk me through the project',
    'WALK ME THROUGH IT',
  ])('starts the tour for %j', (q) => expect(wantsTour(q)).toBe(true))

  it.each([
    'Why does CO2 matter?',
    'What does radiation do to astronauts?',
    'Take me to the EVA',
    'how do I get to the alerts',
    'tourist information',
    'detour',
    '',
  ])('does not for %j', (q) => expect(wantsTour(q)).toBe(false))

  it('shares its pattern with the landing page chat', async () => {
    const { readFileSync } = await import('node:fs')
    const js = readFileSync(new URL('../../../landing/briefing/briefing.js', import.meta.url), 'utf8')
    expect(js).toContain(String(TOUR_INTENT))
  })

  it('has a spoken reply', () => expect(TOUR_REPLY).toMatch(/follow me/i))
})
