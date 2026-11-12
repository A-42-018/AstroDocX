import { describe, expect, it } from 'vitest'
import { CSI_HZ, CsiSim, N_SC, inPause, type Situation } from './csi'
import { estimate, hampel, principal, unwrap } from './dsp'
import { AnomalyTracker, RfFeed } from './feed'

/** Run a simulation and return its estimate after `secs` seconds. */
function run(situation: Situation, secs: number, seed = 3, rate = 14) {
  const sim = new CsiSim(seed)
  sim.baseRate = rate
  sim.setSituation(situation)
  const frames = []
  for (let i = 0; i < secs * CSI_HZ; i++) { frames.push(sim.step()); if (frames.length > 700) frames.shift() }
  return { est: estimate(frames), truth: sim.truth() }
}

describe('CSI simulator', () => {
  it('is deterministic for a seed and different for another', () => {
    const a = new CsiSim(5), b = new CsiSim(5), c = new CsiSim(6)
    for (let i = 0; i < 10; i++) { a.step(); b.step(); c.step() }
    const fa = a.step(), fb = b.step(), fc = c.step()
    expect(Array.from(fa.ar)).toEqual(Array.from(fb.ar))
    expect(Array.from(fa.ar)).not.toEqual(Array.from(fc.ar))
    expect(fa.ar).toHaveLength(N_SC)
  })

  it('has a breathing pause only inside the pause window', () => {
    expect(inPause(5)).toBe(false)
    expect(inPause(25)).toBe(true)
    expect(inPause(40)).toBe(false)
    expect(inPause(45 + 25)).toBe(true)
  })
})

describe('DSP helpers', () => {
  it('hampel replaces a lone spike and leaves the rest', () => {
    const x = Float64Array.from({ length: 40 }, (_, i) => Math.sin(i / 5))
    x[20] = 50
    const y = hampel(x)
    expect(Math.abs(y[20])).toBeLessThan(2)
    expect(y[10]).toBe(x[10])
  })

  it('unwrap removes 2π jumps', () => {
    const y = unwrap(Float64Array.from([0, 3, -3, 0, 3]))
    for (let i = 1; i < y.length; i++) expect(Math.abs(y[i] - y[i - 1])).toBeLessThan(Math.PI)
  })

  it('principal merges aligned and flipped copies of one wave', () => {
    const w = Float64Array.from({ length: 200 }, (_, i) => Math.sin(i / 7))
    const merged = principal([w, w.map((v) => -v), w.map((v) => v * 0.5)])
    let dot = 0, n = 0
    for (let i = 0; i < w.length; i++) { dot += merged[i] * w[i]; n += merged[i] ** 2 }
    expect(Math.abs(dot) / Math.sqrt(n * w.reduce((s, v) => s + v * v, 0))).toBeGreaterThan(0.99)
  })
})

describe('breathing estimator', () => {
  it('waits for enough signal', () => {
    const { est } = run('calm', 8)
    expect(est.breathsPerMin).toBeNull()
    expect(est.reason).toMatch(/Collecting/)
  })

  it.each([[10], [14], [18]])('recovers a calm rate of %i per minute within 1, on several rooms', (rate) => {
    for (const seed of [1, 2, 11]) {
      const { est } = run('calm', 40, seed, rate)
      expect(Math.abs((est.breathsPerMin ?? 0) - rate)).toBeLessThan(1)
    }
    const { est } = run('calm', 40, 3, rate)
    expect(est.presence).toBe(true)
    expect(est.breathsPerMin).not.toBeNull()
    expect(Math.abs(est.breathsPerMin! - rate)).toBeLessThan(1)
    expect(est.confidence).toBeGreaterThan(0.7)
  })

  it('reads sleep (slower) and fast breathing', () => {
    const sleep = run('sleep', 40)
    expect(Math.abs(sleep.est.breathsPerMin! - sleep.truth.breathsPerMin)).toBeLessThan(1)
    const fast = run('tachypnea', 40)
    expect(Math.abs(fast.est.breathsPerMin! - 26)).toBeLessThan(1)
  })

  it('flags a breathing pause and gives no rate during it', () => {
    const { est, truth } = run('apnea', 32) // the pause runs 20-35 s; by 32 s the last 10 s are flat
    expect(truth.breathsPerMin).toBe(0)
    expect(est.apnea).toBe(true)
    expect(est.breathsPerMin).toBeNull()
  })

  it('holds back when a crewmate is moving instead of reporting a wrong rate', () => {
    for (const seed of [1, 2, 5, 11, 21]) for (const secs of [40, 70]) {
      const { est } = run('crewmate', secs, seed)
      expect(est.breathsPerMin).toBeNull()
      expect(est.disturbance).toBe('people')
    }
  })

  it('holds back when the body drifts', () => {
    for (const seed of [1, 2, 3, 11]) {
      const { est } = run('reorient', 60, seed)
      expect(est.breathsPerMin).toBeNull()
      expect(est.disturbance).toBe('drift')
    }
  })

  it('sees an empty cabin as nobody there', () => {
    for (const seed of [1, 2, 3, 4, 5, 11, 21, 31]) {
      const { est } = run('empty', 45, seed)
      expect(est.presence).toBe(false)
      expect(est.breathsPerMin).toBeNull()
      expect(est.apnea).toBe(false)
    }
  })
})

describe('recommendation', () => {
  const est = (over: Partial<ReturnType<typeof estimate>>) => ({ breathsPerMin: 14, confidence: 1, motion: 0, disturbance: 'none', fastRatio: 0, presence: true, apnea: false, snr: 9999, wave: new Float64Array(0), reason: '', ...over }) as ReturnType<typeof estimate>

  it('needs the change to be sustained', () => {
    const t = new AnomalyTracker()
    for (let i = 0; i < 3; i++) expect(t.push(est({ apnea: true, breathsPerMin: null }))).toBeNull()
    expect(t.push(est({ apnea: true, breathsPerMin: null }))?.exam).toBe('lung')
    const f = new AnomalyTracker()
    for (let i = 0; i < 14; i++) expect(f.push(est({ breathsPerMin: 27 }))).toBeNull()
    expect(f.push(est({ breathsPerMin: 27 }))?.exam).toBe('cardiac')
  })

  it('ignores low-confidence fast readings and a single odd second', () => {
    const t = new AnomalyTracker()
    for (let i = 0; i < 30; i++) expect(t.push(est({ breathsPerMin: 27, confidence: 0.3 }))).toBeNull()
    expect(t.push(est({ apnea: true, breathsPerMin: null }))).toBeNull()
    expect(t.push(est({}))).toBeNull()
  })

  it('stays up until breathing has looked normal for 30 s', () => {
    const t = new AnomalyTracker()
    for (let i = 0; i < 5; i++) t.push(est({ apnea: true, breathsPerMin: null }))
    for (let i = 0; i < 29; i++) expect(t.push(est({}))).not.toBeNull()
    expect(t.push(est({}))).toBeNull()
  })

  it('end to end: a breathing-pause situation raises a lung suggestion in the feed', () => {
    const feed = new RfFeed(11)
    feed.prefill(32)
    feed.setSituation('apnea')
    feed.advance(70)
    expect(feed.recommendation?.exam).toBe('lung')
    feed.setSituation('calm')
    expect(feed.recommendation).toBeNull()
  })
})
