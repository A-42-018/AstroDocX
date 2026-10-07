import { liveQuery } from 'dexie'
import { db, type ConsoleDB } from '../data/db'
import { NORMAL } from '../data/synthetic'
import type { MetricId } from '../data/types'

/** The latest real (engine) readings that the simulated live signals follow. */
export interface LiveTargets { hr: number; hrv: number; spo2: number; co2: number; dose: number }
export interface LiveValues { hr: number; spo2: number; resp: number; co2: number; dose: number }

const KEYS: (keyof LiveTargets)[] = ['hr', 'hrv', 'spo2', 'co2', 'dose']
export const DEFAULT_TARGETS: LiveTargets = Object.fromEntries(KEYS.map((k) => [k, NORMAL[k as MetricId].mean])) as unknown as LiveTargets

/** Latest reading per metric for one crew member; typical values fill any gap. */
export async function loadTargets(crewId: string, d: ConsoleDB = db): Promise<LiveTargets> {
  const out = { ...DEFAULT_TARGETS }
  for (const k of KEYS) {
    const r = await d.readings.where('[crewId+metric+ts]').between([crewId, k, -Infinity], [crewId, k, Infinity]).last()
    if (r) out[k] = r.value
  }
  return out
}

export const watchTargets = (crewId: string, next: (t: LiveTargets) => void, error: () => void) =>
  liveQuery(() => loadTargets(crewId)).subscribe({ next, error })

/** Smooth wandering in about -1..1: a few slow sines, a deterministic function of time and seed. */
export function drift(tSec: number, seed: number): number {
  const k = (seed % 997) + 1
  return (Math.sin(tSec * 0.71 + k) + 0.6 * Math.sin(tSec * 1.37 + 2 * k) + 0.4 * Math.sin(tSec * 0.29 + 3 * k)) / 2
}

/** Breaths per minute: a calm 14, rising a little as cabin CO₂ climbs above its normal level. */
export const respRate = (co2: number) => 14 + Math.max(0, co2 - NORMAL.co2.mean) * 4

/**
 * What the screen shows at time `tSec`: the real value plus small seeded wobble. It never leaves the
 * neighbourhood of the real reading, so the live layer cannot disagree with the engine.
 */
export function liveValues(t: LiveTargets, tSec: number, seed: number): LiveValues {
  return {
    hr: t.hr + 1.6 * drift(tSec, seed),
    spo2: Math.min(100, t.spo2 + 0.25 * drift(tSec + 11, seed)),
    resp: respRate(t.co2) + 0.7 * drift(tSec + 23, seed),
    co2: t.co2 + 0.03 * drift(tSec + 37, seed),
    dose: t.dose + 0.25 * drift(tSec + 53, seed),
  }
}

/** The exact real values with no wobble: what a still page (reduced motion) shows. */
export const stillValues = (t: LiveTargets): LiveValues => ({ hr: t.hr, spo2: t.spo2, resp: respRate(t.co2), co2: t.co2, dose: t.dose })

export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
