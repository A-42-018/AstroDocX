import { describe, expect, it } from 'vitest'
import { METRICS, type MetricId } from '../data/types'
import { HAZARD_BASIS, RESOURCES, STANDARDS, hazardTag, standardFor } from './nasa'

describe('NASA basis', () => {
  it('covers NASA’s five hazards in RIDGE order, every metric under its own hazard', () => {
    expect(HAZARD_BASIS.map((h) => h.id).join('')).toBe('RIDGE')
    const listed = HAZARD_BASIS.flatMap((h) => h.metrics)
    expect(listed.sort()).toEqual((Object.keys(METRICS) as MetricId[]).sort())
    for (const h of HAZARD_BASIS) for (const m of h.metrics) expect(METRICS[m].hazard).toBe(h.id)
  })

  it('links only to nasa.gov sites over https', () => {
    const urls = [...RESOURCES.map((r) => r.url), ...Object.values(STANDARDS).map((s) => s.url), ...HAZARD_BASIS.flatMap((h) => h.evidence.map((e) => e.url))]
    for (const u of urls) expect(new URL(u).hostname).toMatch(/(^|\.)nasa\.gov$/)
  })

  it('names the NASA-STD-3001 limit only where the engine checks one', () => {
    expect(standardFor('co2')?.tag).toBe('STD-3001 V2 6004')
    expect(standardFor('dose')?.value).toMatch(/250 mSv/)
    expect(standardFor('noise')).toBeUndefined()
    expect(hazardTag('E')).toBe('STD-3001')
    expect(hazardTag('I')).toBe('NTRS')
    expect(hazardTag('D')).toBe('HRP')
  })
})
