import { CSI_HZ, CsiSim, N_SC, type CsiFrame, type Situation } from './csi'
import { estimate, type RfEstimate } from './dsp'

/** What the sensing suggests doing next. It only ever suggests: nothing here raises an alert. */
export interface Recommendation {
  kind: 'apnea' | 'fast-breathing' | 'slow-breathing'
  /** The ultrasound exam that would answer the question (an id from ultrasound/exams.ts). */
  exam: 'lung' | 'cardiac'
  text: string
}

const KEEP = 700 // frames kept: 35 s
export const WATERFALL_COLS = 160

/** Turns a stream of estimates into a sustained recommendation (a single odd second never triggers one). */
export class AnomalyTracker {
  private run: Recommendation['kind'] | null = null
  private runS = 0
  private calmS = 0
  current: Recommendation | null = null

  /** Feed one estimate per second. */
  push(e: RfEstimate): Recommendation | null {
    let seen: Recommendation['kind'] | null = null
    if (e.apnea) seen = 'apnea'
    else if (e.breathsPerMin !== null && e.confidence >= 0.6) {
      if (e.breathsPerMin > 22) seen = 'fast-breathing'
      else if (e.breathsPerMin < 8) seen = 'slow-breathing'
    }
    if (seen && seen === this.run) this.runS++
    else { this.run = seen; this.runS = seen ? 1 : 0 }
    const need = seen === 'apnea' ? 4 : 15
    if (seen && this.runS >= need) {
      this.calmS = 0
      if (this.current?.kind !== seen) this.current = describe(seen)
    } else if (!seen && e.breathsPerMin !== null && this.current) {
      // a recommendation stays up until breathing has looked normal for 30 s
      if (++this.calmS >= 30) this.current = null
    }
    return this.current
  }

  clear() { this.current = null; this.run = null; this.runS = 0; this.calmS = 0 }
}

function describe(kind: Recommendation['kind']): Recommendation {
  if (kind === 'apnea') return { kind, exam: 'lung', text: 'Breathing movement stopped. A lung scan checks for sliding and fluid; a cardiac scan can follow.' }
  if (kind === 'fast-breathing') return { kind, exam: 'cardiac', text: 'Breathing has stayed fast. A cardiac scan checks heart function and a lung scan checks for fluid.' }
  return { kind, exam: 'lung', text: 'Breathing has stayed unusually slow. A lung scan is the quickest first look.' }
}

/**
 * The running simulation plus what the screen draws from it. Plain object, no React: the page calls `advance`
 * from its animation loop, and tests drive it the same way.
 */
export class RfFeed {
  readonly sim: CsiSim
  readonly frames: CsiFrame[] = []
  /** Breathing-band deviation per subcarrier over time, newest column last (for the waterfall). */
  readonly waterfall: Float32Array[] = []
  /** Recent points of the CSI ratio on its best subcarrier (for the I/Q arc): [re, im] pairs. */
  readonly iq: [number, number][] = []
  estimateNow: RfEstimate | null = null
  /** Seconds since the estimate last changed, so the wave can scroll smoothly between updates. */
  sinceEstimate = 0
  readonly anomaly = new AnomalyTracker()
  recommendation: Recommendation | null = null
  /** Seconds of apnea shown so far in this episode (latched so the flag does not flicker). */
  private apneaHold = 0
  apneaShown = false
  private acc = 0
  private quiet = false
  private secs = 0
  private ema = new Float32Array(N_SC)
  private devScale = 0.05
  private bestK = N_SC >> 1
  private center: [number, number] = [0, 0]

  constructor(seed = 7, baseRate = 14, heartRate = 66) {
    this.sim = new CsiSim(seed)
    this.sim.baseRate = baseRate
    this.sim.heartRate = heartRate
  }

  setSituation(s: Situation) {
    this.sim.setSituation(s)
    // a new situation starts clean: stale recommendations from the last one would be misleading
    this.anomaly.clear(); this.recommendation = null; this.apneaHold = 0; this.apneaShown = false
  }

  /** Move the simulation forward by `dt` seconds of wall time (any size; it steps in whole CSI frames). */
  advance(dt: number) {
    this.acc += dt
    const step = 1 / CSI_HZ
    while (this.acc >= step) {
      this.acc -= step
      this.push(this.sim.step(step))
    }
    this.sinceEstimate += dt
  }

  /**
   * Run `seconds` of simulation at once, so the screen opens full of signal. Only the last `estimates` seconds are
   * analysed (each analysis costs real time, and the first ones would be thrown away anyway); that is still enough
   * for a sustained change to be recognised.
   */
  prefill(seconds: number, estimates = 6) {
    const total = Math.round(seconds * CSI_HZ)
    this.quiet = true
    for (let i = 0; i < total; i++) {
      if (total - i <= estimates * CSI_HZ) this.quiet = false
      this.push(this.sim.step(1 / CSI_HZ))
    }
    this.quiet = false
    this.sinceEstimate = 0
  }

  private push(f: CsiFrame) {
    this.frames.push(f)
    if (this.frames.length > KEEP) this.frames.shift()
    const col = new Float32Array(N_SC)
    let re = 0, im = 0, absSum = 0
    for (let k = 0; k < N_SC; k++) {
      const zr = f.ar[k] * f.br[k] + f.ai[k] * f.bi[k]
      const zi = f.ai[k] * f.br[k] - f.ar[k] * f.bi[k]
      const a = Math.hypot(zr, zi)
      this.ema[k] = this.ema[k] === 0 ? a : this.ema[k] * 0.98 + a * 0.02
      col[k] = (a - this.ema[k]) / (this.ema[k] || 1)
      absSum += Math.abs(col[k])
      if (k === this.bestK) { re = zr; im = zi }
    }
    // the picture is scaled to the signal's own size, so a quiet room and a busy one both fill the colour range
    this.devScale = this.devScale * 0.99 + (absSum / N_SC) * 0.01
    const inv = 1 / Math.max(this.devScale * 2.2, 1e-4)
    for (let k = 0; k < N_SC; k++) col[k] *= inv
    this.waterfall.push(col)
    if (this.waterfall.length > WATERFALL_COLS) this.waterfall.shift()
    this.center = [this.center[0] * 0.995 + re * 0.005, this.center[1] * 0.995 + im * 0.005]
    this.iq.push([re - this.center[0], im - this.center[1]])
    if (this.iq.length > 160) this.iq.shift()
    if (++this.secs >= CSI_HZ) { this.secs = 0; if (!this.quiet) this.refresh() }
  }

  private refresh() {
    const prev = this.estimateNow?.wave
    const e = estimate(this.frames)
    // the merged wave's sign is arbitrary: keep it the same way up as last time so the trace does not flip
    if (prev && prev.length && e.wave.length) {
      const shift = e.wave.length - prev.length + CSI_HZ
      let dot = 0
      for (let i = 0; i < prev.length - CSI_HZ && i + shift >= 0 && i + shift < e.wave.length; i++) dot += prev[i + CSI_HZ] * e.wave[i + shift]
      if (dot < 0) for (let i = 0; i < e.wave.length; i++) e.wave[i] = -e.wave[i]
    }
    this.estimateNow = e
    this.sinceEstimate = 0
    // pick the subcarrier the arc follows: the one that moved most recently
    const f = this.frames
    if (f.length > 100) {
      let bv = -1
      for (let k = 0; k < N_SC; k++) {
        let s = 0, s2 = 0
        const n = Math.min(100, f.length)
        for (let i = f.length - n; i < f.length; i++) { const v = Math.hypot(f[i].ar[k], f[i].ai[k]); s += v; s2 += v * v }
        const variance = s2 / n - (s / n) ** 2
        if (variance > bv) { bv = variance; this.bestK = k }
      }
    }
    this.apneaHold = e.apnea ? 12 : Math.max(0, this.apneaHold - 1)
    this.apneaShown = this.apneaHold > 0
    this.recommendation = this.anomaly.push(e)
  }
}
