/**
 * Local-time bucketing for wearable data. Days, hours and the night window follow the wearer's clock, not UTC.
 * The offset is in minutes east of UTC (UTC+6 → 360), fixed for a whole run: a DST change shifts buckets by an hour
 * for the days after it, which is acceptable for daily personal baselines.
 */

const MIN = 60_000
const HOUR = 3600_000

/** The browser's current offset in minutes east of UTC. */
export function browserTzOffsetMin(): number {
  return -new Date().getTimezoneOffset()
}

/** The local calendar day of `ts`: its 'YYYY-MM-DD' key and the real instant (epoch ms) of that local midnight. */
export function localDay(ts: number, tzOffsetMin: number): { date: string; dayStartMs: number } {
  const shifted = new Date(ts + tzOffsetMin * MIN)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth()
  const d = shifted.getUTCDate()
  return {
    date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    dayStartMs: Date.UTC(y, m, d) - tzOffsetMin * MIN,
  }
}

/** Local hour of day (0-23) of `ts`. */
export function localHour(ts: number, tzOffsetMin: number): number {
  return new Date(ts + tzOffsetMin * MIN).getUTCHours()
}

/** The real instant (epoch ms) at which the local hour containing `ts` starts. */
export function localHourStart(ts: number, tzOffsetMin: number): number {
  const off = tzOffsetMin * MIN
  return Math.floor((ts + off) / HOUR) * HOUR - off
}

/**
 * The local day a sleep point belongs to: the day the wearer wakes up on. Shifting by 12 h keeps a whole night
 * (e.g. 23:00 → 07:00) in one bucket, so its enter and exit markers stay together.
 */
export function sleepDay(ts: number, tzOffsetMin: number): { date: string; dayStartMs: number } {
  return localDay(ts + 12 * HOUR, tzOffsetMin)
}
