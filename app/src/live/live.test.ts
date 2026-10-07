import { describe, expect, it } from 'vitest'
import { DEFAULT_TARGETS, hashSeed, liveValues, respRate, stillValues } from './telemetry'
import { WaveGenerator, ecgShape, plethShape } from './waves'

function run(kind: 'ecg' | 'pleth' | 'resp', seed: number, rate: number, seconds: number, variability = 0.025) {
  const g = new WaveGenerator(kind, seed, rate, variability)
  const dt = 0.002
  let beats = 0
  const values: number[] = []
  for (let t = 0; t < seconds; t += dt) {
    const s = g.next(dt, rate)
    if (s.beat) beats++
    values.push(s.value)
  }
  return { beats, values }
}

describe('wave shapes', () => {
  it('ECG has one dominant R peak per beat, pleth peaks once', () => {
    const peak = (f: (p: number) => number) => { let m = 0, at = 0; for (let i = 0; i < 1000; i++) { const v = f(i / 1000); if (v > m) { m = v; at = i / 1000 } } return { m, at } }
    expect(peak(ecgShape).at).toBeCloseTo(0.3, 1)
    expect(peak(ecgShape).m).toBeGreaterThan(0.9)
    expect(peak(plethShape).at).toBeCloseTo(0.2, 1)
  })
})

describe('WaveGenerator', () => {
  it('beats at the engine heart rate', () => {
    for (const hr of [48, 62, 90, 130]) {
      const { beats } = run('ecg', 7, hr, 60)
      expect(Math.abs(beats - hr)).toBeLessThanOrEqual(3)
    }
  })

  it('is seeded: same seed same trace, different seed a different trace', () => {
    const a = run('ecg', 1, 70, 10).values
    expect(run('ecg', 1, 70, 10).values).toEqual(a)
    expect(run('ecg', 2, 70, 10).values).not.toEqual(a)
  })

  it('eases to a new rate instead of jumping', () => {
    const g = new WaveGenerator('ecg', 1, 60, 0.02, 10)
    g.next(0.1, 120)
    expect(g.currentRate).toBeCloseTo(61, 5)
    for (let i = 0; i < 1000; i++) g.next(0.01, 120)
    expect(g.currentRate).toBe(120)
  })

  it('breathes at the requested rate', () => {
    expect(Math.abs(run('resp', 3, 15, 60, 0.05).beats - 15)).toBeLessThanOrEqual(2)
  })
})

describe('live values', () => {
  it('stay close to the real readings and are deterministic', () => {
    const t = { ...DEFAULT_TARGETS, hr: 71, spo2: 96.8, co2: 2.9, dose: 31 }
    const seed = hashSeed('eng')
    let sumHr = 0
    for (let s = 0; s < 600; s++) {
      const v = liveValues(t, s, seed)
      expect(Math.abs(v.hr - t.hr)).toBeLessThanOrEqual(1.7)
      expect(Math.abs(v.spo2 - t.spo2)).toBeLessThanOrEqual(0.3)
      expect(Math.abs(v.co2 - t.co2)).toBeLessThanOrEqual(0.04)
      expect(v.spo2).toBeLessThanOrEqual(100)
      sumHr += v.hr
    }
    expect(Math.abs(sumHr / 600 - t.hr)).toBeLessThan(0.5)
    expect(liveValues(t, 12.5, seed)).toEqual(liveValues(t, 12.5, seed))
  })

  it('follow an injected CO₂ climb: breathing speeds up and the stream rises', () => {
    const calm = liveValues({ ...DEFAULT_TARGETS, co2: 2.4 }, 5, 1)
    const high = liveValues({ ...DEFAULT_TARGETS, co2: 4.2 }, 5, 1)
    expect(high.co2).toBeGreaterThan(calm.co2 + 1.5)
    expect(respRate(4.2)).toBeGreaterThan(respRate(2.4) + 5)
  })

  it('show the exact real values when still', () => {
    const t = { ...DEFAULT_TARGETS, hr: 80 }
    expect(stillValues(t).hr).toBe(80)
  })
})
