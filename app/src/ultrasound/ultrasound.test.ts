// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConsoleDB, resetDb } from '../data/db'
import { EXAMS, examById, statusOf } from './exams'
import { GOOD, HOLD_S, Hold, assist, hint, quality, startProbe } from './guide'
import { IMG_H, IMG_W, NORMAL_ANATOMY, renderFrame } from './render'
import { baselineFor, logLine, measure } from './sim'
import { flagUsScan, saveUsScan, scansFor } from './store'

const d = new ConsoleDB('us-test-db')
beforeEach(() => resetDb(d))
const exam = (id: string) => examById(id)!
const frame = () => ({ data: new Uint8ClampedArray(IMG_W * IMG_H * 4), width: IMG_W, height: IMG_H }) as unknown as ImageData

describe('measurements', () => {
  it('gives each crew member a fixed baseline close to typical', () => {
    for (const e of EXAMS) for (const m of e.measures) {
      expect(baselineFor('cdr', m)).toBe(baselineFor('cdr', m))
      if (!m.flag && m.typical) expect(Math.abs(baselineFor('cdr', m) / m.typical - 1)).toBeLessThan(0.1)
    }
    expect(baselineFor('cdr', exam('muscle').measures[0])).not.toBe(baselineFor('pilot', exam('muscle').measures[0]))
  })

  it('is deterministic for the same inputs and moves with mission day', () => {
    const a = measure(exam('muscle'), 'cdr', 100, 'expected', 1)
    expect(measure(exam('muscle'), 'cdr', 100, 'expected', 1)).toEqual(a)
    const early = measure(exam('muscle'), 'cdr', 5, 'expected', 1).values[0].value
    const late = measure(exam('muscle'), 'cdr', 120, 'expected', 1).values[0].value
    expect(late).toBeLessThan(early) // muscle thins
    const onsdEarly = measure(exam('ocular'), 'cdr', 5, 'expected', 1).values[0].value
    const onsdLate = measure(exam('ocular'), 'cdr', 120, 'expected', 1).values[0].value
    expect(onsdLate).toBeGreaterThan(onsdEarly) // the optic nerve sheath widens
  })

  it('keeps an ordinary mission scan nominal and flags the concerning case', () => {
    for (const e of EXAMS) {
      expect(measure(e, 'cdr', 20, 'expected', 2).status).toBe('nominal')
      expect(measure(e, 'cdr', 20, 'concerning', 2).status).toBe('act')
    }
  })
})

describe('status rules', () => {
  it('applies the optic-nerve and B-line thresholds', () => {
    const onsd = exam('ocular').measures[0], bl = exam('lung').measures[1]
    expect(statusOf(onsd, 4.9, 4.6)).toBe('nominal')
    expect(statusOf(onsd, 5.2, 4.6)).toBe('watch')
    expect(statusOf(onsd, 5.8, 4.6)).toBe('act')
    expect(statusOf(bl, 2, 0)).toBe('nominal')
    expect(statusOf(bl, 3, 0)).toBe('watch')
    expect(statusOf(bl, 7, 0)).toBe('act')
  })

  it('judges muscle against the person\'s own preflight value', () => {
    const m = exam('muscle').measures[0]
    expect(statusOf(m, 23, 24)).toBe('nominal')
    expect(statusOf(m, 21.5, 24)).toBe('watch') // -10 %
    expect(statusOf(m, 19, 24)).toBe('act') // -21 %
    expect(statusOf(m, 28, 24)).toBe('nominal') // bigger is not worse for muscle
  })

  it('treats absent lung sliding as the serious finding', () => {
    const s = exam('lung').measures[0]
    expect(statusOf(s, 1, 1)).toBe('nominal')
    expect(statusOf(s, 0, 1)).toBe('act')
  })
})

describe('guided acquisition', () => {
  it('starts off target and quality rises as the probe nears the target', () => {
    const p = startProbe(42)
    expect(quality(p)).toBeLessThan(GOOD)
    expect(quality({ x: 0, y: 0, tilt: 0 })).toBe(1)
    expect(quality({ x: 0.2, y: 0, tilt: 0 })).toBeGreaterThan(quality({ x: 0.5, y: 0, tilt: 0 }))
  })

  it('tells the user to fix the biggest error first', () => {
    expect(hint({ x: 0.6, y: 0.1, tilt: 0 }).key).toBe('left')
    expect(hint({ x: -0.6, y: 0.1, tilt: 0 }).key).toBe('right')
    expect(hint({ x: 0.1, y: 0.6, tilt: 0 }).key).toBe('up')
    expect(hint({ x: 0.1, y: -0.6, tilt: 0 }).key).toBe('down')
    expect(hint({ x: 0, y: 0, tilt: 0 }).key).toBe('hold')
  })

  it('captures only after the view stays good for the hold time, and forgives a small wobble', () => {
    const h = new Hold()
    for (let t = 0; t < HOLD_S - 0.1; t += 0.1) expect(h.update(0.95, 0.1)).toBe(false)
    h.update(0.4, 0.2) // a wobble
    expect(h.held).toBeGreaterThan(0)
    let fired = false
    for (let t = 0; t < 2 && !fired; t += 0.1) fired = h.update(0.95, 0.1)
    expect(fired).toBe(true)
    const bad = new Hold()
    for (let i = 0; i < 100; i++) expect(bad.update(0.5, 0.1)).toBe(false)
  })

  it('the assisted hand brings any start position to a usable view', () => {
    let p = startProbe(7)
    for (let i = 0; i < 24 * 5; i++) p = assist(p, 1 / 24, Math.sin(i / 5))
    expect(quality(p)).toBeGreaterThanOrEqual(GOOD)
  })
})

describe('picture', () => {
  it('draws every exam, brighter and sharper when on target than far off', () => {
    const img = frame()
    for (const e of EXAMS) {
      renderFrame(img, e.id, { t: 1, heartHz: 1, breathHz: 0.25 }, { x: 0, y: 0, tilt: 0 }, NORMAL_ANATOMY)
      const good = img.data.slice()
      renderFrame(img, e.id, { t: 1, heartHz: 1, breathHz: 0.25 }, { x: 0.9, y: 0.9, tilt: 0.9 }, NORMAL_ANATOMY)
      const sum = (a: Uint8ClampedArray) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += a[i + 2]; return s }
      expect(sum(good)).toBeGreaterThan(IMG_W * IMG_H * 8)
      expect(sum(good)).not.toBe(sum(img.data))
    }
  })

  it('a thinner muscle makes a different picture', () => {
    const a = frame(), b = frame()
    const probe = { x: 0, y: 0, tilt: 0 }
    renderFrame(a, 'muscle', { t: 0, heartHz: 1, breathHz: 0.25 }, probe, NORMAL_ANATOMY)
    renderFrame(b, 'muscle', { t: 0, heartHz: 1, breathHz: 0.25 }, probe, { ...NORMAL_ANATOMY, thickness: 17 })
    expect(Array.from(a.data)).not.toEqual(Array.from(b.data))
  })
})

describe('storage', () => {
  it('saves a scan with a pending log entry, and the log can be flagged for the surgeon', async () => {
    const result = measure(exam('lung'), 'cdr', 30, 'concerning', 1)
    const s = await saveUsScan({ crewId: 'cdr', ts: 1000, result, quality: 0.93 }, d)
    expect(s.id).toBeDefined()
    expect(s.status).toBe('act')
    let log = await d.actionLog.toArray()
    expect(log).toHaveLength(1)
    expect(log[0].sync).toBe('pending')
    expect(log[0].text).toContain('simulated')
    expect(log[0].text).toContain('ABSENT')
    expect(await d.readings.count()).toBe(0)
    expect(await d.alerts.count()).toBe(0)

    await flagUsScan(s, 2000, d)
    log = await d.actionLog.toArray()
    expect(log).toHaveLength(2)
    expect(log[1].text.startsWith('FLAGGED')).toBe(true)
    expect((await scansFor('cdr', 'lung', 12, d))[0].flagged).toBe(true)
  })

  it('returns scans of one exam for one person, oldest first', async () => {
    for (const [ts, id] of [[30, 'muscle'], [10, 'muscle'], [20, 'lung']] as const) {
      await saveUsScan({ crewId: 'cdr', ts, result: measure(exam(id), 'cdr', ts, 'expected', ts), quality: 0.9 }, d)
    }
    await saveUsScan({ crewId: 'pilot', ts: 5, result: measure(exam('muscle'), 'pilot', 5, 'expected', 1), quality: 0.9 }, d)
    expect((await scansFor('cdr', 'muscle', 12, d)).map((s) => s.ts)).toEqual([10, 30])
  })

  it('log text names the preflight value so Ground can judge the change', () => {
    const r = measure(exam('muscle'), 'cdr', 90, 'expected', 1)
    expect(logLine(exam('muscle'), r, 0.9)).toMatch(/preflight \d/)
  })
})
