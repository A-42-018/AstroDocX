import { describe, expect, it } from 'vitest'
import { ALL_EVIDENCE, evidenceFor } from './evidence'

describe('alert evidence', () => {
  it('cites only NASA OSDR and NTRS pages, OSDR studies with their DOI', () => {
    expect(ALL_EVIDENCE.length).toBeGreaterThanOrEqual(7)
    for (const e of ALL_EVIDENCE) {
      if (e.source === 'NASA OSDR') {
        expect(e.url).toMatch(/^https:\/\/osdr\.nasa\.gov\/bio\/repo\/data\/studies\/OSD-\d+$/)
        expect(e.id).toMatch(/^OSD-\d+ · doi:10\.26030\//)
      } else {
        expect(e.url).toMatch(/^https:\/\/ntrs\.nasa\.gov\/citations\/\d{11}$/)
      }
      expect(e.title.length).toBeGreaterThan(20)
    }
  })

  it('gives the HRV alert an OSDR study, as the build guide demo asks', () => {
    expect(evidenceFor('hrv').some((e) => e.source === 'NASA OSDR')).toBe(true)
    expect(evidenceFor('co2')[0].title).toMatch(/Carbon Dioxide/)
  })

  it('shows nothing rather than a loose citation where no source fits', () => {
    expect(evidenceFor('noise')).toEqual([])
    expect(evidenceFor('temp')).toEqual([])
  })
})
