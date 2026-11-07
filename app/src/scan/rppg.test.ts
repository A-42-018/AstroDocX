import { describe, expect, it } from 'vitest'
import { MIN_SNR_DB, analyze, bandpass, resample, spectrum, type Sample } from './rppg'

/** Small deterministic noise, so a failing run is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 - 0.5 }
}

interface Synth { bpm?: number; seconds?: number; noise?: number; pulse?: number; wander?: number; breathHz?: number; fps?: number; seed?: number; jitter?: number; rsa?: number }

/** Mean skin colour per frame: a pulse that moves green most, slow breathing drift, lighting wander and sensor noise. */
function synth({ bpm = 72, seconds = 32, noise = 0.0015, pulse = 0.012, wander = 0.02, breathHz = 0.25, fps = 30, seed = 1, jitter = 4, rsa = 0 }: Synth = {}): Sample[] {
  const rand = rng(seed)
  const out: Sample[] = []
  const f = bpm / 60
  for (let i = 0; i < seconds * fps; i++) {
    const t = i / fps + (rand() * jitter) / 1000
    // breathing speeds and slows the heart (RSA): the phase is the integral of f * (1 + rsa * sin(wt))
    const w = 2 * Math.PI * breathHz
    const phase = 2 * Math.PI * f * (t + (rsa && w ? (rsa * (1 - Math.cos(w * t))) / w : 0))
    const beat = Math.sin(phase) + 0.3 * Math.sin(2 * phase + 1)
    const light = 1 + wander * Math.sin(2 * Math.PI * 0.07 * t) + 0.004 * Math.sin(2 * Math.PI * breathHz * t)
    const n = () => 1 + noise * rand() * 3.4
    out.push({
      t: t * 1000,
      r: 182 * light * (1 + 0.4 * pulse * beat) * n(),
      g: 121 * light * (1 + 1.0 * pulse * beat) * n(),
      b: 104 * light * (1 + 0.6 * pulse * beat) * n(),
    })
  }
  return out
}

describe('rPPG', () => {
  it('resamples uneven camera frames onto an even 30 Hz grid', () => {
    const s = synth({ seconds: 5, jitter: 12 })
    const g = resample(s)
    expect(g.fs).toBe(30)
    expect(g.g.length).toBeGreaterThanOrEqual(149)
    expect(g.g.length).toBeLessThanOrEqual(151)
  })

  it('finds the heart rate across the physiological range', () => {
    for (const bpm of [48, 60, 72, 95, 120, 150]) {
      const a = analyze(synth({ bpm }))
      expect(a.reliable, `${bpm} bpm reliable`).toBe(true)
      expect(Math.abs((a.bpm ?? 0) - bpm), `${bpm} bpm error`).toBeLessThan(2)
      expect(a.quality).toBeGreaterThan(0.5)
    }
  })

  it('ignores slow lighting wander (it is brightness, not pulse)', () => {
    const a = analyze(synth({ bpm: 66, wander: 0.15 }))
    expect(Math.abs((a.bpm ?? 0) - 66)).toBeLessThan(2.5)
  })

  it('still reads a pulse when the video is noisy', () => {
    const a = analyze(synth({ bpm: 80, noise: 0.006 }))
    expect(a.reliable).toBe(true)
    expect(Math.abs((a.bpm ?? 0) - 80)).toBeLessThan(3)
  })

  it('refuses to report a rate for noise with no pulse in it', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const a = analyze(synth({ pulse: 0, noise: 0.004, seed }))
      expect(a.reliable, `seed ${seed} snr ${a.snr.toFixed(1)}`).toBe(false)
      expect(a.snr).toBeLessThan(MIN_SNR_DB)
    }
  })

  it('counts the beats and gives a small HRV for a steady pulse', () => {
    const a = analyze(synth({ bpm: 70, seconds: 34 }))
    expect(a.beatCount).toBeGreaterThan(30)
    expect(a.hrv).not.toBeNull()
    // a metronome-regular pulse has near-zero variability; the estimate is the detector's own jitter
    expect(a.hrv!).toBeLessThan(40)
  })

  it('reads more variability from a pulse that speeds and slows with breathing', () => {
    const steady = analyze(synth({ bpm: 70, seconds: 40, seed: 3 })).hrv
    const varied = analyze(synth({ bpm: 70, seconds: 40, seed: 3, rsa: 0.07 })).hrv
    expect(steady).not.toBeNull()
    expect(varied).not.toBeNull()
    expect(varied!).toBeGreaterThan(steady! + 15)
  })

  it('reports no HRV from a clip too short to have enough beats', () => {
    expect(analyze(synth({ seconds: 12 })).hrv).toBeNull()
  })

  it('reads the breathing rate from slow drift', () => {
    const a = analyze(synth({ breathHz: 0.25, wander: 0, seconds: 40 }))
    expect(a.resp).not.toBeNull()
    expect(Math.abs((a.resp ?? 0) - 15)).toBeLessThan(2)
  })

  it('reports no breathing rate when there is no breathing rhythm in the signal', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const a = analyze(synth({ breathHz: 0, wander: 0, seed, seconds: 40, noise: 0.004, jitter: 12 }))
      expect(a.reliable).toBe(true)
      expect(a.resp, `seed ${seed}`).toBeNull()
    }
  })

  it('needs enough signal before it says anything', () => {
    const a = analyze(synth({ seconds: 4 }))
    expect(a.bpm).toBeNull()
    expect(a.reliable).toBe(false)
  })

  it('band-pass keeps the pulse band and drops drift and fast noise', () => {
    const fs = 30, n = 600
    const mk = (hz: number) => Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * hz * i) / fs))
    const amp = (x: Float64Array) => Math.sqrt(x.slice(120, 480).reduce((a, v) => a + v * v, 0) / 360)
    expect(amp(bandpass(mk(1.2), 0.7, 3))).toBeGreaterThan(0.6)
    expect(amp(bandpass(mk(0.1), 0.7, 3))).toBeLessThan(0.1)
    expect(amp(bandpass(mk(7), 0.7, 3))).toBeLessThan(0.1)
  })

  it('spectrum peaks at the sine frequency', () => {
    const x = Array.from({ length: 300 }, (_, i) => Math.sin((2 * Math.PI * 1.5 * i) / 30))
    const { freqs, power } = spectrum(x, 30, 0.7, 3, 0.01)
    expect(freqs[power.indexOf(Math.max(...power))]).toBeCloseTo(1.5, 1)
  })
})
