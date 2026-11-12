import { bandpass, spectrum } from '../scan/rppg'
import { CSI_HZ, N_SC, type CsiFrame } from './csi'

/*
 * From raw two-antenna CSI to a breathing rate, in the order the Wi-Fi sensing papers do it:
 *  1. conjugate ratio A*conj(B) per subcarrier: the random carrier and timing offsets are common to both
 *     antennas, so they cancel and only the body's reflection is left;
 *  2. Hampel filter + phase unwrapping, so a single glitched sample cannot masquerade as a breath;
 *  3. keep the subcarriers where the breathing band stands out of the noise and merge them (principal
 *     component), because the body path is strong on some subcarriers and invisible on others;
 *  4. read the rate off the spectral peak, and refuse to answer when the peak is not clearly a breathing
 *     rhythm, when someone else is moving, or when the body itself is drifting.
 */

export const WINDOW_S = 30
export const MIN_S = 16
const BR: readonly [number, number] = [0.1, 0.6]
const TOP_K = 8

export interface RfEstimate {
  /** Breaths per minute, or null when the signal cannot support a number. */
  breathsPerMin: number | null
  /** 0 to 1: how clearly the spectrum shows one breathing rhythm. */
  confidence: number
  /** Fast, broadband movement in the room (arms, legs, a second person). 0 is still. */
  motion: number
  /** What the movement looks like: nothing, fast limb movement of someone nearby, or slow turning of the body itself. */
  disturbance: 'none' | 'people' | 'drift'
  /** Energy above 0.7 Hz (limbs) over energy below it (whole-body drift). */
  fastRatio: number
  presence: boolean
  /** True when breathing movement has all but stopped in the last 10 s. */
  apnea: boolean
  /** Breathing-band signal-to-noise of the best subcarriers (ratio, not dB). */
  snr: number
  /** The merged breathing waveform over the window (CSI_HZ samples/s), for drawing. */
  wave: Float64Array
  /** Plain-words explanation of the state, always set. */
  reason: string
}

const EMPTY: Omit<RfEstimate, 'reason'> = { snr: 0, breathsPerMin: null, confidence: 0, motion: 0, disturbance: 'none', fastRatio: 0, presence: false, apnea: false, wave: new Float64Array(0) }

const mean = (x: ArrayLike<number>) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return x.length ? s / x.length : 0 }
const variance = (x: ArrayLike<number>) => { const m = mean(x); let s = 0; for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2; return x.length ? s / x.length : 0 }
const rms = (x: ArrayLike<number>, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return b > a ? Math.sqrt(s / (b - a)) : 0 }
const median = (x: number[]) => { const s = [...x].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0 }

/** Replace samples more than 3 scaled MADs from their 7-sample neighbourhood median. */
export function hampel(x: Float64Array, half = 3): Float64Array {
  const y = x.slice()
  const w = new Float64Array(2 * half + 1)
  const sortedMedian = (n: number) => {
    for (let i = 1; i < n; i++) { const v = w[i]; let j = i - 1; while (j >= 0 && w[j] > v) { w[j + 1] = w[j]; j-- } w[j + 1] = v }
    return w[n >> 1]
  }
  for (let i = 0; i < x.length; i++) {
    const lo = Math.max(0, i - half), hi = Math.min(x.length - 1, i + half)
    const n = hi - lo + 1
    for (let j = 0; j < n; j++) w[j] = x[lo + j]
    const m = sortedMedian(n)
    for (let j = 0; j < n; j++) w[j] = Math.abs(x[lo + j] - m)
    const mad = 1.4826 * sortedMedian(n)
    if (mad > 0 && Math.abs(x[i] - m) > 3 * mad) y[i] = m
  }
  return y
}

export function unwrap(p: Float64Array): Float64Array {
  const y = p.slice()
  let off = 0
  for (let i = 1; i < p.length; i++) {
    const d = p[i] - p[i - 1]
    if (d > Math.PI) off -= 2 * Math.PI
    else if (d < -Math.PI) off += 2 * Math.PI
    y[i] = p[i] + off
  }
  return y
}

/** Leading principal component of a few series (power iteration on their small covariance matrix). */
export function principal(series: Float64Array[]): Float64Array {
  const k = series.length, n = series[0]?.length ?? 0
  if (!k) return new Float64Array(0)
  const cov: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let a = 0; a < k; a++) for (let b = a; b < k; b++) {
    let s = 0
    for (let i = 0; i < n; i++) s += series[a][i] * series[b][i]
    cov[a][b] = cov[b][a] = s
  }
  let v = new Array(k).fill(1 / Math.sqrt(k))
  for (let it = 0; it < 40; it++) {
    const nv = cov.map((row) => row.reduce((s, c, j) => s + c * v[j], 0))
    const norm = Math.hypot(...nv) || 1
    v = nv.map((x) => x / norm)
  }
  const out = new Float64Array(n)
  for (let a = 0; a < k; a++) for (let i = 0; i < n; i++) out[i] += v[a] * series[a][i]
  return out
}

/** Strongest spectral peak in a band and how far it stands above the band's median power. */
export function peak(x: Float64Array, lo: number, hi: number, df = 0.005) {
  const { freqs, power } = spectrum(x, CSI_HZ, lo, hi, df)
  let k = 0
  for (let i = 1; i < power.length; i++) if (power[i] > power[k]) k = i
  const mid = median(power)
  return { hz: freqs[k], prominence: mid > 0 ? power[k] / mid : 0, edge: freqs[k] <= lo + 0.03 || freqs[k] >= hi - 0.03 }
}

/** Merge the best subcarrier series for one band; returns the merged wave and the best per-series SNR. */
function best(cands: Float64Array[], lo: number, hi: number, noise: number[]) {
  const scored = cands.map((c, i) => {
    const bp = bandpass(c, lo, hi, CSI_HZ)
    return { bp, snr: variance(bp) / (noise[i] || 1e-30) }
  }).sort((a, b) => b.snr - a.snr)
  const top = scored.slice(0, TOP_K)
  return { wave: principal(top.map((t) => t.bp)), snr: top[0]?.snr ?? 0 }
}

export function estimate(frames: CsiFrame[]): RfEstimate {
  const n = Math.min(frames.length, WINDOW_S * CSI_HZ)
  if (n < MIN_S * CSI_HZ) return { ...EMPTY, reason: `Collecting signal (${Math.round(n / CSI_HZ)} of ${MIN_S} s)` }
  const win = frames.slice(frames.length - n)

  // 1-2: ratio per subcarrier -> amplitude and unwrapped phase series, de-glitched
  const amp: Float64Array[] = [], ph: Float64Array[] = []
  let ampMean = 0
  for (let k = 0; k < N_SC; k += 2) { // every other subcarrier: neighbours are strongly correlated, and the estimate runs every second
    const a = new Float64Array(n), p = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const f = win[i]
      const re = f.ar[k] * f.br[k] + f.ai[k] * f.bi[k]
      const im = f.ai[k] * f.br[k] - f.ar[k] * f.bi[k]
      a[i] = Math.hypot(re, im); p[i] = Math.atan2(im, re)
    }
    const aa = hampel(a)
    ampMean += mean(aa)
    amp.push(aa); ph.push(hampel(unwrap(p)))
  }
  ampMean /= amp.length
  const cands = [...amp, ...ph]

  // noise floor: what each series carries at 3-9 Hz, where neither breath nor pulse lives
  const noise = cands.map((c) => variance(bandpass(c, 3, 9, CSI_HZ)) * ((BR[1] - BR[0]) / 6))
  const { wave, snr } = best(cands, BR[0], BR[1], noise)

  // motion: broadband 1-5 Hz energy of the amplitude, relative to the signal level
  const sub = amp.filter((_, i) => i % 2 === 0) // the movement measures need only a sample of the subcarriers
  const motion = median(sub.map((a) => rms(bandpass(a, 1, 5, CSI_HZ)) / (ampMean || 1)))
  // where the movement sits: limbs swinging (fast, above 0.7 Hz) or the whole body turning slowly (below it)
  const slowRms = median(sub.map((a) => rms(bandpass(a, 0.03, 0.7, CSI_HZ))))
  const fastRms = median(sub.map((a) => rms(bandpass(a, 0.7, 5, CSI_HZ))))
  const fastRatio = slowRms > 0 ? fastRms / slowRms : 0

  const present = snr > PRESENT_SNR || motion > PRESENT_MOTION
  const busy = motion > MOTION_LIMIT
  const out = { ...EMPTY, wave, motion, fastRatio, snr, presence: present }
  if (!present) return { ...out, reason: 'No one detected in the sensing zone' }
  if (busy && fastRatio >= FAST_RATIO) return { ...out, disturbance: 'people' as const, reason: 'Another person is moving nearby; breathing cannot be separated from it' }
  if (busy) return { ...out, disturbance: 'drift' as const, reason: 'The body is drifting or turning; the reflection path keeps changing' }

  // apnea: the last 10 s hold far less breathing movement than the 20 s before
  const cut = Math.max(0, n - 10 * CSI_HZ)
  const recent = rms(wave, cut, n), before = rms(wave, 0, cut)
  const apnea = before > 0 && recent < 0.3 * before
  if (apnea) return { ...out, apnea: true, confidence: 0, reason: 'Breathing movement has stopped' }

  const pk = peak(wave, BR[0], BR[1])
  const confidence = Math.min(1, Math.max(0, (Math.log10(Math.max(pk.prominence, 1)) - 0.8) / 1.4))
  if (confidence < 0.35 || pk.edge) {
    // a strong body signal with no single rhythm in it means the path itself is changing (slow turning), not that nobody is there
    if (snr > STRONG_SNR) return { ...out, confidence, disturbance: 'drift' as const, reason: 'The body is drifting or turning; the reflection path keeps changing' }
    return { ...out, confidence, reason: 'Signal too weak for a reliable rate' }
  }

  return { ...out, breathsPerMin: pk.hz * 60, confidence, reason: confidence > 0.7 ? 'Clear breathing rhythm' : 'Breathing rhythm found, moderate confidence' }
}

export const MOTION_LIMIT = 0.05
/** Presence needs a strong narrowband signal, or clear movement. Random room noise can reach an SNR of ~100 on an unlucky channel. */
export const PRESENT_SNR = 300
export const PRESENT_MOTION = 0.03
export const FAST_RATIO = 0.5
export const STRONG_SNR = 1000
