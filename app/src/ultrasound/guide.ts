import { rng } from '../data/synthetic'

/*
 * Guided acquisition, the way AR-assisted ultrasound works: the screen tells you which way to move until the image is
 * good, then captures it by itself. The probe has two slides (x, y) and a tilt, each from -1 to 1; (0, 0, 0) is the
 * textbook position for an exam. Image quality is how close the probe is to it.
 */

export interface Probe { x: number; y: number; tilt: number }

export const GOOD = 0.8 // quality at which the image counts as usable
export const HOLD_S = 3 // seconds the image must stay usable before it is captured

export const clamp = (v: number) => Math.max(-1, Math.min(1, v))

/** Where the probe starts: off target in a direction picked from the seed, so every scan begins with some searching. */
export function startProbe(seed: number): Probe {
  const r = rng(seed)
  const ang = r.next() * Math.PI * 2
  return { x: clamp(0.65 * Math.cos(ang)), y: clamp(0.65 * Math.sin(ang)), tilt: clamp((r.next() - 0.5) * 1.2) }
}

/** 0 (nothing useful on screen) to 1 (textbook view). */
export function quality(p: Probe): number {
  const d = Math.hypot(p.x, p.y, p.tilt * 0.8)
  return Math.max(0, Math.min(1, 1 - d / 1.1))
}

export interface Hint { text: string; key: 'left' | 'right' | 'up' | 'down' | 'tilt-left' | 'tilt-right' | 'hold' }

/** The single most useful instruction: fix the biggest error first. */
export function hint(p: Probe): Hint {
  if (quality(p) >= GOOD) return { text: 'Hold steady', key: 'hold' }
  const ex = Math.abs(p.x), ey = Math.abs(p.y), et = Math.abs(p.tilt * 0.8)
  if (ex >= ey && ex >= et) return p.x > 0 ? { text: 'Slide the probe left', key: 'left' } : { text: 'Slide the probe right', key: 'right' }
  if (ey >= et) return p.y > 0 ? { text: 'Slide the probe up', key: 'up' } : { text: 'Slide the probe down', key: 'down' }
  return p.tilt > 0 ? { text: 'Tilt the probe back', key: 'tilt-left' } : { text: 'Tilt the probe forward', key: 'tilt-right' }
}

/** Counts how long the image has stayed usable. Losing it fades the count rather than zeroing it, so a small wobble is forgiven. */
export class Hold {
  held = 0
  /** Returns true on the step the capture happens. */
  update(q: number, dt: number): boolean {
    if (q >= GOOD) this.held += dt
    else this.held = Math.max(0, this.held - dt * 2)
    return this.held >= HOLD_S
  }
  reset() { this.held = 0 }
}

/** One step of the automatic assist: eases the probe toward the target, a little unevenly, like a hand being steadied. */
export function assist(p: Probe, dt: number, wobble: number): Probe {
  const k = Math.min(1, dt * 1.1)
  return { x: clamp(p.x * (1 - k) + wobble * 0.08 * dt), y: clamp(p.y * (1 - k) - wobble * 0.06 * dt), tilt: clamp(p.tilt * (1 - k)) }
}
