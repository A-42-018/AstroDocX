import { rng } from '../data/synthetic'

export type WaveKind = 'ecg' | 'pleth' | 'resp'

const bump = (p: number, mu: number, a: number, w: number) => a * Math.exp(-0.5 * ((p - mu) / w) ** 2)

/** One heartbeat, phase 0..1: P wave, QRS complex, T wave. About -0.25 .. 1. */
export function ecgShape(p: number): number {
  return bump(p, 0.12, 0.12, 0.025) + bump(p, 0.27, -0.12, 0.012) + bump(p, 0.3, 1, 0.011) + bump(p, 0.33, -0.22, 0.012) + bump(p, 0.55, 0.28, 0.045)
}

/** Pulse-oximeter (pleth) wave: systolic peak and a small dicrotic bump. 0 .. 1. */
export function plethShape(p: number): number {
  return bump(p, 0.2, 1, 0.09) + bump(p, 0.45, 0.28, 0.06)
}

/** Breathing: one smooth cycle. */
export const respShape = (p: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * p)

const SHAPE: Record<WaveKind, (p: number) => number> = { ecg: ecgShape, pleth: plethShape, resp: respShape }
/** Vertical range each wave is drawn in. */
export const RANGE: Record<WaveKind, [number, number]> = { ecg: [-0.3, 1.1], pleth: [-0.05, 1.1], resp: [-0.05, 1.05] }

/**
 * Streams one wave at a given rate (beats or breaths per minute). The rate eases toward its target so a
 * change in the real reading never makes the trace jump, and each cycle is stretched a little at random
 * (seeded) the way real beat-to-beat variability does: `variability` is the sd of cycle length as a fraction.
 */
export class WaveGenerator {
  private phase = 0
  private scale = 1
  private rate: number
  private readonly noise: () => number
  readonly kind: WaveKind
  private variability: number
  private slewPerSec: number

  constructor(kind: WaveKind, seed: number, startRate: number, variability = 0.025, slewPerSec = 12) {
    this.kind = kind
    this.variability = variability
    this.slewPerSec = slewPerSec
    this.rate = startRate
    this.noise = rng(seed).gauss
  }

  get currentRate() { return this.rate }

  /** Advance by `dt` seconds toward `targetRate`; `beat` is true when a new cycle started during this step. */
  next(dt: number, targetRate: number, variability = this.variability): { value: number; beat: boolean } {
    const maxStep = this.slewPerSec * dt
    this.rate += Math.max(-maxStep, Math.min(maxStep, targetRate - this.rate))
    this.phase += (dt * this.rate) / 60 / this.scale
    let beat = false
    if (this.phase >= 1) {
      this.phase -= 1
      this.scale = 1 + Math.max(-3, Math.min(3, this.noise())) * variability
      beat = true
    }
    return { value: SHAPE[this.kind](this.phase), beat }
  }
}
