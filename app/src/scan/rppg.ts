/**
 * Remote photoplethysmography (rPPG): a pulse, breathing rate and rough HRV from the tiny colour change of facial skin.
 * Pure functions, no DOM, so the maths is testable on synthetic traces.
 *
 *   mean skin RGB per frame -> uniform 30 Hz grid -> POS projection (Wang et al. 2017) -> band-pass 0.7-3 Hz
 *   -> heart rate from the spectrum, beat-to-beat intervals from the peaks, breathing from the slow band.
 *
 * A webcam is not a medical sensor. Every number here is a rough estimate with a quality score, never a diagnosis.
 */

export interface Sample { t: number; r: number; g: number; b: number }

/** Seconds of continuous clean video one scan collects. */
export const SCAN_SECONDS = 30
/** Analysis sample rate (Hz). Camera frames arrive at uneven times, so every trace is resampled onto this grid. */
export const FS = 30
/** Heart-rate search band: 42-180 bpm. */
export const HR_BAND: readonly [number, number] = [0.7, 3.0]
/** Breathing search band: 6-30 breaths per minute. */
export const RESP_BAND: readonly [number, number] = [0.1, 0.5]
/** Spectral SNR (dB) below which a heart-rate estimate is not trusted. */
export const MIN_SNR_DB = 2
/** How far above the band's median the breathing peak must stand. */
export const RESP_PROMINENCE = 15

const mean = (x: ArrayLike<number>) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return x.length ? s / x.length : 0 }
const std = (x: ArrayLike<number>) => {
  const m = mean(x); let s = 0
  for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2
  return x.length > 1 ? Math.sqrt(s / (x.length - 1)) : 0
}
const median = (x: number[]) => { const s = [...x].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0 }

export interface Grid { r: Float64Array; g: Float64Array; b: Float64Array; fs: number }

/** Linear resampling onto an even grid, so the filters and the spectrum see regular samples. */
export function resample(samples: Sample[], fs = FS): Grid {
  const n = samples.length
  if (n < 2) return { r: new Float64Array(0), g: new Float64Array(0), b: new Float64Array(0), fs }
  const t0 = samples[0].t
  const count = Math.floor(((samples[n - 1].t - t0) / 1000) * fs) + 1
  const out = { r: new Float64Array(count), g: new Float64Array(count), b: new Float64Array(count), fs }
  let j = 0
  for (let i = 0; i < count; i++) {
    const t = t0 + (i / fs) * 1000
    while (j < n - 2 && samples[j + 1].t < t) j++
    const a = samples[j], b = samples[j + 1]
    const k = b.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))
    out.r[i] = a.r + (b.r - a.r) * k
    out.g[i] = a.g + (b.g - a.g) * k
    out.b[i] = a.b + (b.b - a.b) * k
  }
  return out
}

/**
 * POS (plane-orthogonal-to-skin): project the colour-normalised channels onto two axes that cancel
 * brightness change, then mix them so the pulse stays and motion/lighting drops out. Overlap-added over a 1.6 s window.
 */
export function pos(g: Grid): Float64Array {
  const n = g.r.length
  const w = Math.max(8, Math.round(1.6 * g.fs))
  const h = new Float64Array(n)
  if (n < w) return h
  const s1 = new Float64Array(w), s2 = new Float64Array(w)
  for (let start = 0; start + w <= n; start++) {
    let mr = 0, mg = 0, mb = 0
    for (let i = 0; i < w; i++) { mr += g.r[start + i]; mg += g.g[start + i]; mb += g.b[start + i] }
    mr /= w; mg /= w; mb /= w
    if (mr <= 0 || mg <= 0 || mb <= 0) continue
    for (let i = 0; i < w; i++) {
      const rn = g.r[start + i] / mr, gn = g.g[start + i] / mg, bn = g.b[start + i] / mb
      s1[i] = gn - bn
      s2[i] = -2 * rn + gn + bn
    }
    const a = std(s2) > 1e-12 ? std(s1) / std(s2) : 0
    const win = new Float64Array(w)
    for (let i = 0; i < w; i++) win[i] = s1[i] + a * s2[i]
    const m = mean(win)
    for (let i = 0; i < w; i++) h[start + i] += win[i] - m
  }
  return h
}

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number }

/** RBJ cookbook second-order Butterworth-style section. */
function biquad(kind: 'low' | 'high', fc: number, fs: number): Biquad {
  const w0 = (2 * Math.PI * fc) / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * Math.SQRT1_2)
  const a0 = 1 + alpha
  const [b0, b1, b2] = kind === 'low' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 }
}

function run(x: Float64Array, f: Biquad): Float64Array {
  const y = new Float64Array(x.length)
  let x1 = x[0] ?? 0, x2 = x1
  // start the state at the first sample's steady-state output so the filter does not ring from zero
  const gain = f.b0 + f.b1 + f.b2, d = 1 + f.a1 + f.a2
  const dc = d !== 0 ? (gain / d) * x1 : x1
  let y1 = dc, y2 = dc
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v
  }
  return y
}

/** Zero-phase band-pass: high-pass then low-pass, run forward and backward, so beat times are not shifted. */
export function bandpass(x: Float64Array, lo: number, hi: number, fs = FS): Float64Array {
  if (x.length < 16) return new Float64Array(x.length)
  const sections = [biquad('high', lo, fs), biquad('low', Math.min(hi, fs / 2 - 0.5), fs)]
  const pad = Math.min(x.length - 1, Math.round(fs * 2))
  // reflect the ends so the edges do not carry a start-up transient
  const ext = new Float64Array(x.length + 2 * pad)
  for (let i = 0; i < pad; i++) { ext[i] = 2 * x[0] - x[pad - i]; ext[ext.length - 1 - i] = 2 * x[x.length - 1] - x[x.length - 1 - pad + i] }
  ext.set(x, pad)
  let y: Float64Array = ext
  for (const s of sections) y = run(y, s)
  y = y.slice().reverse()
  for (const s of sections) y = run(y, s)
  y = y.reverse()
  return y.slice(pad, pad + x.length)
}

/** Hann-windowed power at evenly spaced frequencies (direct DFT: a few hundred bins of a few hundred samples). */
export function spectrum(x: ArrayLike<number>, fs: number, f0: number, f1: number, df: number) {
  const n = x.length
  const m = mean(x)
  const win = new Float64Array(n), v = new Float64Array(n)
  for (let i = 0; i < n; i++) { win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); v[i] = (x[i] - m) * win[i] }
  const freqs: number[] = [], power: number[] = []
  for (let f = f0; f <= f1 + 1e-9; f += df) {
    const w = (2 * Math.PI * f) / fs
    let re = 0, im = 0
    for (let i = 0; i < n; i++) { re += v[i] * Math.cos(w * i); im -= v[i] * Math.sin(w * i) }
    freqs.push(f); power.push(re * re + im * im)
  }
  return { freqs, power }
}

export interface HeartEstimate {
  /** Beats per minute, or null when the spectrum has no clear peak. */
  bpm: number | null
  /** Pulse power (fundamental plus second harmonic) over everything else, in dB. */
  snr: number
  /** 0 to 1, from the SNR. */
  quality: number
}

/** Heart rate from the strongest spectral peak in 42-180 bpm; SNR is the share of power near that peak and its harmonic. */
export function heartRate(pulse: Float64Array, fs = FS): HeartEstimate {
  if (pulse.length < fs * 6) return { bpm: null, snr: -Infinity, quality: 0 }
  const { freqs, power } = spectrum(pulse, fs, HR_BAND[0], 4.0, 0.01)
  let k = -1, best = -1
  for (let i = 0; i < freqs.length; i++) if (freqs[i] <= HR_BAND[1] && power[i] > best) { best = power[i]; k = i }
  if (k < 0 || best <= 0) return { bpm: null, snr: -Infinity, quality: 0 }
  // parabolic interpolation between neighbouring bins
  let f = freqs[k]
  if (k > 0 && k < freqs.length - 1) {
    const a = power[k - 1], b = power[k], c = power[k + 1]
    const d = a - 2 * b + c
    if (d !== 0) f += (0.5 * (a - c)) / d * 0.01
  }
  let sig = 0, tot = 0
  for (let i = 0; i < freqs.length; i++) {
    tot += power[i]
    if (Math.abs(freqs[i] - f) <= 0.1 || Math.abs(freqs[i] - 2 * f) <= 0.1) sig += power[i]
  }
  const noise = Math.max(tot - sig, 1e-30)
  const snr = 10 * Math.log10(sig / noise)
  return { bpm: f * 60, snr, quality: Math.min(1, Math.max(0, (snr + 3) / 9)) }
}

export interface Beats {
  /** Peak times in seconds. */
  times: number[]
  /** Accepted inter-beat intervals in ms. */
  ibi: number[]
  /** RMSSD over consecutive accepted intervals, ms; null with too few. */
  rmssd: number | null
}

/**
 * Beat peaks of the band-passed pulse (parabolic interpolation, so beat times are finer than the 33 ms frame step),
 * then RMSSD over consecutive intervals that look like real beats.
 */
export function beats(pulse: Float64Array, bpm: number, fs = FS): Beats {
  const out: Beats = { times: [], ibi: [], rmssd: null }
  if (pulse.length < fs * 8 || !bpm) return out
  // A tight band round the heart rate is a matched filter: it strips the noise that makes a flat peak top wander, and leaves room for the beat-to-beat swing.
  const f = bpm / 60
  pulse = bandpass(pulse, Math.max(0.6, f - 0.45), f + 0.45, fs)
  const minGap = Math.round(fs * (60 / bpm) * 0.6)
  const sd = std(pulse)
  let lastIdx = -Infinity
  for (let i = 1; i < pulse.length - 1; i++) {
    const p = pulse[i]
    if (p <= pulse[i - 1] || p < pulse[i + 1] || p < 0.15 * sd) continue
    if (i - lastIdx < minGap) {
      // two peaks inside one beat: keep the taller
      if (p > pulse[lastIdx] && out.times.length) { out.times.pop(); lastIdx = -Infinity } else continue
    }
    const a = pulse[i - 1], c = pulse[i + 1], d = a - 2 * p + c
    const off = d !== 0 ? (0.5 * (a - c)) / d : 0
    out.times.push((i + off) / fs)
    lastIdx = i
  }
  const expected = 60000 / bpm
  const raw: (number | null)[] = []
  for (let i = 1; i < out.times.length; i++) {
    const ms = (out.times[i] - out.times[i - 1]) * 1000
    raw.push(ms > expected * 0.7 && ms < expected * 1.35 ? ms : null)
  }
  const ok = raw.filter((v): v is number => v !== null)
  const med = median(ok)
  // drop intervals far from the median: a missed or double-counted beat
  const kept = raw.map((v) => (v !== null && Math.abs(v - med) < 0.25 * med ? v : null))
  out.ibi = kept.filter((v): v is number => v !== null)
  let sum = 0, pairs = 0
  for (let i = 1; i < kept.length; i++) {
    const a = kept[i - 1], b = kept[i]
    if (a !== null && b !== null) { sum += (b - a) ** 2; pairs++ }
  }
  if (pairs >= 15) out.rmssd = Math.sqrt(sum / pairs)
  return out
}

export interface RespEstimate { perMin: number | null; prominence: number }

/** Breathing rate from slow brightness swings of the skin (and the pulse's own wobble): the strongest peak in 6-30 per minute, if it stands out. */
export function breathing(green: Float64Array, fs = FS): RespEstimate {
  if (green.length < fs * 20) return { perMin: null, prominence: 0 }
  const m = mean(green) || 1
  const norm = new Float64Array(green.length)
  for (let i = 0; i < norm.length; i++) norm[i] = green[i] / m - 1
  const slow = bandpass(norm, RESP_BAND[0], RESP_BAND[1], fs)
  const { freqs, power } = spectrum(slow, fs, RESP_BAND[0], RESP_BAND[1], 0.005)
  let k = 0
  for (let i = 1; i < power.length; i++) if (power[i] > power[k]) k = i
  // against the median, not the mean: a strong peak drags the mean up with its own leakage and caps the ratio near 10
  const mid = median(power)
  const prominence = mid > 0 ? power[k] / mid : 0
  // a peak on the band edge is the filter's skirt, not a breath
  const edge = freqs[k] <= RESP_BAND[0] + 0.04 || freqs[k] >= RESP_BAND[1] - 0.04
  // Noise alone puts a peak 4-5x above the band's median, so only a peak 15x above it counts as a breathing rhythm.
  return { perMin: prominence >= RESP_PROMINENCE && !edge ? freqs[k] * 60 : null, prominence }
}

export interface ScanAnalysis {
  seconds: number
  /** The band-passed pulse, for drawing. */
  pulse: Float64Array
  bpm: number | null
  snr: number
  quality: number
  /** Heart rate is trustworthy enough to show. */
  reliable: boolean
  hrv: number | null
  beatCount: number
  resp: number | null
}

/** Settling time dropped from the start of every analysis (the camera's auto-exposure moves at first). */
const SETTLE_S = 1.5

/** The whole chain on a run of skin samples. */
export function analyze(samples: Sample[]): ScanAnalysis {
  const grid = resample(samples)
  const skip = Math.min(Math.round(SETTLE_S * FS), Math.max(0, grid.r.length - FS * 6))
  const cut: Grid = { r: grid.r.slice(skip), g: grid.g.slice(skip), b: grid.b.slice(skip), fs: grid.fs }
  const seconds = cut.r.length / FS
  const empty: ScanAnalysis = { seconds, pulse: new Float64Array(0), bpm: null, snr: -Infinity, quality: 0, reliable: false, hrv: null, beatCount: 0, resp: null }
  if (cut.r.length < FS * 6) return empty
  const pulse = bandpass(pos(cut), HR_BAND[0], HR_BAND[1])
  const hr = heartRate(pulse)
  const reliable = hr.bpm !== null && hr.snr >= MIN_SNR_DB
  const b = reliable && hr.bpm ? beats(pulse, hr.bpm) : { times: [], ibi: [], rmssd: null }
  const resp = reliable ? breathing(cut.g).perMin : null
  return { seconds, pulse, bpm: hr.bpm, snr: hr.snr, quality: hr.quality, reliable, hrv: b.rmssd, beatCount: b.times.length, resp }
}
