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

export interface WindowProgress {
  /** 0..1: how far through the open window, or through the wait since the last window closed. */
  fraction: number
  /** Time until the window closes (open) or opens (closed); 0 during a blackout. */
  remainingMs: number
  mode: 'closes' | 'opens' | 'blackout'
}

/** Drives the countdown ring: elapsed share of the current window, or of the gap before the next one. */
export function windowProgress(now: number, link: LinkInfo): WindowProgress {
  if (link.state === 'blackout') return { fraction: 0, remainingMs: 0, mode: 'blackout' }
  if (link.state === 'open') {
    const closes = link.closesAt ?? now
    return { fraction: Math.min(1, Math.max(0, 1 - (closes - now) / WINDOW_LEN)), remainingMs: Math.max(0, closes - now), mode: 'closes' }
  }
  const prev = windowStarts(now - DAY, now).pop()
  const from = prev === undefined ? now - DAY / 2 : prev + WINDOW_LEN
  return { fraction: Math.min(1, Math.max(0, (now - from) / Math.max(1, link.nextOpen - from))), remainingMs: Math.max(0, link.nextOpen - now), mode: 'opens' }
}
