import { rng } from '../data/synthetic'

/*
 * A simulated Wi-Fi CSI feed (Channel State Information): what a two-antenna receiver would report for a
 * crew member breathing in a cabin. Nothing here is measured; it is a physical model, so the estimator in
 * dsp.ts has real work to do (offsets, noise, multipath, a second person, a drifting body).
 *
 * Model: H_k(t) = static multipath + body path. The body path's length changes by twice the chest
 * displacement d(t), so its phase moves by 4*pi*d/lambda_k on each subcarrier k. Both antennas see the same
 * random carrier/sampling offsets, which is why the conjugate ratio A*conj(B) cancels them.
 */

export const N_SC = 52 // subcarriers (20 MHz 802.11n)
export const CSI_HZ = 20 // frames per second
const F0 = 5.18e9 // channel 36
const DF = 312.5e3
const C = 2.998e8
export const wavelength = (k: number) => C / (F0 + (k - N_SC / 2) * DF)

export type Situation = 'calm' | 'sleep' | 'tachypnea' | 'apnea' | 'crewmate' | 'reorient' | 'empty'

export const SITUATIONS: { id: Situation; label: string; blurb: string }[] = [
  { id: 'calm', label: 'Awake, calm', blurb: 'One crew member floating still, breathing normally.' },
  { id: 'sleep', label: 'Asleep', blurb: 'Slower, very regular breathing in a sleeping bag.' },
  { id: 'tachypnea', label: 'Fast breathing', blurb: 'Breathing rises to about 26 per minute and stays there.' },
  { id: 'apnea', label: 'Breathing pause', blurb: 'Breathing stops for 15 s, over and over.' },
  { id: 'crewmate', label: 'Crewmate passes', blurb: 'A second person moves through the room; their reflections swamp the signal.' },
  { id: 'reorient', label: 'Body drifts', blurb: 'The sleeper turns slowly in microgravity; the reflection path keeps changing.' },
  { id: 'empty', label: 'Empty cabin', blurb: 'Nobody in the sensing zone.' },
]

export interface CsiFrame {
  t: number
  /** Antenna A and B: real and imaginary parts per subcarrier. */
  ar: Float32Array; ai: Float32Array
  br: Float32Array; bi: Float32Array
}

export interface SimTruth {
  /** The breathing rate the model is using right now (per minute); 0 when nobody is there or breath is held. */
  breathsPerMin: number
  situation: Situation
}

const PAUSE_PERIOD = 45
const PAUSE_START = 20
const PAUSE_LEN = 15
/** Is a breathing pause under way `s` seconds after the situation began? Exported so tests know when to look. */
export const inPause = (s: number) => s % PAUSE_PERIOD >= PAUSE_START && s % PAUSE_PERIOD < PAUSE_START + PAUSE_LEN

export class CsiSim {
  private rand = rng(0)
  private t = 0
  private since = 0
  private sit: Situation = 'calm'
  private breathPhase = 0
  private heartPhase = 0
  private rate = 14
  private amp = 1 // breathing amplitude envelope, eased so a pause does not click
  private walkPhase = 0
  private cfo = 0
  private readonly staticRe: Float64Array; private readonly staticIm: Float64Array
  private readonly staticRe2: Float64Array; private readonly staticIm2: Float64Array
  private readonly bodyTau: number
  private readonly crewTau: number
  baseRate = 14
  heartRate = 66

  readonly seed: number

  constructor(seed = 7) {
    this.seed = seed
    this.rand = rng(seed)
    // a handful of fixed reflectors (walls, racks) give each subcarrier its own static phasor
    this.staticRe = new Float64Array(N_SC); this.staticIm = new Float64Array(N_SC)
    this.staticRe2 = new Float64Array(N_SC); this.staticIm2 = new Float64Array(N_SC)
    const paths = Array.from({ length: 6 }, () => ({ g: 0.25 + 0.5 * this.rand.next(), tau: 15e-9 + 60e-9 * this.rand.next(), p: 6.28 * this.rand.next(), p2: 6.28 * this.rand.next() }))
    for (let k = 0; k < N_SC; k++) {
      const f = (k - N_SC / 2) * DF
      for (const p of paths) {
        const a = -2 * Math.PI * f * p.tau + p.p
        const a2 = -2 * Math.PI * f * p.tau + p.p2
        this.staticRe[k] += p.g * Math.cos(a); this.staticIm[k] += p.g * Math.sin(a)
        this.staticRe2[k] += p.g * Math.cos(a2); this.staticIm2[k] += p.g * Math.sin(a2)
      }
    }
    this.bodyTau = 22e-9
    this.crewTau = 31e-9
  }

  get situation() { return this.sit }

  setSituation(s: Situation) {
    if (s === this.sit) return
    this.sit = s
    this.since = 0
  }

  truth(): SimTruth {
    if (this.sit === 'empty') return { breathsPerMin: 0, situation: this.sit }
    return { breathsPerMin: this.amp < 0.3 ? 0 : this.rate, situation: this.sit }
  }

  private targetRate(): number {
    if (this.sit === 'sleep') return this.baseRate * 0.85
    if (this.sit === 'tachypnea') return 26
    return this.baseRate
  }

  /** Advance by `dt` seconds and return the CSI frame for that moment. */
  step(dt = 1 / CSI_HZ): CsiFrame {
    this.t += dt; this.since += dt
    const sit = this.sit
    this.rate += Math.max(-4 * dt, Math.min(4 * dt, this.targetRate() - this.rate))
    this.breathPhase += (dt * this.rate) / 60
    this.heartPhase += (dt * (sit === 'sleep' ? this.heartRate * 0.85 : this.heartRate)) / 60
    this.walkPhase += dt * 0.9
    const wantAmp = sit === 'apnea' && inPause(this.since) ? 0.03 : 1
    this.amp += (wantAmp - this.amp) * Math.min(1, dt * 3)

    // chest displacement in metres: ~5 mm of breathing (a little less asleep), 0.3 mm of heartbeat
    const chest = (sit === 'sleep' ? 0.0042 : 0.005) * this.amp * Math.sin(2 * Math.PI * this.breathPhase)
    const heart = 0.0003 * Math.sin(2 * Math.PI * this.heartPhase)
    // a turning, floating body moves a few centimetres, slowly, far more than the chest does
    const drift = sit === 'reorient' ? 0.03 * Math.sin(2 * Math.PI * 0.04 * this.t) + 0.02 * Math.sin(2 * Math.PI * 0.09 * this.t + 1) : 0
    const present = sit !== 'empty'
    const bodyGain = present ? 0.34 : 0
    // the second person: arms and legs swing near 1 Hz, the torso wanders
    const crew = sit === 'crewmate'
    const crewD = crew ? 0.06 * Math.sin(2 * Math.PI * this.walkPhase) + 0.03 * Math.sin(2 * Math.PI * 1.7 * this.t + 0.5) + 0.04 * Math.sin(2 * Math.PI * 0.15 * this.t) : 0

    // offsets shared by both antennas: carrier phase, plus a slope across subcarriers (timing offset)
    this.cfo += this.rand.gauss() * 0.6
    const sto = this.rand.gauss() * 0.04
    const noise = 0.012

    const ar = new Float32Array(N_SC), ai = new Float32Array(N_SC), br = new Float32Array(N_SC), bi = new Float32Array(N_SC)
    const d = chest + heart + drift
    for (let k = 0; k < N_SC; k++) {
      const lam = wavelength(k)
      const f = (k - N_SC / 2) * DF
      const base = -2 * Math.PI * f * this.bodyTau
      const pb = base + (4 * Math.PI * d) / lam
      let re1 = this.staticRe[k] + bodyGain * Math.cos(pb), im1 = this.staticIm[k] + bodyGain * Math.sin(pb)
      // antenna B sits a few cm away: a different geometry, so the body path has another phase
      const pb2 = base + 1.3 + (4 * Math.PI * d * 0.9) / lam
      let re2 = this.staticRe2[k] + bodyGain * Math.cos(pb2), im2 = this.staticIm2[k] + bodyGain * Math.sin(pb2)
      if (crew) {
        const pc = -2 * Math.PI * f * this.crewTau + (4 * Math.PI * crewD) / lam
        re1 += 0.5 * Math.cos(pc); im1 += 0.5 * Math.sin(pc)
        re2 += 0.5 * Math.cos(pc + 0.7); im2 += 0.5 * Math.sin(pc + 0.7)
      }
      const rot = this.cfo + 2 * Math.PI * (k - N_SC / 2) * sto
      const c = Math.cos(rot), s = Math.sin(rot)
      ar[k] = re1 * c - im1 * s + noise * this.rand.gauss(); ai[k] = re1 * s + im1 * c + noise * this.rand.gauss()
      br[k] = re2 * c - im2 * s + noise * this.rand.gauss(); bi[k] = re2 * s + im2 * c + noise * this.rand.gauss()
    }
    return { t: this.t, ar, ai, br, bi }
  }
}
