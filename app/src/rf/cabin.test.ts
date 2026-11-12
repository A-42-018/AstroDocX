import { describe, expect, it } from 'vitest'
import { CREW } from '../data/synthetic'
import { CabinScanner, CabinSim, LINKS, ZONES, classify, score, zoneAt } from './cabin'

const run = (crew: { id: string; name: string }[], seed: number, secs: number, each?: (sim: CabinSim, sc: CabinScanner, i: number) => void) => {
  const sim = new CabinSim(crew, seed), sc = new CabinScanner()
  for (let i = 0; i < secs * 10; i++) { sc.update(sim.step(0.1), 0.1); each?.(sim, sc, i) }
  return { sim, sc }
}

describe('cabin simulation', () => {
  it('is deterministic for a seed', () => {
    const a = new CabinSim(CREW, 3), b = new CabinSim(CREW, 3)
    for (let i = 0; i < 200; i++) { a.step(0.1); b.step(0.1) }
    expect(a.people()).toEqual(b.people())
    expect(a.step(0.1)).toEqual(b.step(0.1))
  })

  it('keeps everyone inside the cabin, and the crew circulate between zones', () => {
    const zonesSeen = new Set<string>()
    const { sim } = run(CREW, 5, 300, (s, _sc, i) => { if (i % 50 === 0) for (const p of s.people()) zonesSeen.add(p.name + zoneAt(p.p).id) })
    for (const p of sim.people()) { expect(p.p.x).toBeGreaterThanOrEqual(0); expect(p.p.x).toBeLessThanOrEqual(10); expect(p.p.y).toBeGreaterThanOrEqual(0); expect(p.p.y).toBeLessThanOrEqual(5) }
    expect(zonesSeen.size).toBeGreaterThan(CREW.length * 1.5)
  })

  it('disturbs links near a moving person far more than an empty cabin', () => {
    const empty = new CabinSim([], 1)
    for (let i = 0; i < 50; i++) empty.step(0.1)
    const busy = new CabinSim(CREW, 1)
    for (let i = 0; i < 50; i++) busy.step(0.1)
    const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)
    expect(sum(busy.step(0.1))).toBeGreaterThan(5 * Math.abs(sum(empty.step(0.1))) + 0.5)
    expect(LINKS.length).toBe(28)
  })
})

describe('cabin scanner', () => {
  it('finds nobody in an empty cabin', () => {
    const { sc } = run([], 1, 60)
    expect(sc.tracks.filter((t) => t.hits > 8)).toHaveLength(0)
  })

  it('locates most of the crew to within a metre, on average, and never invents a crowd', () => {
    let n = 0, found = 0, err = 0, extra = 0
    for (const seed of [5, 6, 7]) {
      run(CREW, seed, 200, (sim, sc, i) => {
        if (i < 300 || i % 10) return
        const s = score(sim.people(), sc.tracks.filter((t) => t.hits > 8))
        n++; found += s.found; err += s.meanError; extra += s.extra
      })
    }
    expect(found / n).toBeGreaterThan(3)
    expect(err / n).toBeLessThan(1)
    expect(extra / n).toBeLessThan(2)
  })

  it('labels activity correctly more often than not, among the people it found', () => {
    let found = 0, right = 0
    for (const seed of [5, 6, 7, 8]) {
      run(CREW, seed, 220, (sim, sc, i) => {
        if (i < 400 || i % 10) return
        const s = score(sim.people(), sc.tracks.filter((t) => t.hits > 8))
        found += s.found; right += s.activityRight
      })
    }
    expect(right / found).toBeGreaterThan(0.55)
  })
})

describe('activity rules', () => {
  const zone = (id: string) => ZONES.find((z) => z.id === id)!
  it('uses speed for travel and the room for what a still person is doing', () => {
    expect(classify({ speed: 0.6, energy: 0.3, zone: zone('lab') })).toBe('Moving')
    expect(classify({ speed: 0.05, energy: 0.2, zone: zone('sleep') })).toBe('Sleeping')
    expect(classify({ speed: 0.05, energy: 0.9, zone: zone('gym') })).toBe('Exercising')
    expect(classify({ speed: 0.05, energy: 0.4, zone: zone('galley') })).toBe('Eating')
    expect(classify({ speed: 0.05, energy: 0.4, zone: zone('lab') })).toBe('Working')
  })
})
