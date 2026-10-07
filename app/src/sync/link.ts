import { DAY, HOUR, MISSION_START } from '../data/synthetic'

/**
 * Simulated ground link. The schedule, window length and delay are **illustrative** (a real mission's
 * contact plan comes from its relay network): two 2-hour windows per mission day, at 00:00 and 12:00 MET.
 */
export const WINDOW_HOURS = [0, 12] as const
export const WINDOW_LEN = 2 * HOUR
/** One-way light time shown on the page; Mars ranges from about 3 to 22 minutes, 12 is a mid value. */
export const ONE_WAY_DELAY_MIN = 12

export type LinkState = 'open' | 'closed' | 'blackout'

export interface LinkInfo {
  state: LinkState
  /** Start of the next window (strictly after `ts`, or the next one after a blackout ends). */
  nextOpen: number
  /** End of the current window when open. */
  closesAt?: number
}

/** All window start times in (from, to]. */
export function windowStarts(from: number, to: number): number[] {
  const out: number[] = []
  for (let day = Math.floor((from - MISSION_START) / DAY); MISSION_START + day * DAY <= to; day++) {
    for (const h of WINDOW_HOURS) {
      const t = MISSION_START + day * DAY + h * HOUR
      if (t > from && t <= to) out.push(t)
    }
  }
  return out
}

export function linkAt(ts: number, blackout = false): LinkInfo {
  const start = windowStarts(ts - WINDOW_LEN, ts)[0]
  const nextOpen = windowStarts(ts, ts + DAY)[0]
  if (blackout) return { state: 'blackout', nextOpen }
  if (start !== undefined && ts < start + WINDOW_LEN) return { state: 'open', nextOpen, closesAt: start + WINDOW_LEN }
  return { state: 'closed', nextOpen }
}
