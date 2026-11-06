import { describe, expect, it } from 'vitest'
import { I4_STUDIES, USED_TABLES, CREW, EXCLUDED, MARKERS, TIMEPOINTS, VALUE_COUNT, changeAt, inRange, landingSentence, landingSummary, preflightBaseline, preflightSpan } from './i4'

const marker = (id: string) => MARKERS.find((m) => m.id === id)!

describe('Inspiration4 lab data (OSD-569, OSD-575)', () => {
  it('has four anonymised crew and seven timepoints for every marker', () => {
    expect(CREW).toEqual(['C001', 'C002', 'C003', 'C004'])
    expect(TIMEPOINTS.filter((t) => t.pre)).toHaveLength(3)
    expect(TIMEPOINTS.filter((t) => !t.pre)).toHaveLength(4)
    for (const m of MARKERS) for (const c of CREW) for (const t of TIMEPOINTS) {
      const v = m.values[c][t.id]
      expect(v === null || Number.isFinite(v), `${m.id} ${c} ${t.id}`).toBe(true)
    }
  })

  it('leaves out only the corrupt C003 L-92 blood count, and says why', () => {
    expect(EXCLUDED).toHaveLength(1)
    expect(EXCLUDED[0]).toMatchObject({ crew: 'C003', tp: 'L-92', panel: 'cbc' })
    const nulls = MARKERS.flatMap((m) => CREW.flatMap((c) => TIMEPOINTS.filter((t) => m.values[c][t.id] === null).map((t) => `${m.id}:${c}:${t.id}`)))
    expect(nulls.sort()).toEqual(['hgb', 'lymph', 'neut', 'plt', 'wbc'].map((id) => `${id}:C003:L-92`).sort())
    expect(VALUE_COUNT).toBe(MARKERS.length * CREW.length * TIMEPOINTS.length - nulls.length)
  })

  it('measures change against each person’s own pre-flight mean', () => {
    const lymph = marker('lymph')
    // C003: L-92 is excluded, so the baseline is the mean of L-44 and L-3 only
    expect(preflightBaseline(lymph, 'C003')).toBeCloseTo((2083 + 3156) / 2, 5)
    expect(changeAt(lymph, 'C003', 'R+1')).toBeCloseTo(-20.4, 0)
    expect(changeAt(lymph, 'C002', 'R+1')).toBeCloseTo(-34, 0)
    expect(changeAt(marker('crp'), 'C003', 'R+1')).toBeGreaterThan(90)
    expect(preflightSpan(lymph, 'C003')).toEqual([2083, 3156])
  })

  it('checks the lab reference range only where the table gives one', () => {
    expect(inRange(marker('glu'), 103)).toBe(false)
    expect(inRange(marker('glu'), 80)).toBe(true)
    expect(inRange(marker('crp'), 5)).toBeUndefined()
    expect(inRange(marker('wbc'), null)).toBeUndefined()
  })

  it('summarises the first post-flight draw', () => {
    const s = landingSummary(marker('lymph'))
    expect(s.direction).toBe('down')
    expect(s.movers).toEqual(['C001', 'C002', 'C003'])
    expect(s.moversInRange).toBe(3)
    expect(landingSentence(marker('lymph'))).toMatch(/fell 20–34 % .* 3 of 4 crew\. All of those values still sit inside/)
    expect(landingSentence(marker('crp'))).not.toMatch(/reference range/)
    expect(landingSentence(marker('crp'))).toMatch(/^One day after landing, C-reactive protein rose 24–96 %/)
  })

  it('lists all ten Inspiration4 records and the three tables used as data', () => {
    expect(I4_STUDIES.map((s) => s.osd)).toEqual(['OSD-569', 'OSD-570', 'OSD-571', 'OSD-572', 'OSD-573', 'OSD-574', 'OSD-575', 'OSD-630', 'OSD-656', 'OSD-687'])
    expect(USED_TABLES).toHaveLength(3)
    expect(new Set(USED_TABLES.map((t) => t.osd))).toEqual(new Set(['OSD-569', 'OSD-575']))
    expect(USED_TABLES.reduce((n, t) => n + t.values, 0)).toBe(VALUE_COUNT)
  })
})
